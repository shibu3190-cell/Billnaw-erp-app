-- ==========================================================================
-- ATOMIC STOCK DECREMENT
-- Two cashiers selling the last unit of the same item at the same second is
-- a real scenario on a busy counter. A client-side "read stock, subtract,
-- write stock" is a classic lost-update race. This function does the
-- decrement inside a single guarded UPDATE, so it's safe under concurrency.
-- ==========================================================================
create or replace function decrement_item_stock(p_item_id uuid, p_qty int)
returns void
language plpgsql security definer as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from items where id = p_item_id;

  if v_shop is null then
    raise exception 'Item not found';
  end if;

  if my_role() <> 'super_admin' and (v_shop <> my_shop_id() or not shop_is_active(v_shop)) then
    raise exception 'Not permitted';
  end if;

  update items
  set stock = stock - p_qty, updated_at = now()
  where id = p_item_id and stock >= p_qty;

  if not found then
    raise exception 'Insufficient stock or item not found';
  end if;
end;
$$;
