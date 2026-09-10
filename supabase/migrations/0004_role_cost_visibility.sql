-- ==========================================================================
-- 0004 — ROLE-ENFORCED COST VISIBILITY
--
-- THE PROBLEM THIS FIXES: hiding wholesale cost and margin from staff by
-- adding a CSS class (`.admin-only { display:none }`) is not security. The
-- cost column was still being sent to the browser in every items query — any
-- cashier could open devtools, run one fetch, and read the shop's entire
-- purchase-price list. That is the single most commercially sensitive table
-- a shop has.
--
-- Enforcement has to happen where the data leaves the database. These
-- functions return cost/margin as NULL for the 'cashier' role, so a hostile
-- client cannot recover it no matter what it asks for.
-- ==========================================================================

-- ------------------------------------------------------------------
-- Items, cost-redacted per role.
-- ------------------------------------------------------------------
create or replace function fetch_items_for_role(p_shop_id uuid)
returns table (
  id uuid, shop_id uuid, name text, category text, barcode text,
  hsn text, gst numeric, price numeric, cost numeric, stock int,
  serials jsonb, huids jsonb, batches jsonb, meta jsonb,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_role text := my_role();
begin
  if v_role <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  return query
  select i.id, i.shop_id, i.name, i.category, i.barcode,
         i.hsn, i.gst, i.price,
         case when v_role = 'cashier' then null::numeric else i.cost end as cost,
         i.stock, i.serials, i.huids, i.batches, i.meta,
         i.created_at, i.updated_at
  from items i
  where i.shop_id = p_shop_id
  order by i.name;
end;
$$;

-- ------------------------------------------------------------------
-- Sales, with line-item costs stripped for cashiers.
-- The cart snapshot stored in sales.items carries each line's `cost`, so a
-- cashier reading sales history could reconstruct the cost book from there
-- even with the items table locked down. This closes that back door.
-- ------------------------------------------------------------------
create or replace function fetch_sales_for_role(p_shop_id uuid, p_limit int default 200)
returns setof sales
language plpgsql
security definer
as $$
declare
  v_role text := my_role();
  r sales%rowtype;
begin
  if v_role <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  for r in
    select * from sales
    where shop_id = p_shop_id
    order by created_at desc
    limit p_limit
  loop
    if v_role = 'cashier' then
      select jsonb_agg(elem - 'cost')
      into r.items
      from jsonb_array_elements(coalesce(r.items, '[]'::jsonb)) elem;
      r.items := coalesce(r.items, '[]'::jsonb);
    end if;
    return next r;
  end loop;
end;
$$;

-- ------------------------------------------------------------------
-- Profit summary — owners only. Rather than shipping costs to the client
-- and computing margin there, the arithmetic happens server-side and a
-- cashier simply gets an error.
-- ------------------------------------------------------------------
create or replace function shop_profit_summary(p_shop_id uuid, p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_role text := my_role();
  v_revenue numeric := 0;
  v_cogs numeric := 0;
begin
  if v_role = 'cashier' then
    raise exception 'Profit data is restricted to the account owner';
  end if;
  if v_role <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select
    coalesce(sum(s.taxable), 0),
    coalesce(sum((
      select sum(coalesce((elem->>'cost')::numeric, 0) * coalesce((elem->>'qty')::numeric, 0))
      from jsonb_array_elements(coalesce(s.items, '[]'::jsonb)) elem
    )), 0)
  into v_revenue, v_cogs
  from sales s
  where s.shop_id = p_shop_id
    and (p_from is null or s.created_at >= p_from)
    and (p_to   is null or s.created_at <= p_to);

  return jsonb_build_object(
    'revenue_ex_gst', round(v_revenue, 2),
    'cogs', round(v_cogs, 2),
    'gross_profit', round(v_revenue - v_cogs, 2),
    'margin_pct', case when v_revenue > 0
                       then round(((v_revenue - v_cogs) / v_revenue) * 100, 2)
                       else 0 end
  );
end;
$$;

-- ------------------------------------------------------------------
-- Staff invitation: lets an owner create a cashier bound to their shop.
-- Without this there is no way to produce a cashier account at all, so the
-- whole role split would be theoretical.
-- ------------------------------------------------------------------
create or replace function assign_staff_to_shop(p_user_id uuid, p_shop_id uuid, p_full_name text default null)
returns void
language plpgsql
security definer
as $$
begin
  if my_role() not in ('owner', 'super_admin') or
     (my_role() = 'owner' and p_shop_id <> my_shop_id()) then
    raise exception 'Only the shop owner can add staff';
  end if;

  insert into profiles (id, shop_id, role, full_name)
  values (p_user_id, p_shop_id, 'cashier', p_full_name)
  on conflict (id) do update
    set shop_id = excluded.shop_id,
        role = 'cashier',
        full_name = coalesce(excluded.full_name, profiles.full_name);
end;
$$;
