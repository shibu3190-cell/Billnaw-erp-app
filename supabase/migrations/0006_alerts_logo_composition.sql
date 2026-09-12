-- ==========================================================================
-- 0006 — LOGO, ALERT THRESHOLDS, REORDER LEVELS, PHARMACY COMPOSITION
-- Run after 0001–0005.
-- ==========================================================================

-- Shop logo, stored as a base64 data URL. The client downscales to 256×256
-- and re-encodes as JPEG (~15-40KB) before it ever reaches here — an
-- unprocessed phone photo would be several MB in every shop row and in
-- every client's offline cache.
alter table shops add column if not exists logo text;

-- Alert thresholds, per shop.
alter table shops add column if not exists low_stock_threshold int not null default 5;
alter table shops add column if not exists expiry_warn_days int not null default 30;

-- Per-item reorder level overrides the shop-wide default. A ₹65,000 gold
-- chain and a ₹10 strip of tablets should not share a reorder point.
alter table items add column if not exists low_stock_level int;

-- Active salt / molecule, used to suggest in-stock alternatives when a
-- medicine runs out. Kept as a plain text column rather than buried in
-- meta jsonb so it can be indexed and searched directly.
alter table items add column if not exists composition text;

create index if not exists idx_items_composition
  on items (shop_id, lower(composition))
  where composition is not null;

-- --------------------------------------------------------------------------
-- fetch_items_for_role must return the new columns too, or the client loses
-- composition/reorder data the moment it reads through the role-safe path.
-- Cost stays redacted for cashiers exactly as before.
-- --------------------------------------------------------------------------
create or replace function fetch_items_for_role(p_shop_id uuid)
returns table (
  id uuid, shop_id uuid, name text, category text, barcode text,
  hsn text, gst numeric, price numeric, cost numeric, stock int,
  serials jsonb, huids jsonb, batches jsonb, meta jsonb,
  low_stock_level int, composition text,
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
         i.low_stock_level, i.composition,
         i.created_at, i.updated_at
  from items i
  where i.shop_id = p_shop_id
  order by i.name;
end;
$$;

-- --------------------------------------------------------------------------
-- Low-stock and near-expiry, computed server-side so a dashboard on any
-- device agrees with every other device rather than depending on whatever
-- happens to be in that browser's local cache.
-- --------------------------------------------------------------------------
create or replace function shop_stock_alerts(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_low_threshold int;
  v_expiry_days int;
  v_low jsonb;
  v_exp jsonb;
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select coalesce(low_stock_threshold, 5), coalesce(expiry_warn_days, 30)
  into v_low_threshold, v_expiry_days
  from shops where id = p_shop_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.stock), '[]'::jsonb)
  into v_low
  from (
    select i.id, i.name, i.stock, i.category,
           coalesce(i.low_stock_level, v_low_threshold) as reorder_level
    from items i
    where i.shop_id = p_shop_id
      and i.stock <= coalesce(i.low_stock_level, v_low_threshold)
  ) x;

  -- Batch expiry is stored as 'YYYY-MM' or 'YYYY-MM-DD'. A month-only value
  -- means the batch is good through the END of that month, so it is
  -- normalised to the last day rather than the first.
  select coalesce(jsonb_agg(to_jsonb(y) order by y.days_left), '[]'::jsonb)
  into v_exp
  from (
    select i.id, i.name,
           b->>'batch' as batch,
           b->>'expiry' as expiry,
           coalesce((b->>'stock')::int, i.stock) as stock,
           (
             case when b->>'expiry' ~ '^\d{4}-\d{2}$'
                  then ((b->>'expiry' || '-01')::date + interval '1 month - 1 day')::date
                  else (b->>'expiry')::date
             end - current_date
           ) as days_left
    from items i, jsonb_array_elements(coalesce(i.batches, '[]'::jsonb)) b
    where i.shop_id = p_shop_id
      and b->>'expiry' is not null
      and (b->>'expiry' ~ '^\d{4}-\d{2}$' or b->>'expiry' ~ '^\d{4}-\d{2}-\d{2}$')
      and coalesce((b->>'stock')::int, i.stock) > 0
      and (
            case when b->>'expiry' ~ '^\d{4}-\d{2}$'
                 then ((b->>'expiry' || '-01')::date + interval '1 month - 1 day')::date
                 else (b->>'expiry')::date
            end - current_date
          ) <= v_expiry_days
  ) y;

  return jsonb_build_object(
    'low_stock', v_low,
    'expiring', v_exp,
    'low_stock_threshold', v_low_threshold,
    'expiry_warn_days', v_expiry_days
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Same-composition alternatives for an out-of-stock medicine.
-- --------------------------------------------------------------------------
create or replace function find_alternative_medicines(p_shop_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_comp text;
  v_out jsonb;
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select lower(trim(composition)) into v_comp
  from items where id = p_item_id and shop_id = p_shop_id;

  if v_comp is null or v_comp = '' then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.exact_match desc, a.stock desc), '[]'::jsonb)
  into v_out
  from (
    select i.id, i.name, i.composition, i.stock, i.price,
           (lower(trim(i.composition)) = v_comp) as exact_match
    from items i
    where i.shop_id = p_shop_id
      and i.id <> p_item_id
      and i.category = 'Pharmacy'
      and i.stock > 0
      and i.composition is not null
      and (
        lower(trim(i.composition)) = v_comp
        or lower(trim(i.composition)) like '%' || split_part(v_comp, ' ', 1) || '%'
      )
    limit 6
  ) a;

  return v_out;
end;
$$;
