-- ==========================================================================
-- 0008 — SUBSCRIPTION PLANS
-- Run after 0001–0007.
--
-- DESIGN INTENT: "the app is free for now" must not mean hardcoding
-- `if (true)` in the client. Plans, prices and feature flags live in the
-- database so a real pricing change later is a row update from the
-- Supabase dashboard — no app deploy, no code change, no re-review of the
-- client bundle. Every shop is assigned the 'free' plan today, and that
-- plan's `all_features_unlocked` flag is what actually grants access, not
-- an absence of gating logic.
-- ==========================================================================

create table if not exists subscription_plans (
  id                    text primary key,          -- 'free', 'starter', 'pro', ...
  name                  text not null,
  price_monthly         numeric not null default 0,
  currency              text not null default 'INR',
  max_staff_accounts    int,                        -- null = unlimited
  max_invoices_monthly  int,                        -- null = unlimited
  all_features_unlocked boolean not null default false,
  features              jsonb not null default '[]', -- ordered list of {label, included}
  is_purchasable        boolean not null default false, -- false = "Coming soon", not clickable
  display_order         int not null default 0,
  created_at            timestamptz not null default now()
);

-- Anyone signed in can read the plan catalogue — it's what powers the
-- Settings → Subscription screen, and pricing is not sensitive data.
alter table subscription_plans enable row level security;
drop policy if exists plans_read_all on subscription_plans;
create policy plans_read_all on subscription_plans for select using (true);
-- No insert/update/delete policy for authenticated users: plan changes are
-- a Supabase-dashboard action (service_role or the SQL editor), not
-- something the app or any shop can perform on itself.

insert into subscription_plans (id, name, price_monthly, max_staff_accounts, max_invoices_monthly, all_features_unlocked, features, is_purchasable, display_order)
values
  ('free', 'Free Access', 0,
   null, null, true,
   '[
     {"label":"Unlimited invoices","included":true},
     {"label":"Unlimited staff accounts","included":true},
     {"label":"AI purchase entry (Gemini OCR)","included":true},
     {"label":"GST reports & GSTR-1 summary","included":true},
     {"label":"Sales returns & credit notes","included":true},
     {"label":"Thermal + A4 + dot-matrix printing","included":true},
     {"label":"Low-stock & expiry alerts","included":true},
     {"label":"Everything, unlocked, while the app is in its free access period","included":true}
   ]'::jsonb,
   false, 1)
on conflict (id) do nothing;

-- Future plans exist as rows now so the Settings screen has something real
-- to show under "Coming later" instead of empty space — but is_purchasable
-- is false, so nothing in the UI lets anyone attempt to buy them. Turning
-- one on later is: set is_purchasable = true, and give shops a plan_id
-- other than 'free'. No app code changes.
insert into subscription_plans (id, name, price_monthly, max_staff_accounts, max_invoices_monthly, all_features_unlocked, features, is_purchasable, display_order)
values
  ('starter', 'Starter', 999, 1, 500, false,
   '[
     {"label":"1 staff account","included":true},
     {"label":"Up to 500 invoices/month","included":true},
     {"label":"Thermal print support","included":true},
     {"label":"Basic GST reports","included":true},
     {"label":"AI purchase entry (Gemini OCR)","included":false},
     {"label":"Priority support","included":false}
   ]'::jsonb,
   false, 2),
  ('pro', 'Pro', 2499, 5, null, false,
   '[
     {"label":"Up to 5 staff accounts","included":true},
     {"label":"Unlimited invoices","included":true},
     {"label":"AI purchase entry (Gemini OCR)","included":true},
     {"label":"GSTR-1 auto-preparation","included":true},
     {"label":"Priority support","included":true}
   ]'::jsonb,
   false, 3)
on conflict (id) do nothing;

-- Every shop needs a plan. Existing shops backfill to 'free'; new shops get
-- it via the column default.
alter table shops add column if not exists plan_id text not null default 'free'
  references subscription_plans(id);
update shops set plan_id = 'free' where plan_id is null;

-- --------------------------------------------------------------------------
-- get_shop_subscription
-- One call returns the shop's plan joined with usage-so-far, so the client
-- can render "847 / Unlimited invoices this month" without a second query
-- and without computing invoice counts itself (which a cashier's redacted
-- read of `sales` might undercount).
-- --------------------------------------------------------------------------
create or replace function get_shop_subscription(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_plan subscription_plans%rowtype;
  v_invoice_count int;
  v_staff_count int;
begin
  if my_role() <> 'super_admin'
     and (p_shop_id <> my_shop_id() or not shop_is_active(p_shop_id)) then
    raise exception 'Not permitted for this shop';
  end if;

  select sp.* into v_plan
  from shops s join subscription_plans sp on sp.id = s.plan_id
  where s.id = p_shop_id;

  if not found then
    -- A shop somehow pointing at a deleted plan id must not break the
    -- settings screen — fall back to 'free' rather than erroring.
    select * into v_plan from subscription_plans where id = 'free';
  end if;

  select count(*) into v_invoice_count
  from sales where shop_id = p_shop_id
    and created_at >= date_trunc('month', now());

  select count(*) into v_staff_count
  from profiles where shop_id = p_shop_id;

  return jsonb_build_object(
    'plan', to_jsonb(v_plan),
    'usage', jsonb_build_object(
      'invoices_this_month', v_invoice_count,
      'staff_accounts', v_staff_count
    )
  );
end;
$$;

-- --------------------------------------------------------------------------
-- shop_has_feature — the actual gate. Currently every shop is on 'free'
-- with all_features_unlocked = true, so this always returns true today.
-- The moment a shop's plan_id is changed by the backend to something with
-- all_features_unlocked = false, this starts returning false for features
-- not in that plan's list — with zero client code changes required.
-- --------------------------------------------------------------------------
create or replace function shop_has_feature(p_shop_id uuid, p_feature_label text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_unlocked boolean;
  v_features jsonb;
  v_match boolean;
begin
  select sp.all_features_unlocked, sp.features
  into v_unlocked, v_features
  from shops s join subscription_plans sp on sp.id = s.plan_id
  where s.id = p_shop_id;

  if v_unlocked then return true; end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(v_features, '[]'::jsonb)) f
    where f->>'label' = p_feature_label and (f->>'included')::boolean = true
  ) into v_match;

  return coalesce(v_match, false);
end;
$$;
