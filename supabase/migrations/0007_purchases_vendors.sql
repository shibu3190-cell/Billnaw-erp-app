-- ==========================================================================
-- 0007 — PURCHASES / VENDOR BILL HISTORY  (P1 #4)
-- Run after 0001–0006.
--
-- Purchases were local-only: a shop that reinstalled, cleared its cache, or
-- billed from a second device lost every supplier bill it had ever entered,
-- along with the weighted-average cost basis derived from them. That also
-- made the purchase side of GSTR-2 impossible to reconstruct.
-- ==========================================================================

create table if not exists vendors (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  name       text not null,
  gstin      text,
  phone      text,
  address    text,
  state_code text,
  payables   numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);
create index if not exists idx_vendors_shop on vendors(shop_id);

create table if not exists purchases (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  vendor_id        uuid references vendors(id),
  vendor_snapshot  jsonb not null default '{}',
  bill_no          text,
  bill_date        date,
  idempotency_key  text not null unique,
  taxable          numeric not null default 0,
  gst_total        numeric not null default 0,
  round_off        numeric not null default 0,
  total            numeric not null default 0,
  interstate       boolean not null default false,
  place_of_supply  text,
  payment_status   text not null default 'unpaid'
                     check (payment_status in ('unpaid','partial','paid')),
  amount_paid      numeric not null default 0,
  source           text not null default 'manual'
                     check (source in ('manual','ai_ocr')),
  items            jsonb not null default '[]',
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create index if not exists idx_purchases_shop on purchases(shop_id, created_at desc);
create index if not exists idx_purchases_vendor on purchases(vendor_id);

alter table vendors   enable row level security;
alter table purchases enable row level security;

drop policy if exists vendors_all on vendors;
create policy vendors_all on vendors for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)));

-- Purchase records expose supplier cost, which is exactly what the cashier
-- role must never see. Unlike items/sales (where cost is redacted
-- column-by-column), there is nothing useful left in a purchase bill once
-- cost is stripped — so cashiers are denied the table outright.
drop policy if exists purchases_owner on purchases;
create policy purchases_owner on purchases for all
  using (
    my_role() = 'super_admin'
    or (shop_id = my_shop_id() and shop_is_active(shop_id) and my_role() <> 'cashier')
  )
  with check (
    my_role() = 'super_admin'
    or (shop_id = my_shop_id() and shop_is_active(shop_id) and my_role() <> 'cashier')
  );

-- ==========================================================================
-- create_purchase_atomic
-- Records the bill, increments stock, appends new serials/HUIDs/batches, and
-- recomputes each item's WEIGHTED AVERAGE cost — all in one transaction.
--
-- Weighted average matters: overwriting cost with the latest purchase price
-- (what the app did before) makes margin reporting wrong for every unit
-- still on the shelf from an older, cheaper lot.
-- ==========================================================================
create or replace function create_purchase_atomic(p_shop_id uuid, p_purchase jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_existing   purchases%rowtype;
  v_purchase_id uuid;
  v_vendor_id  uuid;
  v_vendor_name text;
  v_item       jsonb;
  v_item_id    uuid;
  v_qty        int;
  v_unit_cost  numeric;
  v_old_stock  int;
  v_old_cost   numeric;
  v_new_cost   numeric;
  v_ident      text;
begin
  if my_role() = 'cashier' then
    raise exception 'Purchases are restricted to the shop owner';
  end if;
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select * into v_existing from purchases
  where idempotency_key = p_purchase->>'idempotency_key';
  if found then
    return jsonb_build_object('purchase_id', v_existing.id, 'replayed', true);
  end if;

  -- Vendor upsert by name (shops rarely have supplier GSTINs to hand).
  v_vendor_name := nullif(trim(p_purchase->'vendor'->>'name'), '');
  if v_vendor_name is not null then
    insert into vendors (shop_id, name, gstin, phone, state_code)
    values (p_shop_id, v_vendor_name,
            nullif(p_purchase->'vendor'->>'gstin',''),
            nullif(p_purchase->'vendor'->>'phone',''),
            nullif(p_purchase->'vendor'->>'stateCode',''))
    on conflict (shop_id, name) do update
      set gstin = coalesce(excluded.gstin, vendors.gstin),
          phone = coalesce(excluded.phone, vendors.phone)
    returning id into v_vendor_id;
  end if;

  insert into purchases (
    shop_id, vendor_id, vendor_snapshot, bill_no, bill_date, idempotency_key,
    taxable, gst_total, round_off, total, interstate, place_of_supply,
    payment_status, amount_paid, source, items, created_by
  ) values (
    p_shop_id, v_vendor_id,
    coalesce(p_purchase->'vendor','{}'::jsonb),
    nullif(p_purchase->>'bill_no',''),
    nullif(p_purchase->>'bill_date','')::date,
    p_purchase->>'idempotency_key',
    coalesce((p_purchase->>'taxable')::numeric, 0),
    coalesce((p_purchase->>'gst_total')::numeric, 0),
    coalesce((p_purchase->>'round_off')::numeric, 0),
    coalesce((p_purchase->>'total')::numeric, 0),
    coalesce((p_purchase->>'interstate')::boolean, false),
    nullif(p_purchase->>'place_of_supply',''),
    coalesce(p_purchase->>'payment_status','unpaid'),
    coalesce((p_purchase->>'amount_paid')::numeric, 0),
    coalesce(p_purchase->>'source','manual'),
    coalesce(p_purchase->'items','[]'::jsonb),
    auth.uid()
  )
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_purchase->'items','[]'::jsonb))
  loop
    begin
      v_item_id := (v_item->>'id')::uuid;
    exception when others then
      continue;
    end;

    v_qty := coalesce((v_item->>'qty')::int, 0);
    v_unit_cost := coalesce((v_item->>'cost')::numeric, 0);
    if v_item_id is null or v_qty <= 0 then continue; end if;

    select stock, coalesce(cost, 0) into v_old_stock, v_old_cost
    from items where id = v_item_id and shop_id = p_shop_id;
    if not found then continue; end if;

    -- Weighted average. Guard the divisor: negative stock (from an
    -- oversell) would otherwise produce a nonsensical or divide-by-zero cost.
    if (greatest(v_old_stock, 0) + v_qty) > 0 then
      v_new_cost := ((greatest(v_old_stock, 0) * v_old_cost) + (v_qty * v_unit_cost))
                    / (greatest(v_old_stock, 0) + v_qty);
    else
      v_new_cost := v_unit_cost;
    end if;

    update items
    set stock = stock + v_qty,
        cost = round(v_new_cost, 2),
        price = coalesce(nullif((v_item->>'price')::numeric, 0), price),
        updated_at = now()
    where id = v_item_id and shop_id = p_shop_id;

    v_ident := nullif(v_item->>'identifier', '');
    if v_ident is not null then
      update items
      set serials = case when category = 'Electronics' and not (serials ? v_ident)
                         then serials || to_jsonb(v_ident) else serials end,
          huids   = case when category = 'Jewelry' and not (huids ? v_ident)
                         then huids || to_jsonb(v_ident) else huids end,
          batches = case when category = 'Pharmacy'
                         then batches || jsonb_build_array(jsonb_build_object(
                              'batch', v_ident,
                              'expiry', coalesce(v_item->>'expiry', ''),
                              'stock', v_qty))
                         else batches end,
          updated_at = now()
      where id = v_item_id and shop_id = p_shop_id;
    end if;
  end loop;

  -- Vendor payables: what the shop still owes this supplier.
  if v_vendor_id is not null then
    update vendors
    set payables = payables
        + coalesce((p_purchase->>'total')::numeric, 0)
        - coalesce((p_purchase->>'amount_paid')::numeric, 0)
    where id = v_vendor_id;
  end if;

  return jsonb_build_object('purchase_id', v_purchase_id,
                            'vendor_id', v_vendor_id,
                            'replayed', false);
end;
$$;
