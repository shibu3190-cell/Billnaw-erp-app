# BILLNAW ERP/POS — Security Report

Date: 2026-09-15
Basis: AUDIT_REPORT.md findings, read-only follow-up. No code changed to produce this report.

---

## 1. Executive Summary

**Updated 2026-09-17**: the database/RLS layer's core design is sound and now automated-test-proven (§3) — tenant isolation, role redaction, and RPC idempotency all hold under a real RLS-enforced connection, not just on paper. But building that test suite surfaced one real gap the earlier read-only review missed: **`shops`/`profiles` have no INSERT policy anywhere in the migration files (F0, new, HIGH)** — either new-shop signup is broken in production, or the live database has policies undocumented in this repository. This needs checking against the live Supabase project before anything else in this report. The remaining weak points are all in the frontend/edge-function layer, not the data layer: inconsistent XSS escaping discipline across 99 `innerHTML` sites, a stale duplicate edge function with no input hardening, and no rate limiting on a paid third-party API call. None of the MEDIUM/LOW findings require weakening RLS, touching production data, or changing financial logic to fix — F0 does touch RLS, which is exactly why it needs your explicit go-ahead before any fix is applied.

## 2. Findings by Severity

### HIGH (confirmed by automated test, added 2026-09-17)

**F0 — No INSERT policy exists for `shops` or `profiles`; new-shop signup may be broken or running on undocumented live policies**
- Confirmed by `tests/rpc-rls-tests.js` running against a real PostgreSQL 16 instance with every migration applied and RLS genuinely enforced (connected as a non-owner role, not the superuser bypass a careless test setup would silently rely on): a plain `insert into shops (...)` and `insert into profiles (...)`, run exactly as `supabaseClient.js`'s `createShopForCurrentUser()` performs them (client-side inserts under the `authenticated` role, no service-role key), are both rejected with "new row violates row-level security policy." Grepped all 9 migration files — no `create policy ... for insert` (or a `for all` with an insert-capable `with check`) targets either table anywhere.
- **Impact**: one of two things is true, and both need resolving:
  1. **If the live Supabase project's policies match these migration files exactly**, new-shop registration is broken in production — `createShopForCurrentUser()` cannot succeed for any new signup, at all, via the anon/authenticated client.
  2. **If new-shop signup currently works in production**, the live database has an INSERT policy (or an equivalent trigger/RPC) that was added outside these migration files — e.g. via the Supabase dashboard — meaning the migrations directory no longer fully describes the deployed schema. This is exactly the "static review vs. live enforcement can diverge" risk flagged in this report's §3 before it was possible to test directly; it's now a confirmed, not hypothetical, divergence risk.
- **Fix**: **do not guess which case is true — check the live Supabase project's Table Editor → shops/profiles → RLS policies directly.** If case 1, add a migration granting a scoped INSERT policy (e.g. `with check (id = auth.uid())` for the caller's own profile row post-shop-creation, and a shop-insert policy scoped by the authenticated user not yet having a profile) or move shop/profile creation behind a `security definer` RPC the same way `assign_staff_to_shop()` already does for cashier creation — this is an RLS change and **requires explicit approval before applying**, per this project's own AI Agent Permissions rules. If case 2, write a migration that captures the live policy so the repository stops silently disagreeing with production, then re-run this test to confirm it now passes.
- Two tests in `tests/rpc-rls-tests.js` document this gap explicitly (they currently pass because they assert the rejection happens, not because anything is fixed): if either ever starts failing because the insert unexpectedly succeeds, that means a migration closed the gap — delete the test at that point rather than "fixing" it to expect success.

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

One finding fell out of building this suite: **F0 above (no INSERT policy on `shops`/`profiles`)** — a real, previously-untested gap the manual RUNBOOK TEST 12 would not have caught, since TEST 12 assumes registration itself already works and starts from "register a second shop," not from verifying the registration insert survives RLS on its own.

**Still not verified by this pass**: whether the *live* Supabase project's policies match these migration files exactly (see F0) — that requires checking the live dashboard directly, which this test suite cannot do from a local Postgres instance. RUNBOOK.md's TEST 12 (manual, live-environment) remains the way to confirm that specific question, and should still be run before treating production as verified.

## 4. Secrets Policy Compliance

Compliant. No service-role key, Gemini key, JWT secret, or database password found in any tracked file. `GEMINI_API_KEY` correctly lives server-side only (`Deno.env.get`). No action needed; no rotation recommended (no exposure found).

## 5. Recommended Security Work Order

1. **F0 (new-shop signup INSERT policy gap)** — check the live Supabase project's actual policies on `shops`/`profiles` first; this determines whether you're fixing a broken signup flow or reconciling an undocumented live policy into the migration history. Either resolution touches RLS and needs your explicit approval before it's applied.
2. ~~Confirm and resolve F1 (duplicate edge function)~~ — resolved; `supabase/functions/index.ts` was removed (see git history).
3. Run RUNBOOK TEST 12 live specifically to confirm the *live* project's policies match what `tests/rpc-rls-tests.js` now proves about the migration files — the automated suite closes the "static vs. live" gap for everything except this one open question.
4. Begin F2 (XSS audit-and-patch) as a standalone, incrementally-committed effort — independent of the React/TS migration, should not wait for it.
5. F3 (rate limiting) and F4 (idempotency matching) — low-risk additive changes, can be scheduled alongside ongoing tooling work.
6. F5 (silent row-skip) — hold until financial-logic-change process (before/after tests, Golden Rule §17) is set up; do not rush a financial RPC change ahead of that scaffolding.

F0 aside (which is a real, live-environment question, not a migration blocker), none of these findings block continued modernization work.
