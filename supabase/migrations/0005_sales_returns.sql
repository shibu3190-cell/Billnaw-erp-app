-- ==========================================================================
-- 0005 — SALES RETURNS / CREDIT NOTES
-- Run after 0001–0004.
--
-- WHY: the app could sell but never take anything back. A returned phone had
-- to be manually re-added to stock as a "new purchase", which broke the IMEI
-- chain of custody, double-counted the item's cost, and left the original
-- invoice claiming GST the shop no longer owed. Under GST, a return is not a
-- deletion — the original tax invoice must survive for the audit trail, and
-- the reversal is recorded as a separate credit note. This models exactly
-- that: the sale stays, a return row is created, and the invoice's status
-- flips to reflect what actually happened.
-- ==========================================================================

alter table sales add column if not exists status text not null default 'active'
  check (status in ('active', 'partially_returned', 'returned', 'cancelled'));
alter table sales add column if not exists returned_value numeric not null default 0;

create table if not exists sales_returns (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id) on delete cascade,
  sale_id           uuid not null references sales(id) on delete restrict,
  credit_note_no    text not null,
  idempotency_key   text not null unique,
  customer_snapshot jsonb not null default '{}',
  reason            text,
  restock           boolean not null default true,
  taxable           numeric not null default 0,
  gst_total         numeric not null default 0,
  round_off         numeric not null default 0,
  total             numeric not null default 0,
  interstate        boolean not null default false,
  place_of_supply   text,
  items             jsonb not null default '[]',
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  unique (shop_id, credit_note_no)
);
create index if not exists idx_returns_shop on sales_returns(shop_id, created_at desc);
create index if not exists idx_returns_sale on sales_returns(sale_id);

alter table sales_returns enable row level security;

drop policy if exists returns_all on sales_returns;
create policy returns_all on sales_returns for all
  using (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)))
  with check (my_role() = 'super_admin' or (shop_id = my_shop_id() and shop_is_active(shop_id)));

-- ==========================================================================
-- process_sales_return_atomic
--
-- One transaction: writes the credit note, puts stock back (including the
-- specific IMEI/HUID/batch identifiers, so a returned unit becomes sellable
-- again under its own serial rather than as anonymous stock), reduces the
-- customer's outstanding balance if the original was on credit, and updates
-- the parent invoice's status.
--
-- Guards against over-return: you cannot return more units of a line than
-- were sold on that invoice, minus whatever was already returned.
-- ==========================================================================
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
        continue;
      end;
      v_qty := coalesce((v_item->>'qty')::int, 0);
      if v_item_id is null or v_qty <= 0 then continue; end if;

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
    'replayed', false
  );
end;
$$;

-- ==========================================================================
-- Returnable quantity per line — powers the return UI so a cashier can only
-- pick amounts that are actually still returnable.
-- ==========================================================================
create or replace function returnable_lines(p_shop_id uuid, p_sale_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sale sales%rowtype;
  v_out  jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_already int;
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select * into v_sale from sales where id = p_sale_id and shop_id = p_shop_id;
  if not found then raise exception 'Invoice not found'; end if;

  for v_elem in select * from jsonb_array_elements(coalesce(v_sale.items,'[]'::jsonb))
  loop
    select coalesce(sum((e->>'qty')::int), 0) into v_already
    from sales_returns r, jsonb_array_elements(coalesce(r.items,'[]'::jsonb)) e
    where r.sale_id = p_sale_id and e->>'id' = v_elem->>'id';

    v_out := v_out || jsonb_build_array(
      v_elem || jsonb_build_object(
        'returnable_qty', greatest(0, coalesce((v_elem->>'qty')::int,0) - v_already)
      )
    );
  end loop;

  return v_out;
end;
$$;
