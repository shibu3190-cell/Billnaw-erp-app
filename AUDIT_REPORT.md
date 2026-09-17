# BILLNAW ERP/POS — Audit Report

Date: 2026-09-15
Scope: Full repository audit, read-only. No application code was modified to produce this report.

---

## 1. Current Architecture

- **Frontend**: Pure static script-tag JavaScript, no bundler, no ES modules. `index.html` (1586 lines / 94KB) loads scripts in dependency order: `dom.js` → `gstConfig.js` → `exportEngine.js` → `alertEngine.js` → `printerEngine.js` → `supabaseClient.js` → `app.js`.
- **`app.js`** is a 5,442-line / 223KB monolith holding auth, POS, inventory, purchases, returns, customers, vendors, reports, GST, printing glue, alerts, AI intake, and settings, all in one file with no internal module boundaries beyond banner comments. State lives in one global mutable object, `APP_STATE`, persisted to `localStorage` (`bn_tenant`, `bn_inv`, `bn_cust`, `bn_sales`, `bn_seq`, `bn_returns`, `bn_purchases`).
- Informal "modules" are global object literals: `APP_STATE`, `AuthFlow`, `SyncEngine`, `TaxEngine`/`GST_STATE_CODES` (gstConfig.js), `SB` (supabaseClient.js), `PrinterEngine` (printerEngine.js).
- **`tsconfig.json`/`global.d.ts`** are static-analysis-only (`noEmit: true`, `checkJs`) — no build pipeline exists. **No `package.json` anywhere in the repo.** Deployment is "copy static files to a host"; the service worker handles caching/versioning via a manually bumped `CACHE_NAME`.
- **Backend**: Supabase (Postgres + Auth + Edge Functions). 9 migrations (`0001`–`0009`) define schema, RLS, and business-logic RPCs. Two Gemini-calling edge functions exist (see §9).
- **Offline**: Single unified localStorage sync queue (`SyncEngine`) flushed on reconnect, backed by idempotent server RPCs.

## 2. Existing Functionality (confirmed present and working per code + RUNBOOK)

Auth (OTP email/phone + Google OAuth), multi-tenant shop onboarding, role-based POS (owner/cashier/super_admin), inventory with barcode/camera scanning, AI-assisted purchase intake (Gemini OCR), vendor/purchase management with weighted-average costing, GST-correct billing (CGST/SGST/IGST, HSN breakup, GST-inclusive pricing), sales returns/credit notes, customer credit ledger (Khata), dashboards/reports (GSTR-1, stock summary, daybook, party outstanding) with CSV export, thermal/A4 printing, offline sale/return/purchase queueing with sync, PWA install + update-banner flow, subscription plan catalogue, super-admin cross-shop access with audit logging.

## 3. File Dependency Map

```
index.html
 └─ dom.js
 └─ gstConfig.js         (TaxEngine, GST slabs)
 └─ exportEngine.js       (CSV export)
 └─ alertEngine.js        (low-stock/expiry alerts)
 └─ printerEngine.js      (thermal/A4/Bluetooth printing)
 └─ supabaseClient.js     (SB namespace: ~35 RPC-wrapped methods, hardcoded anon key + URL)
 └─ app.js                (monolith: consumes all of the above + SB)
sw.js                     (service worker, versioned via CACHE_NAME)
manifest.json             (PWA)
supabase/migrations/*.sql (schema + RLS + RPCs, applied via Supabase SQL editor/CLI)
supabase/functions/ai-invoice-parse/index.ts (hardened, live)
supabase/functions/index.ts                  (stale duplicate — see §9)
tests/run-tests.js, tests/shop-day-simulation.js (pure Node, no framework, test app.js/gstConfig.js logic via source extraction)
```

## 4. Database Dependency Map

- **Core**: `shops`, `profiles` (role: `super_admin|owner|cashier`), `items`, `customers`, `sales`, `ai_purchase_staging`, `audit_log` (0001).
- **Extended**: `sales_returns` (0005), `vendors`, `purchases` (0007), `subscription_plans` (0008), `vendor_divisions` (0009).
- Every tenant table carries `shop_id uuid references shops(id)` and is indexed on it. All have RLS enabled.
- **Atomic/idempotent RPCs**: `decrement_item_stock` (0002), `create_invoice_atomic` (0003, extended 0009), `create_purchase_atomic` (0007, extended 0009), `process_sales_return_atomic` (0005), `next_invoice_number` (0003). Role-aware redaction RPCs: `fetch_items_for_role`, `fetch_sales_for_role`, `shop_profit_summary` (0004, extended 0006).

## 5. Security Findings

**Strengths (verified, not assumed):**
- RLS is enabled on every tenant table with a consistent `security definer` helper pattern (`my_shop_id()`, `my_role()`, `shop_is_active()`). No `USING (true)` policy found on any tenant-sensitive table. The one `USING (true)` policy (`subscription_plans`, 0008) is a deliberately public read-only pricing catalogue with no write policy — not an exposure.
- `audit_log` is insert-only for everyone, including `super_admin` — no select/update/delete policy exists via the client API. Genuinely append-only.
- Role enforcement (cost/margin hiding from cashiers) is done **server-side** via `fetch_items_for_role`/`fetch_sales_for_role`/`shop_profit_summary`, not just UI hiding. `applyRoleSecurity()` in app.js explicitly comments that it is "a usability measure, NOT the security boundary."
- `purchases` RLS excludes the `cashier` role entirely rather than redacting fields.
- No secrets found in client code. `SUPABASE_URL`/anon key are hardcoded in `supabaseClient.js` by design (anon key is meant to be public; RLS is the real boundary) — this matches Supabase's documented model and is not a finding. `GEMINI_API_KEY` is correctly server-side only (`Deno.env.get`), never present in client code or committed as a literal anywhere in the repo (verified by grep for `service_role`, `sk-`, `AIza`, and similar patterns — no hits besides comments/placeholders).
- Financial atomic RPCs (`create_invoice_atomic`, `create_purchase_atomic`, `process_sales_return_atomic`) use `idempotency_key` UNIQUE columns with a "replayed" branch — real idempotency for offline-queue retries, not just a good-faith attempt.
- Returns never delete the original invoice; they flip `status` (`partially_returned`/`returned`) — correct GST audit-trail behavior.

**Findings requiring attention:**
1. **[MEDIUM] Duplicate stale edge function** — `supabase/functions/index.ts` is an older, weaker version of `ai-invoice-parse/index.ts`: no mime-type allow-list, no size cap, no cashier-role check, no arithmetic reconciliation, and a prompt that tells the model to "use your best estimate rather than omitting the field" (the opposite of the hardened version's null-on-uncertain instruction). It is unclear if it's deployed. **Risk**: accidental redeploy of the weak version. **Recommendation**: confirm it isn't deployed, then delete it or clearly mark it deprecated — do not silently leave both in the repo.
2. **[MEDIUM] XSS residual risk** — 99 `innerHTML`/`outerHTML` call sites in app.js against 2 manually-applied escaping helpers (`esc`, `escJs`). A prior XSS-hardening pass exists (sw.js `CACHE_NAME` literally says `v23.0-invoice-xss-hardening`, and `tests/run-tests.js` has 3 targeted regression tests for previously-found stored-XSS spots), which confirms this bug class is real and was exploitable, not theoretical. Coverage is 3 known-fixed spots out of 99 call sites — **no systematic guarantee every interpolation site is escaped.**
3. **[LOW] No rate limiting on `ai-invoice-parse`** — an authenticated non-cashier owner account can call the Gemini-backed OCR endpoint repeatedly with no app-level quota, bounded only by Gemini's own API limits. Cost/DoS risk against the Gemini bill, not a data-security issue.
4. **[LOW] Brittle idempotency detection in offline sync** — `isFatalSyncError()` (app.js) classifies "already synced" by regex-matching the literal string `"duplicate key"` in Postgres error text. Works today; fragile against Postgres wording/locale changes.
5. **[LOW] Silent partial-row skipping in atomic RPCs** — `create_invoice_atomic`/`create_purchase_atomic`/`process_sales_return_atomic` use `exception when others then continue` on malformed line items rather than rejecting the whole request. Pragmatic for offline resilience, but a shop owner gets no visible error if a line silently drops (e.g. invalid UUID in a stock-decrement loop).

## 6. Performance Findings

- No bundler means no code-splitting, tree-shaking, or minification of app.js (223KB unminified) — a real payload cost on first load, especially on the mobile/PWA target.
- Reports read from local in-memory state, not a live cloud query (per RUNBOOK) — fast, but means a second device needs a refresh to see cross-device changes. Not yet audited in code detail; flagged for Phase 6/7 offline-sync work.
- No load-testing or query-plan review was performed in this pass (out of scope for a static-code audit); recommend before major traffic growth.

## 7. Offline Findings

- `SyncEngine` (app.js) uses a single unified localStorage queue (`bn_offline_sync_queue`) for sale/return/purchase envelopes — previously sales-only, now unified (per code comment, a documented past bug fix).
- `flushSyncQueue()` runs on the browser `online` event and opportunistically elsewhere; re-queues only on "fatal" (non-duplicate) errors.
- Returns queued before their parent sale has synced are correctly held back and retried — but can be stuck indefinitely if the parent sale keeps failing, with no user-visible escalation found in this pass.
- No cross-device conflict resolution beyond server-side `next_invoice_number` sequencing + RPC idempotency: two offline devices can independently mint the same local fallback invoice number (`INV-XXXX`), reconciling only once both come online (documented limitation in app.js's own comments).
- Service worker (`sw.js`) deliberately does not call `self.skipWaiting()` — new versions wait for explicit user confirmation via an update banner, so an open tab never silently swaps caches mid-transaction. This is a good, deliberate safety choice for a POS app mid-checkout.
- **RUNBOOK.md is stale relative to code** on two points: (a) it lists "PIN 4-digit stored locally" as a known limitation, but app.js explicitly removed PIN-based login with a rationale comment ("readable/editable by anyone with devtools, protected nothing") — current auth is Supabase-session/OTP/OAuth only; (b) it lists "invoice-save and stock-decrement are two separate non-atomic calls" as a known limitation, but migration 0003's `create_invoice_atomic` RPC fixed this — app.js itself has a stale contradictory comment block acknowledging the drift. **RUNBOOK.md should be updated**, but that is a low-risk documentation-only change.

## 8. Technical Debt

- app.js as a 5,442-line monolith with no module boundaries is the dominant technical-debt item and the direct blocker for any TypeScript/React migration — extraction must happen incrementally per the categories in Phase 11 of the task brief (auth, POS, inventory, purchases, returns, customers, vendors, reports, GST, printing, alerts, AI, offline/sync, settings).
- Duplicate edge function (see Finding 1).
- Test-count drift: RUNBOOK cites "31 + 17" checks; actual counts are 42 `test()` calls in `run-tests.js` and 18 `check()` calls in `shop-day-simulation.js` (some tests loop over multiple assertions internally, which may explain part of the discrepancy — needs reconciliation, not urgent).
- ~~No automated test touches Supabase, RLS, or the edge functions.~~ **Resolved 2026-09-17**: `tests/rpc-rls-tests.js` (`npm run test:rpc`) now runs 29 automated checks against a real PostgreSQL instance with every migration applied and RLS genuinely enforced (connected as a non-superuser, non-owner role — the only way RLS isn't silently bypassed), covering tenant isolation, shop revocation, role-based financial redaction, and the atomic invoice/purchase/return RPCs' idempotency and rollback behavior. See SECURITY_REPORT.md §3 for the full result — including one new HIGH-severity finding (F0) this suite surfaced that the read-only audit missed: no INSERT policy exists anywhere for `shops` or `profiles`. Gemini reconciliation (the edge function) remains untested by anything in the repo — that gap is still open.
- Ad hoc service-worker versioning (`CACHE_NAME` embeds a description of the latest fix rather than semantic versioning) — works for a single maintainer, won't scale to a team.

## 9. Migration Risks

- **app.js extraction risk**: business logic (GST computation, stock arithmetic, idempotency handling) is currently tested indirectly by extracting function bodies out of the live file via string search (`tests/run-tests.js`'s `extract()` helper) — a fragile but real regression net. Any refactor that renames or restructures these functions must keep (or rewrite) this test coverage, not silently drop it.
- **RPC/API surface migration risk**: `SB` namespace wraps ~35 Supabase calls; a React/TS frontend rewrite must preserve every one of the atomic/idempotent RPC contracts (`create_invoice_atomic`, `create_purchase_atomic`, `process_sales_return_atomic`, `decrement_item_stock`, `next_invoice_number`, `fetch_items_for_role`, `fetch_sales_for_role`, `shop_profit_summary`) exactly — these encode financial correctness and role-based data redaction, per this task's Golden Rule and §17 (Financial Safety).
- **Offline queue migration risk**: replacing localStorage with a "robust local database" (Phase 6 of the target roadmap) must preserve the existing idempotency-key + replay semantics, or invoices/returns synced twice (or lost) during the cutover.
- **Edge function cleanup risk**: deleting `supabase/functions/index.ts` is safe *functionally* only after confirming nothing references or deploys it — flagged as an approval-gated action, not because it's risky to the running app, but because "delete a file" during a modernization pass warrants a deliberate decision per this task's stop conditions.
- **No migration-affecting destructive risk identified** in this pass: no proposal in this audit touches production data, existing migrations, RLS policies, or financial calculations.

## 10. Recommended Migration Order

Per the mandated phased approach (do not skip ahead):

1. **Phase 0/1 (done)** — Backup/baseline + this audit.
2. **Phase 2** — Introduce a build system (Vite) as a *parallel* build target that serves the existing script-tag files unchanged first (prove the pipeline works before moving logic into it).
3. **Phase 3/4** — Convert low-risk, low-coupling modules first: `gstConfig.js` (pure functions, already covered by `run-tests.js`), `exportEngine.js`, `printerEngine.js`, `alertEngine.js` — each gets types, keeps behavior, gets a dedicated commit, re-run of `run-tests.js`/`shop-day-simulation.js` after each.
4. **Phase 4 (continued)** — Break `app.js` apart by the responsibility boundaries already identified in §1/§3 above, starting with the ones with the fewest cross-references (settings, alerts) before touching POS/checkout/auth (the highest-risk, most cross-coupled sections).
5. **Address Finding 1 (dead edge function) and Finding 2 (XSS audit)** early and in isolation — both are safe, bounded, high-value fixes that don't require the React migration to land first.
6. ~~Add automated tests for the atomic RPCs and RLS policies~~ **Done 2026-09-17** — see `tests/rpc-rls-tests.js`. Surfaced a real HIGH-severity gap (no INSERT policy on `shops`/`profiles` — SECURITY_REPORT.md F0) that needs a live-environment check before any fix.
7. Continue with Phases 5–11 as specified in the task brief, each phase gated by the Safety Gate checklist before starting.

---

## Files to Preserve (do not rewrite wholesale)

All 9 SQL migrations, all RPC functions therein, `supabase/functions/ai-invoice-parse/index.ts`, the RLS policy set, `tests/run-tests.js` and `tests/shop-day-simulation.js` (extend, don't discard), `SyncEngine`'s idempotency-key design, the `esc`/`escJs` escaping approach (extend coverage, don't replace the mechanism).

## Files to Refactor (in place, incrementally)

`app.js` (split by responsibility), `index.html` (currently markup + likely inline logic — needs audit at next phase for templating extraction), `styles.css` (68KB, no audit performed yet on its architecture — candidate for a follow-up CSS audit before Phase 8 UI migration).

## Files to Retire (pending confirmation, not unilaterally)

`supabase/functions/index.ts` — confirm not deployed, then remove or clearly deprecate.

---

## Safety Status of This Audit

- Security: **PASS** (findings are documented, none require immediate stop)
- Data safety: **PASS** (no data touched)
- Tenant isolation: **PASS** (verified via migration read-through; RUNBOOK's manual TEST 12 should still be run against a live environment to confirm runtime behavior matches the SQL)
- Tests: **WARNING** (server-side logic has zero automated coverage — flagged in §8/§10)
- Build: **N/A** (no code changed)
- Deployment: **NOT DEPLOYED** — no code was changed in this task.

## Final Decision

**SAFE TO CONTINUE** — proceed to producing `MIGRATION_PLAN.md`, `SECURITY_REPORT.md`, and `ARCHITECTURE_TARGET.md` for review, but do not begin code migration until those are reviewed and approved.
