-- ==========================================================================
-- 0010 — ATOMIC SHOP SIGNUP (fixes a confirmed production bug)
--
-- THE BUG: `shops` and `profiles` have never had an INSERT policy, in any
-- migration from 0001 onward. Confirmed against the live Supabase project's
-- pg_policies (2026-09-17): the deployed policies match these migration
-- files exactly — profiles_select, profiles_update_self, shops_select,
-- shops_update_owner, and nothing else. supabaseClient.js's
-- createShopForCurrentUser() does plain client-side inserts into both
-- tables as the newly-authenticated user (no service-role key) — under RLS
-- with no matching policy, every one of those inserts is rejected. New-shop
-- registration has been broken in production this whole time.
--
-- THE FIX IS NOT "add an INSERT policy" — a naive
--   create policy shops_insert on shops for insert with check (auth.uid() is not null);
--   create policy profiles_insert on profiles for insert with check (id = auth.uid());
-- has a real hole: nothing in that second policy stops an authenticated
-- user from self-inserting a profiles row with role='owner' pointing at an
-- EXISTING shop_id someone else already owns, hijacking that shop. This
-- migration instead follows the same pattern already used for cashier
-- creation (assign_staff_to_shop() in 0004): a security definer RPC that
-- performs both inserts atomically, inside one transaction, with its own
-- authorization checks — RLS on shops/profiles stays exactly as
-- restrictive as it already is (no new insert policy added at all), and
-- this is the only sanctioned way to create a shop from the client.
-- ==========================================================================

create or replace function create_shop_for_current_user(
  p_name        text,
  p_owner_name  text,
  p_phone       text,
  p_address     text,
  p_email       text default null,
  p_gstin       text default null,
  p_state_code  text default null,
  p_industry    text default 'All',
  p_is_locked   boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid   uuid := auth.uid();
  v_shop  shops%rowtype;
begin
  if v_uid is null then
    raise exception 'Must be signed in to register a shop';
  end if;

  -- One profile per auth user, enforced here rather than relying on the
  -- primary key alone: without this check, a user who somehow already has
  -- a profile (e.g. staff added to an existing shop) could call this RPC
  -- to silently create and attach themselves to a second shop, orphaning
  -- their original one. `profiles.id` is still the real, final backstop.
  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'This account is already linked to a shop';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Shop name is required';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Phone number is required';
  end if;
  if coalesce(trim(p_address), '') = '' then
    raise exception 'Address is required';
  end if;

  insert into shops (name, owner_name, phone, email, address, gstin, state_code, industry, is_locked)
  values (
    trim(p_name), nullif(trim(p_owner_name), ''), trim(p_phone), nullif(trim(p_email), ''),
    trim(p_address), nullif(trim(p_gstin), ''), nullif(trim(p_state_code), ''),
    coalesce(nullif(trim(p_industry), ''), 'All'), coalesce(p_is_locked, false)
  )
  returning * into v_shop;

  insert into profiles (id, shop_id, role, full_name)
  values (v_uid, v_shop.id, 'owner', coalesce(nullif(trim(p_owner_name), ''), trim(p_name)));

  return to_jsonb(v_shop);
end;
$$;
