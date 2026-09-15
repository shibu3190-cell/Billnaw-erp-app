# BILLNAW ERP/POS — Security Report

Date: 2026-09-15 (Phase 1 baseline) — extended below with Phase 2–4 verification.
Basis: `docs/AUDIT_REPORT.md` findings, read-only follow-up. No code changed to produce this report.

---

## 0. Phase 2–4 Verification (new)

- **F1 (duplicate stale edge function) — RESOLVED.** Verified this pass: `supabase/functions/` now contains only `ai-invoice-parse/`. `supabase/functions/index.ts` no longer exists in the working tree. *(This audit did not check the Supabase Dashboard to confirm nothing was ever deployed under that old function; that live-side confirmation from the original F1 recommendation was never explicitly checked off in the git history available here — treat as very likely resolved, not certainly reconfirmed live.)*
- **F2 (XSS coverage gap) — UNCHANGED, NOT STARTED.** `innerHTML`/`outerHTML` call-site count is still exactly 99 (81 in app.js + 6 in customers.js + 5 in settings.js + 7 in purchases.js — the split moved code, didn't add or remove sites). Still only 3 spots have regression coverage. Phase 2–4 correctly did not attempt to fix this opportunistically during a structural-only migration phase — bundling a security fix into a "verbatim relocation" commit would have made both harder to review. This remains open, unstarted work.
- **F3 (no rate limiting on ai-invoice-parse) — UNCHANGED, NOT STARTED.**
- **F4 (brittle idempotency string-matching) — UNCHANGED, NOT STARTED.**
- **F5 (silent partial-row skip in atomic RPCs) — UNCHANGED, NOT STARTED.** Correctly untouched — this is financial-RPC surface and Phase 2–4 was scoped to frontend structure only.
- **New observation**: the `purchases.js` extraction (Phase 4, highest-stakes slice per its own header comment) calls the same `create_purchase_atomic`/stock-decrement RPCs as before, with the same arguments — verified by reading the file; no new call sites, no new parameters, no new client-side validation added or removed. This is a genuinely verbatim move on the RPC-calling surface, which is the correct thing to confirm before trusting the "no logic changed" claim in its header comment.
- **New observation**: `npm ci` / `npm test` / `tsc --noEmit` were run to verify build integrity for this report. None of these commands write to Supabase, touch RLS, or modify source files — consistent with an audit-only pass.

## 1. Executive Summary

The database/RLS layer is sound: every tenant table is scoped and enforced server-side, role-based financial redaction happens in Postgres functions rather than the client, and the atomic invoice/purchase/return RPCs are genuinely idempotent. The weak points are all in the frontend/edge-function layer, not the data layer: inconsistent XSS escaping discipline across 99 `innerHTML` sites (unchanged by the Phase 2–4 structural work) and no rate limiting on a paid third-party API call. The one previously-open MEDIUM finding involving live infrastructure (the duplicate edge function) is now resolved. None of the remaining findings require weakening RLS, touching production data, or changing financial logic to fix.

## 2. Findings by Severity

### MEDIUM

**~~F1 — Duplicate stale edge function~~ — RESOLVED** (see §0). No action required; carried here for audit-trail continuity only.

**F2 — XSS coverage gap** *(open)*
- 99 `innerHTML`/`outerHTML` sites across `app.js`, `customers.js`, `settings.js`, `purchases.js`; 2 escaping helpers (`esc`, `escJs`), applied manually and inconsistently. Only 3 spots have regression test coverage (`tests/run-tests.js`), all from a prior hardening pass (`sw.js` cache name literally documents this as `v23.0-invoice-xss-hardening`).
- **Impact if exploited**: stored XSS via any un-escaped interpolation path — e.g., a product/vendor name from AI-parsed invoice OCR, a customer name, or a server error string — rendered into an owner's or cashier's browser session. RLS still bounds it to that shop, limiting blast radius to single-tenant.
- **Fix (staged, non-destructive)**: audit-only pass first — grep every `innerHTML =`/`.insertAdjacentHTML` call site across all 4 files now, classify as (a) static/trusted HTML, (b) already escaped, (c) needs escaping. Patch category (c) incrementally with test coverage added per site, following the exact pattern the 3 existing regression tests already establish.

### LOW

**F3 — No rate limiting on `ai-invoice-parse`** *(open, unchanged)*
- Any authenticated non-cashier, active-shop user can call the Gemini-backed OCR endpoint with no app-level quota. Cost/DoS risk against the Gemini bill, not a data-security issue.
- **Fix**: add a per-shop or per-user request-count check as a new additive migration (`0010_...`).

**F4 — Brittle idempotency string-matching in offline sync** *(open, unchanged)*
- `isFatalSyncError()` (still in `app.js`) regex-matches the literal string `"duplicate key"` in Postgres error text.
- **Fix**: match SQLSTATE `23505` if exposed through the Supabase client error shape, rather than message text. Validate against the actual error object before changing.

**F5 — Silent partial-row skip in atomic RPCs** *(open, unchanged)*
- `create_invoice_atomic`/`create_purchase_atomic`/`process_sales_return_atomic` use `exception when others then continue` on malformed line items instead of surfacing an error.
- **Fix**: append skipped lines to a `warnings` array already returned by these RPCs (pattern already exists for the AI reconciliation path). Additive to the return payload — but touches financial RPCs, so requires the full Safety Gate checklist and before/after tests.

### INFORMATIONAL (no action required)

- Hardcoded Supabase URL/anon key in `supabaseClient.js` — correct by design.
- `subscription_plans`'s `USING (true)` RLS policy — deliberate public read-only pricing catalogue.
- No leaked service-role key, Gemini key, or other secret found anywhere in the repository, including the new `src/`, `docs/`, `vite.config.mjs`, `package.json`/`package-lock.json` added in Phase 2–4 (re-verified this pass by grep for `service_role`, `sk-`, `AIza`, and similar patterns across the full tree — no hits besides comments/placeholders).

## 3. Tenant Isolation Verification

Static verification (unchanged since Phase 1): every tenant table (`items`, `customers`, `sales`, `ai_purchase_staging`, `sales_returns`, `vendors`, `purchases`, `vendor_divisions`) has `shop_id` + RLS with the `my_shop_id()`/`shop_is_active()` pattern, no bypass policy found. Phase 2–4 made zero changes to any `.sql` file — this conclusion is unaffected by the structural JS work.

**Update, 2026-09-15**: TEST 12 has now been run live — see §6 below. It did not confirm isolation on first run; it found a real, live cross-tenant leak on `shops`, now fixed and re-verified. The other tenant tables (`items`, `customers`) checked clean both before and after the fix — the leak was isolated to `shops`'s dashboard-drifted policies, not the migrated pattern generally.

## 4. Secrets Policy Compliance

Compliant, re-verified this pass across the full current tree (including all files added since Phase 1). No service-role key, Gemini key, JWT secret, or database password found in any tracked file.

## 5. Live Incident — Confirmed Cross-Tenant Leak, Found and Fixed 2026-09-15

Running RUNBOOK.md TEST 12 live against the project's dev Supabase instance (per the user's explicit go-ahead, using only the public anon key — the same access level any real client has) surfaced a **confirmed, live cross-tenant data leak on `shops`**, independent of and beyond anything the static Phase 1/2 audits could detect from source review alone.

**What was found**: the live database had two RLS policies on `shops` that do not exist in any file under `supabase/migrations/` — dashboard-added drift, exactly the risk `docs/AUDIT_REPORT.md` and this report's Phase 1 baseline both flagged as plausible but unverified:
- `"Allow authenticated selects"` (SELECT, to `authenticated`) — `using (true)`. Unconditional. Confirmed live: a brand-new authenticated user with zero profile rows could read every shop's row via the anon-key REST API, including `phone`, `address`, `gstin`, `bank_name`, `bank_acc`, `bank_ifsc`, and `upi_id` — every tenant's banking details exposed to every other tenant.
- `"shops_select_authenticated"` (SELECT, to `public`) — correctly scoped to the caller's own shop, but missing the `status = 'active'` check present in the migrated `shops_select` policy, which would have let a revoked shop's own owner keep reading it (bypassing the TEST 12 step 4/5 lockout check independent of the leak above).

Postgres OR's multiple permissive policies of the same command together, so the correctly-written `shops_select` (from `0001_init.sql`) was present the entire time and made no difference — the table was only as strict as its loosest permissive policy.

**Fix, `supabase/migrations/0010_fix_shops_rls_leak.sql`**: drops both undocumented policies, leaving `shops_select` as the sole SELECT policy on `shops`. Verified live by re-running the isolation check after the drop: a second tenant's token returned zero rows from `shops`, `items`, and `customers` belonging to the first (previously it returned an unrelated real shop's name).

**Regression this exposed, and its fix**: removing the leaky policy broke real shop signup. `signUpShop()`/`createShopForCurrentUser()` (`supabaseClient.js`) created a shop via `.insert(...).select().single()` — Postgres requires an `INSERT ... RETURNING` row to satisfy the table's SELECT policy, not just the INSERT policy's `WITH CHECK`, and a brand-new user has no profile yet at the moment their shop is inserted, so `shops_select`'s `id = my_shop_id()` fails for their own row. The leaky policy had been silently the only reason this worked. This was compounded by a second, independent, pre-existing bug: the shop insert and profile insert were two separate client calls with no atomicity — a failure between them left an orphaned, ownerless shop, the exact class of bug `create_invoice_atomic`/`create_purchase_atomic`/`process_sales_return_atomic` exist to prevent elsewhere, never applied to signup itself.

**Fix, `supabase/migrations/0011_atomic_shop_signup.sql`**: a new `SECURITY DEFINER` RPC, `create_shop_and_owner(p_shop, p_owner_name)`, creates the shop and owner profile atomically server-side (rejecting a caller who already has a profile), returning the shop row. `signUpShop()` and `createShopForCurrentUser()` (both `supabaseClient.js` and its typed mirror `src/services/supabase/index.ts`, kept in lockstep and re-verified against `tests/supabase-parity.js`) now call this RPC instead of two raw inserts. Verified live end-to-end: a fresh signup, RPC call, and read-back of both the created shop and profile by the new owner all succeeded.

**Residual, deliberately not fixed in this pass**: `shops` still carries two INSERT policies (`Allow authenticated inserts`, `shops_insert_authenticated`, both effectively `with check (true)`/`auth.uid() is not null`) that predate the RPC and are no longer the only way to create a shop row. Nothing currently exploits this beyond what was already true (any authenticated user could always insert a shop row), but now that `create_shop_and_owner` is the intended single path, these are candidates for removal in a follow-up hardening migration — not bundled here to keep this fix minimal and reviewable. `profiles`' two policies (`profiles_select`, `profiles_update_self`) were checked live and confirmed to match the migrations exactly — no drift found there.

**F1 status correction**: the original F1 finding (stale duplicate edge function) remains resolved as recorded in §0. This new finding is tracked separately as it was discovered live, not via source review, and root-caused to dashboard drift rather than anything in the JS/TS codebase.

## 6. Recommended Security Work Order (updated)

1. ~~Confirm and resolve F1~~ — **Done.**
2. ~~Run RUNBOOK TEST 12 live~~ — **Done.** Found and fixed a real leak (§5) — not a clean pass, but the item is closed.
3. **New, from §5**: remove the two now-redundant `shops` INSERT policies (`Allow authenticated inserts`, `shops_insert_authenticated`) now that `create_shop_and_owner` is the intended single signup path — low-risk hardening, not urgent, but tracked so it isn't forgotten.
4. **New, from §5**: audit every other tenant table's live policy list against its migration file the same way `shops` was just checked — this incident proved dashboard drift is real, not hypothetical, and `shops` was only checked because TEST 12 happens to touch it. `items`, `customers`, `sales`, `sales_returns`, `vendors`, `purchases`, `vendor_divisions`, `ai_purchase_staging` have not had the same live-vs-migration diff performed.
5. Begin F2 (XSS audit-and-patch) as a standalone effort across all 4 files that now contain interpolation sites (`app.js`, `customers.js`, `settings.js`, `purchases.js`) — independent of the React/TS migration.
6. Add a parity test for `settings.js`/`customers.js`/`purchases.js` (see `docs/AUDIT_REPORT.md` §9 gap) before any further `app.js` extraction.
7. F3 and F4 — low-risk additive changes, can be scheduled alongside further build tooling work.
8. F5 — hold until financial-logic-change process (before/after tests, Safety Gate) is set up; do not rush a financial RPC change ahead of that scaffolding.

None of these findings block continuing the structural migration (further Phase 4 work) described in `docs/MIGRATION_PLAN.md`.
