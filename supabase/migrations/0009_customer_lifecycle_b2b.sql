-- ==========================================================================
-- 0009 — CUSTOMER LIFECYCLE, B2B COMPLIANCE FIELDS, VENDOR DIVISIONS
-- Run after 0001–0008.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Customers: archival instead of hard delete, manual star, B2B fields.
--
-- WHY ARCHIVE, NOT DELETE: a customer with sales history is referenced by
-- sales.customer_snapshot (a copy, so deleting the row doesn't corrupt past
-- invoices) but also by sales.customer_id (a live foreign key). Hard-deleting
-- a customer who has ever bought anything either fails the FK constraint or
-- silently orphans the id. Archiving is reversible and keeps history intact;
-- true deletion is only offered client-side for a customer with zero orders.
-- --------------------------------------------------------------------------
alter table customers add column if not exists archived boolean not null default false;
alter table customers add column if not exists is_starred boolean not null default false;
alter table customers add column if not exists pan text;
alter table customers add column if not exists drug_license_no text; -- B2B pharmacy buyer (hospital, clinic, another pharmacy)

create index if not exists idx_customers_archived on customers(shop_id, archived);

-- --------------------------------------------------------------------------
-- Vendors: same star + B2B compliance fields, plus divisions.
-- Many Indian pharma/FMCG distributors are one legal company with several
-- sales divisions (e.g. a pharma major's "Cardiac Care" division vs its
-- "Dermatology" division) that bill separately and matter for supplier
-- statements — grouping every purchase under one flat vendor loses that.
-- --------------------------------------------------------------------------
alter table vendors add column if not exists is_starred boolean not null default false;
alter table vendors add column if not exists pan text;
alter table vendors add column if not exists drug_license_no text; -- supplier's own DL number, for pharmacy purchase records
alter table vendors add column if not exists archived boolean not null default false;

create table if not exists vendor_divisions (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  vendor_id  uuid not null references vendors(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (vendor_id, name)
);
create index if not exists idx_vendor_divisions_vendor on vendor_divisions(vendor_id);

alter table vendor_divisions enable row level security;
drop policy if exists vendor_divisions_all on vendor_divisions;
create policy vendor_divisions_all on vendor_divisions for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id) and my_role() <> 'cashier'))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id) and my_role() <> 'cashier'));

alter table purchases add column if not exists division_id uuid references vendor_divisions(id);

-- --------------------------------------------------------------------------
-- Shop's own compliance identifiers. A pharmacy needs its Drug License
-- Number on every B2B invoice; PAN is needed once a B2B sale's value
-- crosses thresholds where the buyer's accountant will ask for it anyway.
-- --------------------------------------------------------------------------
alter table shops add column if not exists drug_license_no text;
alter table shops add column if not exists pan_number text;

-- --------------------------------------------------------------------------
-- Frequency/star classification — computed server-side so "frequent buyer"
-- means the same thing on every device rather than depending on whatever
-- sales happen to be cached locally.
--
-- Definition: 3+ orders in the trailing 90 days, OR manually starred.
-- Threshold is deliberately simple and explainable to a shop owner rather
-- than a opaque scoring model.
-- --------------------------------------------------------------------------
create or replace function fetch_customers_with_tags(p_shop_id uuid)
returns table (
  id uuid, shop_id uuid, phone text, name text, gstin text, pan text,
  drug_license_no text, address text, state_code text, category text,
  dues numeric, total_orders_val numeric, archived boolean, is_starred boolean,
  orders_last_90d bigint, is_frequent boolean, created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  return query
  select c.id, c.shop_id, c.phone, c.name, c.gstin, c.pan, c.drug_license_no,
         c.address, c.state_code, c.category, c.dues, c.total_orders_val,
         c.archived, c.is_starred,
         coalesce(o.cnt, 0) as orders_last_90d,
         (coalesce(o.cnt, 0) >= 3 or c.is_starred) as is_frequent,
         c.created_at
  from customers c
  left join (
    select customer_id, count(*) as cnt
    from sales
    where shop_id = p_shop_id and created_at >= now() - interval '90 days'
    group by customer_id
  ) o on o.customer_id = c.id
  where c.shop_id = p_shop_id
  order by c.name;
end;
$$;

-- --------------------------------------------------------------------------
-- Extend create_purchase_atomic to accept an optional division. Same
-- function, same signature (jsonb payload), so the client doesn't need two
-- code paths — a shop that never uses divisions just omits the key.
-- --------------------------------------------------------------------------
create or replace function create_purchase_atomic(p_shop_id uuid, p_purchase jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_existing   purchases%rowtype;
  v_purchase_id uuid;
  v_vendor_id  uuid;
  v_division_id uuid;
  v_vendor_name text;
  v_division_name text;
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

  -- Division is scoped to its vendor: same division name under two
  -- different companies must not collide (vendor_divisions is unique on
  -- (vendor_id, name), not name alone).
  v_division_name := nullif(trim(p_purchase->>'division_name'), '');
  if v_division_name is not null and v_vendor_id is not null then
    insert into vendor_divisions (shop_id, vendor_id, name)
    values (p_shop_id, v_vendor_id, v_division_name)
    on conflict (vendor_id, name) do update set name = excluded.name
    returning id into v_division_id;
  end if;

  insert into purchases (
    shop_id, vendor_id, division_id, vendor_snapshot, bill_no, bill_date, idempotency_key,
    taxable, gst_total, round_off, total, interstate, place_of_supply,
    payment_status, amount_paid, source, items, created_by
  ) values (
    p_shop_id, v_vendor_id, v_division_id,
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

  if v_vendor_id is not null then
    update vendors
    set payables = payables
        + coalesce((p_purchase->>'total')::numeric, 0)
        - coalesce((p_purchase->>'amount_paid')::numeric, 0)
    where id = v_vendor_id;
  end if;

  return jsonb_build_object('purchase_id', v_purchase_id,
                            'vendor_id', v_vendor_id,
                            'division_id', v_division_id,
                            'replayed', false);
end;
$$;

-- --------------------------------------------------------------------------
-- Guarded delete: only succeeds if the customer has zero sales history.
-- Otherwise the caller must archive instead — enforced here, not just in
-- the client, so a direct API call can't bypass the safeguard.
-- --------------------------------------------------------------------------
create or replace function delete_customer_if_unused(p_shop_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_order_count int;
begin
  if my_role() = 'cashier' then
    raise exception 'Only the shop owner can delete a customer record';
  end if;
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select count(*) into v_order_count from sales
  where shop_id = p_shop_id and customer_id = p_customer_id;

  if v_order_count > 0 then
    raise exception 'This customer has % order(s) on record — archive instead of deleting', v_order_count;
  end if;

  delete from customers where id = p_customer_id and shop_id = p_shop_id;
end;
$$;

-- --------------------------------------------------------------------------
-- Patch create_invoice_atomic (0003) to also persist customer PAN and Drug
-- License from the invoice's customer_snapshot. Otherwise unchanged from
-- 0003 — only the customer upsert's column list and values differ.
-- --------------------------------------------------------------------------
create or replace function create_invoice_atomic(p_shop_id uuid, p_invoice jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_existing   sales%rowtype;
  v_sale_id    uuid;
  v_item       jsonb;
  v_item_id    uuid;
  v_qty        int;
  v_updated    int;
  v_cust_phone text;
  v_cust_name  text;
  v_cust_gstin text;
  v_cust_pan   text;
  v_cust_dl    text;
  v_cust_addr  text;
  v_cust_state text;
  v_total      numeric;
  v_tender     text;
  v_cust_id    uuid;
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select * into v_existing
  from sales
  where idempotency_key = p_invoice->>'idempotency_key';

  if found then
    return jsonb_build_object(
      'sale_id', v_existing.id,
      'invoice_no', v_existing.invoice_no,
      'replayed', true
    );
  end if;

  insert into sales (
    shop_id, invoice_no, idempotency_key, customer_snapshot, tender,
    taxable, gst_total, round_off, total, interstate,
    place_of_supply, industry, items
  ) values (
    p_shop_id,
    p_invoice->>'invoice_no',
    p_invoice->>'idempotency_key',
    coalesce(p_invoice->'customer_snapshot', '{}'::jsonb),
    coalesce(p_invoice->>'tender', 'Cash'),
    coalesce((p_invoice->>'taxable')::numeric, 0),
    coalesce((p_invoice->>'gst_total')::numeric, 0),
    coalesce((p_invoice->>'round_off')::numeric, 0),
    coalesce((p_invoice->>'total')::numeric, 0),
    coalesce((p_invoice->>'interstate')::boolean, false),
    p_invoice->>'place_of_supply',
    p_invoice->>'industry',
    coalesce(p_invoice->'items', '[]'::jsonb)
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_invoice->'items', '[]'::jsonb))
  loop
    begin
      v_item_id := (v_item->>'id')::uuid;
    exception when others then
      continue;
    end;

    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_item_id is null or v_qty <= 0 then
      continue;
    end if;

    update items
    set stock = stock - v_qty, updated_at = now()
    where id = v_item_id and shop_id = p_shop_id and stock >= v_qty;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'Insufficient stock for item % (needed %)', v_item->>'name', v_qty;
    end if;
  end loop;

  v_cust_phone := p_invoice->'customer_snapshot'->>'phone';
  if v_cust_phone is not null and v_cust_phone <> '' and v_cust_phone <> '-' then
    v_cust_name  := coalesce(p_invoice->'customer_snapshot'->>'name', 'Cash Customer');
    v_cust_gstin := nullif(p_invoice->'customer_snapshot'->>'gstin', '');
    v_cust_pan   := nullif(p_invoice->'customer_snapshot'->>'pan', '');
    v_cust_dl    := nullif(p_invoice->'customer_snapshot'->>'drugLicenseNo', '');
    v_cust_addr  := nullif(p_invoice->'customer_snapshot'->>'address', '');
    v_cust_state := nullif(p_invoice->'customer_snapshot'->>'stateCode', '');
    v_total      := coalesce((p_invoice->>'total')::numeric, 0);
    v_tender     := coalesce(p_invoice->>'tender', 'Cash');

    insert into customers (shop_id, phone, name, gstin, pan, drug_license_no, address, state_code, dues, total_orders_val)
    values (
      p_shop_id, v_cust_phone, v_cust_name, v_cust_gstin, v_cust_pan, v_cust_dl, v_cust_addr, v_cust_state,
      case when v_tender = 'Khata' then v_total else 0 end,
      v_total
    )
    on conflict (shop_id, phone) do update set
      name             = excluded.name,
      gstin            = coalesce(excluded.gstin, customers.gstin),
      pan              = coalesce(excluded.pan, customers.pan),
      drug_license_no  = coalesce(excluded.drug_license_no, customers.drug_license_no),
      address          = coalesce(excluded.address, customers.address),
      state_code       = coalesce(excluded.state_code, customers.state_code),
      dues             = customers.dues + case when v_tender = 'Khata' then v_total else 0 end,
      total_orders_val = customers.total_orders_val + v_total
    returning id into v_cust_id;

    update sales set customer_id = v_cust_id where id = v_sale_id;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', p_invoice->>'invoice_no',
    'replayed', false
  );
end;
$$;
