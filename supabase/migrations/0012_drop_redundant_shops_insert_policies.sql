-- ==========================================================================
-- HARDENING: remove now-redundant client-side INSERT policies on `shops`
-- ==========================================================================
-- Background: 0011_atomic_shop_signup.sql made create_shop_and_owner(...),
-- a SECURITY DEFINER function, the intended sole path for creating a shop
-- row. supabaseClient.js's signUpShop()/createShopForCurrentUser() (and
-- their typed mirror in src/services/supabase/index.ts) were updated to
-- call it instead of a raw `.from('shops').insert(...)`.
--
-- That left two pre-existing, dashboard-added INSERT policies on `shops`
-- with no remaining caller:
--   "Allow authenticated inserts"   with check (true)
--   "shops_insert_authenticated"    with check (auth.uid() is not null)
-- Confirmed via `grep -rn "from('shops').insert"` across the repo: no
-- code path uses a raw client-side insert into shops anymore. Both
-- policies were effectively unconditional (any authenticated user could
-- insert an arbitrary shop row via the anon-key REST API directly,
-- bypassing the app entirely) — not a data leak on their own (INSERT
-- can't expose existing rows), but unnecessary attack surface now that
-- create_shop_and_owner is the only path the app itself uses.
--
-- create_shop_and_owner runs as SECURITY DEFINER, so it does not need
-- (and never needed) these client-facing INSERT policies to function —
-- dropping them does not affect signup.
-- ==========================================================================

drop policy if exists "Allow authenticated inserts" on shops;
drop policy if exists "shops_insert_authenticated" on shops;
