# BILLNAW ERP/POS — Security Report

Date: 2026-09-15
Basis: AUDIT_REPORT.md findings, read-only follow-up. No code changed to produce this report.

---

## 1. Executive Summary

**Updated 2026-09-17**: the database/RLS layer's core design is sound and now automated-test-proven (§3) — tenant isolation, role redaction, and RPC idempotency all hold under a real RLS-enforced connection, not just on paper. But building that test suite surfaced one real gap the earlier read-only review missed: **`shops`/`profiles` have no INSERT policy anywhere in the migration files (F0, new, HIGH)** — either new-shop signup is broken in production, or the live database has policies undocumented in this repository. This needs checking against the live Supabase project before anything else in this report. The remaining weak points are all in the frontend/edge-function layer, not the data layer: inconsistent XSS escaping discipline across 99 `innerHTML` sites, a stale duplicate edge function with no input hardening, and no rate limiting on a paid third-party API call. None of the MEDIUM/LOW findings require weakening RLS, touching production data, or changing financial logic to fix — F0 does touch RLS, which is exactly why it needs your explicit go-ahead before any fix is applied.

## 2. Findings by Severity

### RESOLVED

**F0 — No INSERT policy existed for `shops` or `profiles`; new-shop signup was broken in production — FIXED 2026-09-17**
- **Confirmed against the live Supabase project directly** (not just the migration files): queried `pg_policies` on the live database for `shops`/`profiles` and got back exactly `profiles_select`, `profiles_update_self`, `shops_select`, `shops_update_owner` — no INSERT policy, live or on disk. This was Case 1 from this finding's original writeup: the deployed database matched the migration files exactly, which meant `createShopForCurrentUser()`'s plain client-side inserts were being rejected by RLS in production. New-shop registration was broken, confirmed, not hypothetical.
- **Fix applied**: migration `0010_shop_signup_atomic.sql` adds `create_shop_for_current_user(...)`, a `security definer` RPC that creates the shop and the caller's own `owner` profile atomically in one transaction — the same pattern already used for cashier creation (`assign_staff_to_shop()`, 0004). **No INSERT policy was added to either table** — a raw `profiles` INSERT policy can't safely stop a user from attaching themselves to an existing `shop_id` they don't own, so direct client inserts into both tables remain correctly rejected; the RPC is the only sanctioned path. `supabaseClient.js`'s `createShopForCurrentUser()` now calls this RPC instead of raw `.insert()`.
- **Verified, not just written**: `tests/rpc-rls-tests.js` (now 33 checks) proves, against a real local Postgres instance with migration 0010 applied: a brand-new authenticated user can register a shop and gets an atomically-created owner profile; the same user is rejected on a second signup attempt (prevents duplicate/orphaned shops); an existing staff member (already has a profile) is rejected from using this RPC to attach themselves to a different shop (the anti-hijack guard); an unauthenticated call is rejected outright; and raw inserts into `shops`/`profiles` remain blocked exactly as before, confirming no new bypass was introduced.
- **Still needs**: applying `0010_shop_signup_atomic.sql` to the live Supabase project (this session has no credentials to do that directly) and re-running RUNBOOK TEST 1 (registration) live to confirm the fix lands the same way it did locally.

### MEDIUM

**F1 — Duplicate stale edge function (`supabase/functions/index.ts`)**
- Older, weaker sibling of `ai-invoice-parse/index.ts`. Missing: mime-type allow-list, request size cap, cashier-role rejection, server-side arithmetic reconciliation. Its prompt tells Gemini to guess uncertain values rather than return null — the opposite of the hardened version's policy.
- **Impact if exploited**: if ever redeployed by mistake, a cashier-role account (or anyone authenticated) could submit oversized/wrong-mime payloads, and hallucinated GST/price figures could flow into `ai_purchase_staging` unreconciled.
- **Fix**: confirm via Supabase Dashboard → Edge Functions whether `index.ts`'s function is actually deployed under any name. If not deployed, delete the file. If deployed, redirect callers to the hardened function and then delete. **This is a stop-and-confirm item** — deleting a file is low-risk to the running app, but confirms via the Safety Gate before action.

**F2 — XSS coverage gap**
- 99 `innerHTML`/`outerHTML` sites in app.js, 2 escaping helpers (`esc`, `escJs`), applied manually and inconsistently. Only 3 spots have regression test coverage (`tests/run-tests.js`), all from a prior hardening pass (`sw.js` cache name literally documents this as `v23.0-invoice-xss-hardening`).
- **Impact if exploited**: stored XSS via any un-escaped interpolation path — e.g., a product/vendor name from AI-parsed invoice OCR, a customer name, or a server error string — rendered into an owner's or cashier's browser session, potentially enabling session/data access within that tenant's own scope (RLS still bounds it to that shop, limiting blast radius to single-tenant).
- **Fix (staged, non-destructive)**: audit-only pass first — grep every `innerHTML =`/`.insertAdjacentHTML` call site, classify as (a) static/trusted HTML, (b) already escaped, (c) needs escaping. Patch category (c) incrementally with test coverage added per site. No architecture change required; this is a discipline/coverage fix, not a redesign.

### LOW

**F3 — No rate limiting on `ai-invoice-parse`**
- Any authenticated non-cashier, active-shop user can call the Gemini-backed OCR endpoint with no app-level quota.
- **Impact**: cost/DoS risk against the Gemini bill if an account is compromised or misused. Not a data-security issue — the function already validates auth, role, shop status, mime type, and size.
- **Fix**: add a per-shop or per-user request-count check (e.g., a `rate_limit` table or Postgres-side counter checked before invoking Gemini) as a new migration. Additive, no existing behavior changes.

**F4 — Brittle idempotency string-matching in offline sync**
- `isFatalSyncError()` regex-matches the literal string `"duplicate key"` in Postgres error text to distinguish "already synced" from a real failure.
- **Impact**: a Postgres version/locale change altering that exact wording could cause either an infinite re-queue loop or, worse, a real failure being silently swallowed as "already synced."
- **Fix**: prefer matching Postgres SQLSTATE `23505` (unique_violation) if the error object exposes it through the Supabase client, rather than message text. Should be validated against the actual error shape returned by `SB.saveSale` etc. before changing.

**F5 — Silent partial-row skip in atomic RPCs**
- `create_invoice_atomic`/`create_purchase_atomic`/`process_sales_return_atomic` use `exception when others then continue` on malformed line items instead of surfacing an error.
- **Impact**: a shop owner gets no visible warning if a line item is silently dropped (e.g., invalid UUID in a stock-decrement loop) — could produce an invoice that doesn't match what was rung up, discovered only later during reconciliation.
- **Fix**: change silent `continue` to append the skipped line to a `warnings` array already returned by these RPCs (the pattern already exists for the AI reconciliation path) so the client can display "N line(s) could not be processed." This is additive to the return payload, not a change to accepted/rejected transaction outcomes — low risk, but touches financial RPCs, so **requires the full Safety Gate checklist and before/after tests** per Golden Rule §17.

### INFORMATIONAL (no action required)

- Hardcoded Supabase URL/anon key in `supabaseClient.js` — correct by design; anon key is meant to be public, RLS is the real boundary. No finding.
- `subscription_plans`'s `USING (true)` RLS policy — deliberately public read-only pricing catalogue, no write policy exists. No finding.
- No leaked service-role key, Gemini key, or other secret found anywhere in the repository (verified by targeted grep across all files, including migrations and docs).

## 3. Tenant Isolation Verification

**Updated 2026-09-17 — now verified by automated test, not just static review.** `tests/rpc-rls-tests.js` (`npm run test:rpc`) runs 29 checks against a real PostgreSQL 16 instance with every migration in `supabase/migrations/` applied exactly as Supabase would apply them, connected as a genuinely non-superuser, non-table-owner role so RLS is actually enforced (not bypassed, which is what running as the migration-owner or a superuser would silently do). Confirmed directly, by executing the operations rather than reading the policy SQL and inferring:

- Two shops' owners cannot SELECT, UPDATE, DELETE, or INSERT into each other's `items` (and by the identical policy pattern, `customers`/`sales`/`vendors`/`ai_purchase_staging`) — cross-tenant writes return 0 rows affected, cross-tenant inserts are rejected outright, cross-tenant reads return zero rows, not an error that could be probed for existence.
- `super_admin` correctly sees across tenants; a revoked shop's owner loses all data access immediately via `shop_is_active()`, and access is restored the moment the shop is reactivated.
- Role-based financial redaction is enforced in the database, not just hopeful client code: `fetch_items_for_role` returns real `cost` to an owner and `NULL` to a cashier for the identical row; `shop_profit_summary` raises an exception for cashiers rather than returning a redacted figure; the `purchases` table is invisible to cashiers entirely (RLS-level exclusion, not per-field redaction).
- `create_invoice_atomic`, `process_sales_return_atomic`, and `decrement_item_stock` all correctly reject cross-tenant calls, reject operations that would take stock negative (rolling back the whole transaction, confirmed via a follow-up query — no orphaned row), and are genuinely idempotent (replaying the same `idempotency_key` returns the original row and does not double-decrement stock or double-count customer dues).
- `audit_log` is confirmed append-only at the database level for every role including `super_admin`: insert succeeds, select/update/delete all return zero rows/zero affected, exactly as SECURITY_REPORT.md's `INFORMATIONAL` note already described — now proven, not just read from the policy SQL.

One finding fell out of building this suite, confirmed against the live project, and is now fixed: **F0 above (no INSERT policy on `shops`/`profiles`, new-shop signup broken in production)** — a real gap the manual RUNBOOK TEST 12 would not have caught, since TEST 12 assumes registration itself already works and starts from "register a second shop," not from verifying the registration insert survives RLS on its own. Migration `0010_shop_signup_atomic.sql` fixes it via a security-definer RPC rather than a raw INSERT policy, verified by 4 new tests including an explicit anti-hijack check.

**Still not verified by this pass**: that migration 0010 has actually been applied to the *live* Supabase project — this session has no credentials to apply it directly. RUNBOOK.md's TEST 1 (registration) should be re-run live once it's applied, to confirm the fix lands there the same way it did against the local test instance.

## 4. Secrets Policy Compliance

Compliant. No service-role key, Gemini key, JWT secret, or database password found in any tracked file. `GEMINI_API_KEY` correctly lives server-side only (`Deno.env.get`). No action needed; no rotation recommended (no exposure found).

## 5. Recommended Security Work Order

1. **Apply `0010_shop_signup_atomic.sql` to the live Supabase project** (SQL Editor → paste → Run, same as every prior migration per RUNBOOK.md §2.3), then re-run RUNBOOK TEST 1 (registration) live to confirm new-shop signup actually works end to end now.
2. ~~Confirm and resolve F1 (duplicate edge function)~~ — resolved; `supabase/functions/index.ts` was removed (see git history).
3. Begin F2 (XSS audit-and-patch) as a standalone, incrementally-committed effort — independent of the React/TS migration, should not wait for it.
4. F3 (rate limiting) and F4 (idempotency matching) — low-risk additive changes, can be scheduled alongside ongoing tooling work.
5. F5 (silent row-skip) — hold until financial-logic-change process (before/after tests, Golden Rule §17) is set up; do not rush a financial RPC change ahead of that scaffolding.

None of the remaining findings block continued modernization work.
