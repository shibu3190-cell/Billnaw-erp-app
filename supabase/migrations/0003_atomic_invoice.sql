-- ==========================================================================
-- 0003 — ATOMIC INVOICE COMMIT + SCHEMA ADDITIONS
-- Run after 0001 and 0002.
-- ==========================================================================

-- New columns used by the OTP onboarding flow and GST place-of-supply.
alter table shops     add column if not exists owner_name text;
alter table shops     add column if not exists email text;
alter table customers add column if not exists address text;
alter table customers add column if not exists state_code text;
alter table sales     add column if not exists place_of_supply text;
alter table sales     add column if not exists industry text;

-- ==========================================================================
-- create_invoice_atomic
--
-- WHY THIS EXISTS: the client previously made three separate network calls
-- per sale — insert invoice, decrement each item's stock, upsert customer.
-- A dropped connection between call 1 and call 2 left a saved invoice whose
-- stock never moved, and no error anyone would notice until a stock count
-- didn't reconcile weeks later. Postgres gives us a transaction for free;
-- this puts all three inside it, so a sale either lands completely or not
-- at all.
--
-- IDEMPOTENCY: idempotency_key is UNIQUE. A retried sync of an
-- already-committed invoice returns the existing row instead of raising,
-- so the offline queue can retry safely without double-booking a bill or
-- double-decrementing stock.
-- ==========================================================================
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
  v_cust_addr  text;
  v_cust_state text;
  v_cust_id    uuid;
  v_total      numeric;
  v_tender     text;
begin
  -- Caller must own this shop (or be support), and the shop must be active.
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  -- Idempotent replay: already committed, return it unchanged.
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

  -- Decrement stock for each line, guarded. If any line has insufficient
  -- stock the whole transaction rolls back, including the invoice insert.
  for v_item in select * from jsonb_array_elements(coalesce(p_invoice->'items', '[]'::jsonb))
  loop
    begin
      v_item_id := (v_item->>'id')::uuid;
    exception when others then
      continue;  -- line has no valid uuid (ad-hoc item); nothing to decrement
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

  -- Customer ledger.
  v_cust_phone := p_invoice->'customer_snapshot'->>'phone';
  if v_cust_phone is not null and v_cust_phone <> '' and v_cust_phone <> '-' then
    v_cust_name  := coalesce(p_invoice->'customer_snapshot'->>'name', 'Cash Customer');
    v_cust_gstin := nullif(p_invoice->'customer_snapshot'->>'gstin', '');
    v_cust_addr  := nullif(p_invoice->'customer_snapshot'->>'address', '');
    v_cust_state := nullif(p_invoice->'customer_snapshot'->>'stateCode', '');
    v_total      := coalesce((p_invoice->>'total')::numeric, 0);
    v_tender     := coalesce(p_invoice->>'tender', 'Cash');

    insert into customers (shop_id, phone, name, gstin, address, state_code, dues, total_orders_val)
    values (
      p_shop_id, v_cust_phone, v_cust_name, v_cust_gstin, v_cust_addr, v_cust_state,
      case when v_tender = 'Khata' then v_total else 0 end,
      v_total
    )
    on conflict (shop_id, phone) do update set
      name             = excluded.name,
      gstin            = coalesce(excluded.gstin, customers.gstin),
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

-- ==========================================================================
-- next_invoice_number — server-side sequence per shop.
-- Two devices billing offline can still collide locally, but any device that
-- is online gets a number no one else holds, which removes the most common
-- collision path.
-- ==========================================================================
create or replace function next_invoice_number(p_shop_id uuid, p_prefix text default 'INV')
returns text
language plpgsql
security definer
as $$
declare
  v_max int;
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select coalesce(max(nullif(regexp_replace(invoice_no, '\D', '', 'g'), '')::int), 1000)
  into v_max
  from sales
  where shop_id = p_shop_id;

  return p_prefix || '-' || (v_max + 1)::text;
end;
$$;
