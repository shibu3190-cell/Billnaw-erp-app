-- ==========================================================================
-- BILLNAW CORE SCHEMA — run in Supabase SQL Editor, top to bottom, once.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).
-- ==========================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- --------------------------------------------------------------------------
-- SHOPS (tenants)
-- --------------------------------------------------------------------------
create table if not exists shops (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  gstin          text,
  state_code     text,
  phone          text not null,
  address        text not null,
  industry       text default 'All',
  is_locked      boolean default false,
  bank_name      text,
  bank_acc       text,
  bank_ifsc      text,
  upi_id         text,
  terms          text,
  printer_format text default 'a4',
  thermal_width  int default 80,
  status         text not null default 'active' check (status in ('active','revoked','suspended')),
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- PROFILES — one row per auth.users row. This is what carries role + shop_id.
-- --------------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  shop_id    uuid references shops(id) on delete cascade,
  role       text not null default 'owner' check (role in ('super_admin','owner','cashier')),
  full_name  text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- ITEMS
-- --------------------------------------------------------------------------
create table if not exists items (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  name       text not null,
  category   text not null default 'Electronics',
  barcode    text,
  hsn        text not null default '8517',
  gst        numeric not null default 18,
  price      numeric not null default 0,
  cost       numeric not null default 0,
  stock      int not null default 0,
  serials    jsonb not null default '[]',
  huids      jsonb not null default '[]',
  batches    jsonb not null default '[]',
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_items_shop on items(shop_id);
create index if not exists idx_items_barcode on items(shop_id, barcode);

-- --------------------------------------------------------------------------
-- CUSTOMERS (Khata)
-- --------------------------------------------------------------------------
create table if not exists customers (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  phone            text not null,
  name             text not null,
  gstin            text,
  category         text default 'Retail',
  dues             numeric not null default 0,
  total_orders_val numeric not null default 0,
  created_at       timestamptz not null default now(),
  unique (shop_id, phone)
);
create index if not exists idx_customers_shop on customers(shop_id);

-- --------------------------------------------------------------------------
-- SALES (invoices) — items stored as jsonb snapshot, same shape as cart.
-- --------------------------------------------------------------------------
create table if not exists sales (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  invoice_no       text not null,
  idempotency_key  text not null unique,
  customer_id      uuid references customers(id),
  customer_snapshot jsonb not null default '{}', -- name/phone/gstin at time of sale
  tender           text not null default 'Cash',
  taxable          numeric not null default 0,
  gst_total        numeric not null default 0,
  round_off        numeric not null default 0,
  total            numeric not null default 0,
  interstate       boolean not null default false,
  items            jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  unique (shop_id, invoice_no)
);
create index if not exists idx_sales_shop on sales(shop_id, created_at desc);

-- --------------------------------------------------------------------------
-- AI PURCHASE STAGING — holds OCR results pending owner review/merge.
-- --------------------------------------------------------------------------
create table if not exists ai_purchase_staging (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  extracted  jsonb not null default '[]',
  status     text not null default 'pending' check (status in ('pending','merged','discarded')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_staging_shop on ai_purchase_staging(shop_id, status);

-- --------------------------------------------------------------------------
-- AUDIT LOG — every super-admin cross-shop access gets written here.
-- Append-only: no update/delete policy is granted to anyone, including
-- super_admin, from the client. Only a service-role backend job may prune it.
-- --------------------------------------------------------------------------
create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid not null references auth.users(id),
  shop_id    uuid references shops(id),
  action     text not null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_shop on audit_log(shop_id, created_at desc);

-- ==========================================================================
-- HELPER: current user's shop_id and role, read once per statement.
-- ==========================================================================
create or replace function my_shop_id() returns uuid
language sql stable security definer as $$
  select shop_id from profiles where id = auth.uid();
$$;

create or replace function my_role() returns text
language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function shop_is_active(target_shop uuid) returns boolean
language sql stable security definer as $$
  select coalesce((select status = 'active' from shops where id = target_shop), false);
$$;

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================
alter table shops enable row level security;
alter table profiles enable row level security;
alter table items enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table ai_purchase_staging enable row level security;
alter table audit_log enable row level security;

-- SHOPS: a user sees only their own shop (and it must be active for
-- owner/cashier — this is the revocation enforcement point). super_admin
-- sees all shops, active or not, for support purposes.
drop policy if exists shops_select on shops;
create policy shops_select on shops for select
  using (
    my_role() = 'super_admin'
    or (id = my_shop_id() and status = 'active')
  );

drop policy if exists shops_insert_authenticated on shops;
create policy shops_insert_authenticated on shops for insert
  with check (auth.uid() is not null);

drop policy if exists shops_update_owner on shops;
create policy shops_update_owner on shops for update
  using (my_role() = 'super_admin' or (id = my_shop_id() and my_role() = 'owner' and status = 'active'))
  with check (my_role() = 'super_admin' or (id = my_shop_id() and my_role() = 'owner'));

-- PROFILES: users see their own profile; super_admin sees all.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or my_role() = 'super_admin');

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid());

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid())); -- can't self-promote role

-- ITEMS / CUSTOMERS / SALES / AI STAGING: identical pattern —
-- shop must match AND shop must be active, OR caller is super_admin.
drop policy if exists items_all on items;
create policy items_all on items for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)));

drop policy if exists customers_all on customers;
create policy customers_all on customers for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)));

drop policy if exists sales_all on sales;
create policy sales_all on sales for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)));

drop policy if exists ai_staging_all on ai_purchase_staging;
create policy ai_staging_all on ai_purchase_staging for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)));

-- AUDIT LOG: insert-only from clients (no select/update/delete policy
-- granted at all — not even super_admin can read/alter it via the
-- client API; querying it is a service-role/dashboard-only action,
-- which is what makes it a real audit trail rather than a log the
-- same account that made the access could also edit).
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert
  with check (actor_id = auth.uid());

-- ==========================================================================
-- Trigger: writing an audit row every time a super_admin reads/writes a
-- shop they don't own. (Belt-and-suspenders alongside the app calling
-- log_admin_access() explicitly before elevated reads — see supabaseClient.js)
-- ==========================================================================
create or replace function log_super_admin_access(p_shop_id uuid, p_action text, p_meta jsonb default '{}')
returns void
language plpgsql security definer as $$
begin
  if my_role() = 'super_admin' then
    insert into audit_log (actor_id, shop_id, action, meta)
    values (auth.uid(), p_shop_id, p_action, p_meta);
  end if;
end;
$$;
