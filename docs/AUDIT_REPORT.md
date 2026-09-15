# BILLNAW ERP/POS — Audit Report

Date: 2026-09-15 (Phase 1 baseline, dated same day) — extended below with Phase 2–4 verification.
Scope: Full repository audit, read-only. No application code was modified to produce this report or its extension.

This document supersedes the root-level `AUDIT_REPORT.md` as the canonical audit record. Section 0 is new; Sections 1–10 are the original Phase 1 findings, carried forward verbatim (unchanged conclusions still hold) except where a "Phase 2–4 update" note says otherwise.

---

## 0. Phase 2–4 Verification (new — extends Phase 1)

Between the Phase 1 audit and this extension, four migration phases already landed on this branch and were merged (`main` ← PR #1, commits `536555b`…`3df016a`). This section verifies that work rather than assuming it was done correctly.

**What actually shipped:**
- Vite + TypeScript build tooling added (`vite.config.mjs`, `package.json`, `tsconfig.json` now load-bearing) — runs *parallel* to the deployed app; `index.html` still loads the original classic `<script>` files unchanged (verified: `index.html` script order is still `dom.js → gstConfig.js → exportEngine.js → alertEngine.js → printerEngine.js → settings.js → customers.js → purchases.js → supabaseClient.js → app.js`).
- Four pure/low-coupling modules extracted into typed ES modules under `src/services/`: `gst`, `export`, `alerts`, `printer`, plus `src/core/security/escape.ts`.
- Three larger slices "extracted" from `app.js` in name only, per commit messages: `settings.js`, `customers.js`, `purchases.js`. **Important distinction verified by reading the files**: these are *not* under `src/features/*` as `ARCHITECTURE_TARGET.md` specifies — they are new root-level classic-script files, explicitly documented in their own header comments as "Extracted verbatim from app.js... structural relocation only," still untyped JS, still sharing the global `window` scope with `app.js` (same pattern as `gstConfig.js` before Phase 3). `app.js` itself shrank from 5,442 lines to 4,333 lines, consistent with this relocation.
- **Verification performed this pass** (not just re-reading commit messages):
  - `npm ci && npm test` — all 7 suites green: `run-tests.js` (40/40), `shop-day-simulation.js` (17/17), `gst-parity.js` (47/47), `escape-parity.js` (28/28), `alerts-parity.js` (28/28), `export-parity.js` (8/8), `printer-parity.js` (5/5). The parity suites specifically transpile each new `src/services/*` TS module and diff its output against the still-deployed classic-script original — byte-identical results confirms the Phase 3 extractions are behaviorally verbatim, not just structurally.
  - `npx tsc --noEmit` — clean, no type errors.
  - `grep -c 'innerHTML\|outerHTML'` across `app.js` + the three new root files totals exactly **99** — identical to the Phase 1 count. Confirms the `app.js` → `settings.js`/`customers.js`/`purchases.js` split moved code without adding or removing any interpolation site (no accidental new XSS surface, no accidental fix either — Finding F2 below is unchanged).
  - `find supabase/functions` — only `ai-invoice-parse/` exists now. The Phase 1 Finding 1 (stale duplicate `supabase/functions/index.ts`) is **resolved**: the file is gone. (Confirm this reflects an intentional deletion decision, not an artifact of a stale checkout — the audit trail is the git history, not asserted here.)
- **What Phase 2–4 did *not* do**, correctly, per their own Safety Gate stop conditions: no change to `AuthFlow`, `SyncEngine`, or the invoice/purchase RPC call sequence; no DB/RLS/migration changes; no change to `index.html`'s deployed script order; no dependency version changes beyond adding `vite`/`typescript` as new devDependencies (package.json itself is new, not a modification of a prior one — there was no `package.json` before Phase 2).
- **New drift risk this phase introduces**: two copies of GST logic now exist simultaneously — `gstConfig.js` (deployed) and `src/services/gst/index.ts` (not deployed, build-only). The team correctly anticipated this and wrote `gst-parity.js` as a permanent regression guard rather than a one-time check; this pattern should be replicated for `export`/`alerts`/`printer` (already is) and should be required for every future extraction, not optional.
- **RUNBOOK.md is now further stale** beyond the two points Phase 1 already flagged: its Phase 1 "folder must look exactly like this" file listing (8 root files) predates `settings.js`, `customers.js`, `purchases.js`, `styles.css`, `manifest.json`, `icon.svg`, `favicon.ico`, `vendor/`, and now the entire `src/`/`vite.config.mjs`/`package.json`/`tsconfig.json`/`docs/` additions. Documentation-only, low risk, but a new contributor following RUNBOOK today would be confused.

**Conclusion**: Phase 2–4 execution matches its own plan and safety gates. No financial logic, RLS, auth, or deployed behavior changed. The verbatim-extraction claims in commit messages are independently confirmed by parity tests and identical `innerHTML` counts, not merely trusted.

---

## 1. Current Architecture

- **Frontend**: Pure static script-tag JavaScript, no bundler wired to production, no ES modules in the deployed path. `index.html` (1586 lines / 94KB) loads scripts in dependency order: `dom.js` → `gstConfig.js` → `exportEngine.js` → `alertEngine.js` → `printerEngine.js` → `settings.js` → `customers.js` → `purchases.js` → `supabaseClient.js` → `app.js`. *(Phase 2–4 update: a parallel Vite+TS build exists under `src/` but is not wired into this load order — see §0.)*
- **`app.js`** is now a 4,333-line monolith (down from 5,442 at Phase 1) holding auth, POS, inventory, returns, reports, GST glue, printing glue, alerts glue, AI intake orchestration, and settings/customers/purchases glue-back-references, all in one file. State lives in one global mutable object, `APP_STATE`, persisted to `localStorage` (`bn_tenant`, `bn_inv`, `bn_cust`, `bn_sales`, `bn_seq`, `bn_returns`, `bn_purchases`).
- Informal "modules" are global object literals: `APP_STATE`, `AuthFlow`, `SyncEngine`, `TaxEngine`/`GST_STATE_CODES` (gstConfig.js), `SB` (supabaseClient.js), `PrinterEngine` (printerEngine.js).
- **`tsconfig.json`/`global.d.ts`** are now partially load-bearing: `tsc --noEmit` actually runs and passes, and 4 modules compile as real TS under `src/services/`. The deployed app itself still ships plain JS with no build step.
- **Backend**: Supabase (Postgres + Auth + Edge Functions). 9 migrations (`0001`–`0009`) define schema, RLS, and business-logic RPCs — unchanged since Phase 1. One edge function (`ai-invoice-parse`) — the stale duplicate is gone (§0).
- **Offline**: Single unified localStorage sync queue (`SyncEngine`) flushed on reconnect, backed by idempotent server RPCs. Unchanged since Phase 1.

## 2. Existing Functionality (confirmed present and working per code + RUNBOOK)

Auth (OTP email/phone + Google OAuth), multi-tenant shop onboarding, role-based POS (owner/cashier/super_admin), inventory with barcode/camera scanning, AI-assisted purchase intake (Gemini OCR), vendor/purchase management with weighted-average costing, GST-correct billing (CGST/SGST/IGST, HSN breakup, GST-inclusive pricing), sales returns/credit notes, customer credit ledger (Khata), dashboards/reports (GSTR-1, stock summary, daybook, party outstanding) with CSV export, thermal/A4 printing, offline sale/return/purchase queueing with sync, PWA install + update-banner flow, subscription plan catalogue, super-admin cross-shop access with audit logging.

## 3. File Dependency Map (updated)

```
index.html (deployed load order — unchanged by Phase 2-4)
 └─ dom.js
 └─ gstConfig.js         (TaxEngine, GST slabs — deployed original)
 └─ exportEngine.js       (CSV export — deployed original)
 └─ alertEngine.js        (low-stock/expiry alerts — deployed original)
 └─ printerEngine.js      (thermal/A4/Bluetooth printing — deployed original)
 └─ settings.js           (Phase 4 extraction from app.js — verbatim)
 └─ customers.js          (Phase 4 extraction from app.js — verbatim)
 └─ purchases.js          (Phase 4 extraction from app.js — verbatim, highest-stakes slice: AI OCR + purchase RPCs)
 └─ supabaseClient.js     (SB namespace: ~35 RPC-wrapped methods, hardcoded anon key + URL)
 └─ app.js                (monolith, 4,333 lines: auth, POS, inventory, returns, reports remain here)

src/ (Vite+TS build, parallel, NOT wired into index.html)
 └─ services/gst, export, alerts, printer   (typed twins of the deployed originals, parity-tested)
 └─ core/security/escape.ts

sw.js                     (service worker, versioned via CACHE_NAME)
manifest.json             (PWA)
supabase/migrations/*.sql (schema + RLS + RPCs — unchanged, 0001-0009)
supabase/functions/ai-invoice-parse/index.ts (hardened, live; stale duplicate index.ts removed — §0)
tests/run-tests.js, shop-day-simulation.js (original Node test scripts, source-extraction based)
tests/gst-parity.js, escape-parity.js, alerts-parity.js, export-parity.js, printer-parity.js (new Phase 3 regression guards — deployed vs. src/ byte-diff)
docs/ (this file and its siblings — new)
```

## 4. Database Dependency Map

Unchanged since Phase 1 — no migration, RLS, or RPC-affecting work has occurred.

- **Core**: `shops`, `profiles` (role: `super_admin|owner|cashier`), `items`, `customers`, `sales`, `ai_purchase_staging`, `audit_log` (0001).
- **Extended**: `sales_returns` (0005), `vendors`, `purchases` (0007), `subscription_plans` (0008), `vendor_divisions` (0009).
- Every tenant table carries `shop_id uuid references shops(id)` and is indexed on it. All have RLS enabled.
- **Atomic/idempotent RPCs**: `decrement_item_stock` (0002), `create_invoice_atomic` (0003, extended 0009), `create_purchase_atomic` (0007, extended 0009), `process_sales_return_atomic` (0005), `next_invoice_number` (0003). Role-aware redaction RPCs: `fetch_items_for_role`, `fetch_sales_for_role`, `shop_profit_summary` (0004, extended 0006).

## 5. Security Findings

See `docs/SECURITY_REPORT.md` for the full, current findings list (F1 resolved, F2–F5 still open, statuses verified this pass).

## 6. Performance Findings

- No bundler wired to the deployed path means no code-splitting, tree-shaking, or minification of app.js (still shipped unminified) — a real payload cost on first load, especially on the mobile/PWA target. The parallel Vite build does not yet change this because it isn't deployed.
- Reports read from local in-memory state, not a live cloud query (per RUNBOOK) — fast, but means a second device needs a refresh to see cross-device changes.
- No load-testing or query-plan review performed in this pass (out of scope for a static-code audit).

## 7. Offline Findings

Unchanged since Phase 1 — `SyncEngine` was not touched by Phase 2–4:
- Single unified localStorage queue (`bn_offline_sync_queue`) for sale/return/purchase envelopes.
- `flushSyncQueue()` runs on the browser `online` event and opportunistically elsewhere; re-queues only on "fatal" (non-duplicate) errors.
- Returns queued before their parent sale has synced are correctly held back and retried, but can stall indefinitely with no user-visible escalation.
- No cross-device conflict resolution beyond server-side `next_invoice_number` sequencing + RPC idempotency.
- Service worker deliberately does not call `self.skipWaiting()` — good, deliberate safety choice preserved.
- **RUNBOOK.md stale claims**: the two Phase 1 items (PIN-login limitation, non-atomic invoice/stock) remain uncorrected, and Phase 2–4 added a third (file-listing drift — see §0).

## 8. Technical Debt

- `app.js` is still a 4,333-line file with auth, POS/checkout, inventory, returns, and reports un-extracted — the direct blocker for React migration remains, though the size is down ~20% from Phase 1's 5,442 lines.
- Test-count drift item from Phase 1 is now moot — actual current counts (173 total assertions across 7 suites, all passing) are directly verifiable via `npm test`, no reconciliation needed going forward if this becomes the tracked number.
- **No automated test touches Supabase, RLS, or the edge function.** Still the single largest coverage gap for a financial system, unchanged since Phase 1 and *not* addressed by Phase 2–4 (which was explicitly scoped to structural JS extraction, not backend testing — per its own Safety Gate).
- Ad hoc service-worker versioning unchanged.
- `node_modules` is not committed (correct — `.gitignore` covers it) but is also not present by default in a fresh checkout; `npm ci` is required before `npm test` will run (all `*-parity.js` tests depend on the `typescript` package to transpile `src/services/*` on the fly). This is normal for a Node project but should be stated explicitly in RUNBOOK/SETUP for the next contributor, since the old script-tag-only workflow never needed it.

## 9. Migration Risks

- **app.js extraction risk** (Phase 1 finding, still live for remaining work): GST/stock/idempotency logic is tested indirectly via `run-tests.js`'s source-extraction `extract()` helper. Phase 3's `*-parity.js` pattern is the correct answer to this risk and should be the template for extracting the remaining `app.js` responsibilities (auth, POS/checkout, inventory, returns, reports) — a parity test per extraction, not just a manual smoke test.
- **RPC/API surface migration risk**: unchanged, `SB` namespace (~35 methods) not yet touched by any phase.
- **Offline queue migration risk**: unchanged, Phase 6+ territory, not started.
- **Settings/customers/purchases extraction verified low-risk in practice**: these three Phase 4 slices moved code without a parity-test harness (unlike gst/export/alerts/printer, which have one) — verified in this pass only by identical `innerHTML` count and passing `run-tests.js`/`shop-day-simulation.js`, which don't exercise settings/customers/purchases UI logic directly. **Gap**: no dedicated parity test exists for these three files the way one exists for the four `src/services/*` modules. Recommend closing this gap before further `app.js` extraction proceeds, since it's a cheap, high-value test to add and the precedent already exists.

## 10. Recommended Migration Order (Phase 1 original — status updated)

1. ~~Phase 0/1 — Backup/baseline + audit~~ **Done.**
2. ~~Phase 2 — Vite parallel build~~ **Done, verified this pass.**
3. ~~Phase 3 — gstConfig/exportEngine/alertEngine/printerEngine extraction~~ **Done, verified this pass (parity tests green).**
4. Phase 4 — Break apart `app.js` further, lowest-coupling first. **Partially done**: settings, customers, purchases moved to root-level files (not yet `src/features/*`, not yet parity-tested — see §9 gap). Auth and POS/checkout, the highest-risk sections, are untouched.
5. Resolve Finding 1 (dead edge function) — **Done, verified this pass.** Finding 2 (XSS audit) — **not started**, still 99 unescaped-by-default call sites with 3 known-fixed spots.
6. Add automated tests for the atomic RPCs and RLS policies — **not started**, still the single biggest gap for a financial system.
7. Continue with Phases 5–11 per `docs/MIGRATION_PLAN.md`, each gated by its Safety Gate checklist.

---

## Files to Preserve (do not rewrite wholesale)

All 9 SQL migrations, all RPC functions therein, `supabase/functions/ai-invoice-parse/index.ts`, the RLS policy set, all 7 files under `tests/` (extend, don't discard), `SyncEngine`'s idempotency-key design, the `esc`/`escJs` escaping approach (extend coverage, don't replace the mechanism), the parity-test pattern established in Phase 3 (`*-parity.js`).

## Files to Refactor (in place, incrementally)

`app.js` (4,333 lines remaining — auth, POS/checkout, inventory, returns, reports), `settings.js`/`customers.js`/`purchases.js` (add parity tests, then eventually move into `src/features/*` per `ARCHITECTURE_TARGET.md`), `index.html` (markup extraction not yet audited), `styles.css` (68KB, no CSS-architecture audit performed yet).

## Files to Retire

None currently pending — the one identified candidate (`supabase/functions/index.ts`) has already been removed.

---

## Safety Status of This Audit (extended)

- Security: **PASS** (F1 resolved; F2–F5 documented, none require immediate stop — see SECURITY_REPORT.md)
- Data safety: **PASS** (no data touched; `npm ci`/`npm test`/`tsc --noEmit` are the only commands executed to verify this report, none of which write application data or source)
- Tenant isolation: **PASS** (static verification only; RUNBOOK TEST 12 still not confirmed live — same caveat as Phase 1)
- Tests: **WARNING** (all 173 existing assertions pass; server-side/RLS logic still has zero automated coverage)
- Build: **PASS** (`tsc --noEmit` clean; parallel Vite build present but not wired to deployment — that's by design at this phase, not a defect)
- Deployment: **NOT DEPLOYED** by this audit — no code was changed to produce this document.

## Final Decision

**SAFE TO CONTINUE** — Phase 1–4 work is verified sound and consistent with its own plan. Do not begin further code migration (Phase 4 continuation, Phase 5+) until `docs/MIGRATION_PLAN.md` is reviewed and approved.
