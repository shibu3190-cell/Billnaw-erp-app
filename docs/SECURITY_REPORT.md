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

**Still not verified in any pass to date**: live runtime behavior. RUNBOOK.md's TEST 12 (register two shops, confirm cross-tenant zero-visibility, confirm revoked-shop lockout) remains a manual test that has not been re-run against a live Supabase instance in either the Phase 1 audit or this extension. This is the single most important open verification item before treating tenant isolation as fully confirmed rather than statically inferred.

## 4. Secrets Policy Compliance

Compliant, re-verified this pass across the full current tree (including all files added since Phase 1). No service-role key, Gemini key, JWT secret, or database password found in any tracked file.

## 5. Recommended Security Work Order (updated)

1. ~~Confirm and resolve F1~~ — **Done.**
2. **Run RUNBOOK TEST 12 live** to confirm tenant isolation holds at runtime — still the top open item, unchanged priority since Phase 1, and now the longest-outstanding recommendation in this report.
3. Begin F2 (XSS audit-and-patch) as a standalone effort across all 4 files that now contain interpolation sites (`app.js`, `customers.js`, `settings.js`, `purchases.js`) — independent of the React/TS migration.
4. **New recommendation**: add a parity test for `settings.js`/`customers.js`/`purchases.js` (see `docs/AUDIT_REPORT.md` §9 gap) before any further `app.js` extraction — this is a test-coverage gap the security review specifically flags because the extraction pattern (verbatim move via manual read-through) has no automated backstop for these three files the way `gst`/`export`/`alerts`/`printer` do.
5. F3 and F4 — low-risk additive changes, can be scheduled alongside further build tooling work.
6. F5 — hold until financial-logic-change process (before/after tests, Safety Gate) is set up; do not rush a financial RPC change ahead of that scaffolding.

None of these findings block continuing the structural migration (further Phase 4 work) described in `docs/MIGRATION_PLAN.md`.
