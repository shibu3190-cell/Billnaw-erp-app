-- ==========================================================================
-- F5 FIX: surface silently-skipped lines in the atomic RPCs
-- ==========================================================================
-- Background: docs/SECURITY_REPORT.md F5. create_invoice_atomic,
-- create_purchase_atomic, and process_sales_return_atomic each loop over
-- a client-submitted items array and `continue` past a line that has a
-- malformed/missing item id, a non-positive quantity, or (purchases only)
-- references a product that no longer exists — with no record of it
-- anywhere in the response. The invoice/purchase/return TOTAL, computed
-- client-side and already inserted before the loop runs, still includes
-- that line's value: money changes hands (a sale is billed, a vendor
-- payable increases, a customer is credited) but the corresponding stock
-- movement silently does not happen, and the shop owner has no way to
-- know it happened short of a manual stock reconciliation.
--
-- This migration does NOT change what gets skipped or why — a hard
-- failure on one malformed line among many is worse for offline
-- resilience than proceeding with the rest (per the original design
-- rationale in 0003/0007/0005). It only makes the skip visible: each
-- function now collects a `warnings text[]` and returns it in the
-- response jsonb, the same shape the AI-parse edge function already uses
-- for its own reconciliation warnings. The client (app.js) surfaces a
-- non-empty warnings array as a toast — see the accompanying app.js
-- change in this same commit.
--
-- Every function below is a full `create or replace`, reproducing the
-- entire existing body with only the warning-collection lines added —
-- consistent with how every prior migration re-defines these functions
-- (0003/0007/0009), not a partial patch.
-- ==========================================================================

/* -------------------------------------------------------------------------- */
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
  v_warnings   text[] := '{}';
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
      v_warnings := v_warnings || format(
        'Line "%s" has an invalid item reference — stock was not adjusted for this line.',
        coalesce(v_item->>'name', 'unknown item'));
      continue;
    end;

    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_item_id is null or v_qty <= 0 then
      v_warnings := v_warnings || format(
        'Line "%s" was skipped (missing item or invalid quantity) — stock was not adjusted for this line.',
        coalesce(v_item->>'name', 'unknown item'));
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
    'replayed', false,
    'warnings', to_jsonb(v_warnings)
  );
end;
$$;

/* -------------------------------------------------------------------------- */
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
  v_warnings   text[] := '{}';
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
      v_warnings := v_warnings || format(
        'Line "%s" has an invalid item reference — not added to stock.',
        coalesce(v_item->>'name', 'unknown item'));
      continue;
    end;

    v_qty := coalesce((v_item->>'qty')::int, 0);
    v_unit_cost := coalesce((v_item->>'cost')::numeric, 0);
    if v_item_id is null or v_qty <= 0 then
      v_warnings := v_warnings || format(
        'Line "%s" was skipped (missing item or invalid quantity) — not added to stock.',
        coalesce(v_item->>'name', 'unknown item'));
      continue;
    end if;

    select stock, coalesce(cost, 0) into v_old_stock, v_old_cost
    from items where id = v_item_id and shop_id = p_shop_id;
    if not found then
      v_warnings := v_warnings || format(
        'Line "%s" references a product that no longer exists in this shop — not added to stock.',
        coalesce(v_item->>'name', 'unknown item'));
      continue;
    end if;

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
                            'replayed', false,
                            'warnings', to_jsonb(v_warnings));
end;
$$;

/* -------------------------------------------------------------------------- */
create or replace function process_sales_return_atomic(
  p_shop_id uuid,
  p_sale_id uuid,
  p_return jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_existing      sales_returns%rowtype;
  v_sale          sales%rowtype;
  v_return_id     uuid;
  v_item          jsonb;
  v_item_id       uuid;
  v_qty           int;
  v_identifier    text;
  v_sold_qty      int;
  v_already       int;
  v_restock       boolean := coalesce((p_return->>'restock')::boolean, true);
  v_total         numeric := coalesce((p_return->>'total')::numeric, 0);
  v_cust_phone    text;
  v_new_returned  numeric;
  v_new_status    text;
  v_warnings      text[] := '{}';
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  -- Idempotent replay (offline queue may retry the same return).
  select * into v_existing from sales_returns
  where idempotency_key = p_return->>'idempotency_key';
  if found then
    return jsonb_build_object('return_id', v_existing.id,
                              'credit_note_no', v_existing.credit_note_no,
                              'replayed', true);
  end if;

  select * into v_sale from sales where id = p_sale_id and shop_id = p_shop_id;
  if not found then
    raise exception 'Original invoice not found for this shop';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'Invoice % is cancelled and cannot be returned against', v_sale.invoice_no;
  end if;

  -- Validate each returned line against what was actually sold, net of
  -- anything already returned on a previous credit note.
  for v_item in select * from jsonb_array_elements(coalesce(p_return->'items','[]'::jsonb))
  loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then continue; end if;

    select coalesce(sum((elem->>'qty')::int), 0) into v_sold_qty
    from jsonb_array_elements(coalesce(v_sale.items,'[]'::jsonb)) elem
    where elem->>'id' = v_item->>'id';

    select coalesce(sum((elem->>'qty')::int), 0) into v_already
    from sales_returns r,
         jsonb_array_elements(coalesce(r.items,'[]'::jsonb)) elem
    where r.sale_id = p_sale_id and elem->>'id' = v_item->>'id';

    if v_qty > (v_sold_qty - v_already) then
      raise exception 'Cannot return % of "%": only % remain returnable on invoice %',
        v_qty, coalesce(v_item->>'name','item'), (v_sold_qty - v_already), v_sale.invoice_no;
    end if;
  end loop;

  insert into sales_returns (
    shop_id, sale_id, credit_note_no, idempotency_key, customer_snapshot,
    reason, restock, taxable, gst_total, round_off, total,
    interstate, place_of_supply, items, created_by
  ) values (
    p_shop_id, p_sale_id,
    p_return->>'credit_note_no',
    p_return->>'idempotency_key',
    coalesce(v_sale.customer_snapshot, '{}'::jsonb),
    p_return->>'reason',
    v_restock,
    coalesce((p_return->>'taxable')::numeric, 0),
    coalesce((p_return->>'gst_total')::numeric, 0),
    coalesce((p_return->>'round_off')::numeric, 0),
    v_total,
    coalesce(v_sale.interstate, false),
    v_sale.place_of_supply,
    coalesce(p_return->'items','[]'::jsonb),
    auth.uid()
  )
  returning id into v_return_id;

  -- Restock. Damaged goods can be returned without restocking (restock=false)
  -- — the customer is still credited, but the unit does not re-enter sellable
  -- inventory, which is the correct treatment for a broken item.
  if v_restock then
    for v_item in select * from jsonb_array_elements(coalesce(p_return->'items','[]'::jsonb))
    loop
      begin
        v_item_id := (v_item->>'id')::uuid;
      exception when others then
        v_warnings := v_warnings || format(
          'Return line "%s" has an invalid item reference — stock was not restored for this line.',
          coalesce(v_item->>'name', 'unknown item'));
        continue;
      end;
      v_qty := coalesce((v_item->>'qty')::int, 0);
      if v_item_id is null or v_qty <= 0 then
        v_warnings := v_warnings || format(
          'Return line "%s" was skipped (missing item or invalid quantity) — stock was not restored for this line.',
          coalesce(v_item->>'name', 'unknown item'));
        continue;
      end if;

      update items
      set stock = stock + v_qty, updated_at = now()
      where id = v_item_id and shop_id = p_shop_id;

      -- Put the specific identifier back into the sellable pool so the same
      -- physical unit can be resold under its own IMEI/HUID rather than
      -- becoming untracked stock.
      v_identifier := nullif(v_item->>'assignedIdentifier', '');
      if v_identifier is not null then
        update items
        set serials = case
              when category = 'Electronics' and not (serials ? v_identifier)
                then serials || to_jsonb(v_identifier) else serials end,
            huids = case
              when category = 'Jewelry' and not (huids ? v_identifier)
                then huids || to_jsonb(v_identifier) else huids end,
            updated_at = now()
        where id = v_item_id and shop_id = p_shop_id;
      end if;
    end loop;
  end if;

  -- Credit the customer's ledger. A credit sale being returned reduces what
  -- they owe; it must never push the balance below zero into a phantom
  -- advance the shop never received.
  v_cust_phone := v_sale.customer_snapshot->>'phone';
  if v_cust_phone is not null and v_cust_phone <> '' and v_cust_phone <> '-' then
    update customers
    set dues = greatest(0, dues - case when v_sale.tender = 'Khata' then v_total else 0 end),
        total_orders_val = greatest(0, total_orders_val - v_total)
    where shop_id = p_shop_id and phone = v_cust_phone;
  end if;

  -- Update the parent invoice. It is never deleted — GST requires the
  -- original tax invoice to remain on record; only its status changes.
  v_new_returned := coalesce(v_sale.returned_value, 0) + v_total;
  if v_new_returned >= coalesce(v_sale.total, 0) - 0.01 then
    v_new_status := 'returned';
  else
    v_new_status := 'partially_returned';
  end if;

  update sales
  set returned_value = v_new_returned, status = v_new_status
  where id = p_sale_id;

  return jsonb_build_object(
    'return_id', v_return_id,
    'credit_note_no', p_return->>'credit_note_no',
    'invoice_status', v_new_status,
    'replayed', false,
    'warnings', to_jsonb(v_warnings)
  );
end;
$$;
