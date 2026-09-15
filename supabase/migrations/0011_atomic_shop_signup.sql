-- ==========================================================================
-- ATOMIC SHOP + OWNER SIGNUP (fixes a regression exposed by 0010)
-- ==========================================================================
-- Background: 0010_fix_shops_rls_leak.sql removed a dashboard-added
-- policy ("Allow authenticated selects", using (true)) that let ANY
-- authenticated user read EVERY shop's row, including banking details
-- (bank_name, bank_acc, bank_ifsc, upi_id). That policy was a real
-- cross-tenant leak, confirmed live via RUNBOOK TEST 12, and removing it
-- was correct.
--
-- But it also, accidentally, was the only reason shop signup worked.
-- signUpShop() / createShopForCurrentUser() (supabaseClient.js) create a
-- shop with two separate client-side calls:
--   1. INSERT into shops, with .select().single() to get the new id
--   2. INSERT into profiles using that id
-- Postgres requires a row returned via INSERT ... RETURNING to satisfy
-- the table's SELECT policy, not just the INSERT policy's WITH CHECK.
-- A brand-new user has no profile yet at the moment step 1 runs, so
-- shops_select's `id = my_shop_id()` fails for their own just-created
-- shop — step 1 itself now errors with 42501, and step 2 never runs.
-- The leaky policy was silently papering over this the whole time.
--
-- This was also a second, independent, pre-existing bug: steps 1 and 2
-- are not atomic. If step 2 ever failed for any other reason (network
-- drop, a constraint violation on profiles), step 1's shop row would be
-- left orphaned — a shop with no owner, forever. The atomic-RPC pattern
-- already used for invoices/purchases/returns (create_invoice_atomic
-- etc.) exists specifically to prevent this class of bug; signup itself
-- never got the same treatment. This migration fixes both problems at
-- once with a single SECURITY DEFINER function, the same pattern as
-- everywhere else financial/identity-critical in this schema.
-- ==========================================================================

create or replace function create_shop_and_owner(p_shop jsonb, p_owner_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_shop shops;
  v_industry text := coalesce(p_shop->>'industry', 'All');
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'This account already belongs to a shop.';
  end if;

  insert into shops (
    name, owner_name, phone, email, address, gstin, state_code, industry, is_locked
  ) values (
    p_shop->>'name',
    p_shop->>'owner_name',
    p_shop->>'phone',
    nullif(p_shop->>'email', ''),
    p_shop->>'address',
    nullif(p_shop->>'gstin', ''),
    p_shop->>'state_code',
    v_industry,
    v_industry <> 'All'
  )
  returning * into v_shop;

  insert into profiles (id, shop_id, role, full_name)
  values (v_uid, v_shop.id, 'owner', p_owner_name);

  return to_jsonb(v_shop);
end;
$$;

grant execute on function create_shop_and_owner(jsonb, text) to authenticated;

-- The raw client-side INSERT policies on shops/profiles predate this RPC
-- and are left in place deliberately, not as an oversight: removing them
-- is a further hardening step (nothing should need to insert into shops
-- directly once this RPC is the only signup path) but is out of scope
-- for this fix-the-regression migration. Tracked as a follow-up in
-- docs/SECURITY_REPORT.md rather than bundled in here.
