# BILLNAW ERP/POS — Security Report

Date: 2026-09-15
Basis: AUDIT_REPORT.md findings, read-only follow-up. No code changed to produce this report.

---

## 1. Executive Summary

The database/RLS layer is sound: every tenant table is scoped and enforced server-side, role-based financial redaction happens in Postgres functions rather than the client, and the atomic invoice/purchase/return RPCs are genuinely idempotent. The weak points are all in the frontend/edge-function layer, not the data layer: inconsistent XSS escaping discipline across 99 `innerHTML` sites, a stale duplicate edge function with no input hardening, and no rate limiting on a paid third-party API call. None of these require weakening RLS, touching production data, or changing financial logic to fix.

## 2. Findings by Severity

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

Static verification (this pass): every tenant table (`items`, `customers`, `sales`, `ai_purchase_staging`, `sales_returns`, `vendors`, `purchases`, `vendor_divisions`) has `shop_id` + RLS with the `my_shop_id()`/`shop_is_active()` pattern, no bypass policy found.

**Not yet verified in this pass**: live runtime behavior. RUNBOOK.md's TEST 12 (register two shops, confirm cross-tenant zero-visibility, confirm revoked-shop lockout) is a manual test that must be **re-run against a live Supabase instance** before this report's tenant-isolation conclusion is treated as fully confirmed — static SQL review and live enforcement can diverge if, e.g., a policy was edited outside the migration files via the dashboard. Recommend running TEST 12 as a required checkpoint before Phase 2 of the migration begins.

## 4. Secrets Policy Compliance

Compliant. No service-role key, Gemini key, JWT secret, or database password found in any tracked file. `GEMINI_API_KEY` correctly lives server-side only (`Deno.env.get`). No action needed; no rotation recommended (no exposure found).

## 5. Recommended Security Work Order

1. Confirm and resolve F1 (duplicate edge function) — quick, isolated, no dependencies.
2. Run RUNBOOK TEST 12 live to confirm tenant isolation holds at runtime, not just in SQL review.
3. Begin F2 (XSS audit-and-patch) as a standalone, incrementally-committed effort — independent of the React/TS migration, should not wait for it.
4. F3 (rate limiting) and F4 (idempotency matching) — low-risk additive changes, can be scheduled alongside Phase 2/3 tooling work.
5. F5 (silent row-skip) — hold until financial-logic-change process (before/after tests, Golden Rule §17) is set up; do not rush a financial RPC change ahead of that scaffolding.

None of these findings block starting Phase 2 (build tooling introduction) of the modernization roadmap.
