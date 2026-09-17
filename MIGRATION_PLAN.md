# BILLNAW ERP/POS — Migration Plan

Date: 2026-09-15
Basis: AUDIT_REPORT.md and SECURITY_REPORT.md findings, ARCHITECTURE_TARGET.md destination state.
This plan sequences work; it does not itself change any code. Each step below requires its own Safety Gate check and, where noted, explicit approval before execution.

---

## 0. Preconditions Before Any Code Change

- [ ] AUDIT_REPORT.md, SECURITY_REPORT.md, ARCHITECTURE_TARGET.md reviewed and approved by the user.
- [ ] RUNBOOK.md TEST 12 (tenant isolation) re-run live to confirm static RLS review matches runtime behavior.
- [ ] RUNBOOK.md's two stale claims (PIN limitation, non-atomic invoice/stock) corrected — documentation-only change, low risk, but do first so future contributors aren't misled.
- [ ] Resolve SECURITY_REPORT.md F1 (confirm/delete the stale duplicate edge function) — isolated, no dependency on anything else in this plan.
- [ ] Create a `stable` tag/branch at current `main` HEAD as a rollback point before Phase 2 work begins (per Golden Rule Git Safety, §21).

## 1. Phase-by-Phase Plan

### Phase 2 — Build system introduction
- Add Vite + TypeScript config as a parallel build target. Existing `index.html`/script-tag app continues to be the deployed artifact; the Vite build is developed alongside it, not yet wired to replace it.
- **Safety Gate**: no functionality deleted, no DB/GST/inventory/invoice/permission change, fully rollback-able (new files only).
- **Exit criteria**: `npm run build` (new) produces a working Vite dev server that can load and typecheck `gstConfig.js` via the existing `tsconfig.json`/`global.d.ts` setup, without touching the deployed `index.html` path.

### Phase 3 — First TypeScript extraction (`gstConfig.js`)
- Per ARCHITECTURE_TARGET.md §9: extract into `src/services/gst/`, add types, zero behavior change.
- **Exit criteria**: `tests/run-tests.js` and `tests/shop-day-simulation.js` pass unmodified against the extracted module; `tsc --noEmit` clean; manual smoke test of GST calculation in the running app shows identical output pre/post.
- **Commit**: `feat: introduce TypeScript foundation` (separate commit per repo convention, §21).

### Phase 3 (continued) — Remaining low-risk modules
- `exportEngine.js` → `src/services/export/`
- `alertEngine.js` → `src/services/alerts/`
- `printerEngine.js` → `src/services/printer/` (medium risk — Web Bluetooth/print-dialog coupling; test against RUNBOOK TEST 10/16 manually since no automated coverage exists for printing).
- Each gets its own commit, its own before/after check, run against existing tests.

### Phase 4 — Break apart `app.js`
- Order (lowest to highest coupling, per ARCHITECTURE_TARGET.md §8): settings → alerts (if not already done in Phase 3) → customers/vendors → inventory → purchases/returns → reports → auth → POS/checkout last.
- Each extraction: preserve function signatures and behavior exactly; add tests where none exist before extracting (especially POS/checkout, which currently has the least direct automated coverage relative to its complexity).
- **Explicit stop condition**: any extraction that would require changing how `AuthFlow`, `SyncEngine`, or the checkout/invoice RPC call sequence work is NOT a Phase 4 change — that's Phase 5 (services/repository architecture) territory. Phase 4 is structural relocation only, not redesign.

### Phase 5 — Service/repository architecture
- Introduce `src/services/supabase/` as the typed replacement for the `SB` namespace, preserving every one of the ~35 method contracts (see §2 below for the explicit preservation checklist).
- Introduce `src/core/permissions/` mirroring `applyRoleSecurity()` — explicitly documented as UI-convenience only, same as today.

### Phase 6 — Local database
- Replace localStorage-backed state with a robust local DB (IndexedDB or SQLite-via-WASM, platform-dependent decision deferred to this phase's own design step).
- **Requires explicit approval before starting** — per Golden Rule §15/§16, this touches how financial transactions are stored client-side. Must preserve `idempotency_key` semantics exactly; new schema is additive to, not a replacement of, the existing Postgres schema.

### Phase 7 — Offline synchronization
- Formalize the `sync state` enum (pending/syncing/synced/failed/conflict) described in ARCHITECTURE_TARGET.md §5, on top of the Phase 6 local DB.
- Add automated tests for the sync queue and atomic RPC idempotency — closing the AUDIT_REPORT.md §8 coverage gap. This should happen *before* Phase 7 is considered complete, not deferred further.

### Phase 8 — UI migration to React
- **Blocked on a CSS/markup audit not yet performed** (flagged in ARCHITECTURE_TARGET.md §4/§8) — do this audit as a Phase 8 pre-step before committing to CSS Modules vs. Tailwind vs. preserved global stylesheet.
- Migrate feature-by-feature, matching the `src/features/*` boundaries already established in Phase 4, lowest-traffic screens first (settings, reports) before POS.

### Phase 9/10 — Mobile (Capacitor) / Desktop (Tauri) packaging
- Not started until Phase 8 is stable on web; printer/Bluetooth service (`src/services/printer/`) will need platform-specific adapters at this point, per ARCHITECTURE_TARGET.md §4 note.

### Phase 11 — Automated AI development workflow
- Out of scope for detailed planning until Phases 2–8 establish the TS/React foundation this would operate on.

## 2. Explicit RPC/Service Contract Preservation Checklist (Phase 5 gate)

Before Phase 5 is marked complete, verify each of the following retains identical inputs/outputs/error behavior versus the current `SB` namespace:

- `signUpShop`, `signIn`, OTP send/verify (email + phone), `signInWithGoogle`, `createShopForCurrentUser`, `updateShopSettings`, `fetchShopStaff`
- `fetchItems` (RPC-routed), `saveItem`, `decrementStock`
- Customer CRUD, vendor division CRUD
- `saveSale`, `nextInvoiceNumber`, `fetchSales`, `fetchProfitSummary`
- Purchases/vendors save/fetch paths
- Returns processing path
- `parseInvoiceImage` (AI OCR, including its 60s AbortController timeout)
- Subscription fetch
- Super-admin cross-shop access methods (must continue logging via `log_super_admin_access` before every elevated read)

Any deviation in this checklist is a **stop condition** requiring explicit approval before proceeding, per Golden Rule §17 (Financial Safety) and §22 (AI Agent Permissions — require approval before RLS/permission-affecting changes).

## 3. Testing Requirements at Each Phase

- Every phase: `tests/run-tests.js` and `tests/shop-day-simulation.js` must pass before and after.
- Phase 6/7: new automated tests required for offline queue idempotency and conflict states (currently untested — AUDIT_REPORT.md §8).
- ~~Phase 5: new automated tests required for the atomic RPCs and RLS policies~~ **Done 2026-09-17**, in parallel with Phase 4 rather than waiting for Phase 5 as originally planned — see `tests/rpc-rls-tests.js` (`npm run test:rpc`). Surfaced a real HIGH-severity finding (SECURITY_REPORT.md F0: no INSERT policy on `shops`/`profiles`) that needs a live-Supabase-project check and, depending on the answer, an approved RLS-changing migration before Phase 5's service layer can safely assume shop/profile creation works as documented.
- Before Phase 8: manual RUNBOOK test plan (all 18 tests) re-run in full against the pre-React app as a final baseline snapshot to compare against post-migration behavior.

## 4. Rollback Points

- Tag/branch at end of each phase (`phase-2-complete`, `phase-3-complete`, etc.) in addition to normal commit history, so any phase can be reverted independently without unwinding later work — relevant because Phase 4 (app.js breakup) is large and multi-commit.
- Database: no schema changes are destructive in this plan; every DB change is a new migration file, never an edit to 0001–0009. Rollback of a bad migration is a new corrective migration, never a history rewrite (Golden Rule §14).

## 5. Explicit Non-Goals of This Plan

- Not migrating the database off Supabase/PostgreSQL.
- Not changing GST calculation logic during the extraction phases (Phase 3) — only relocating and typing it.
- Not deploying anything to production as part of this plan; deployment approval is a separate, later decision per Golden Rule §20.
- Not addressing SECURITY_REPORT.md F5 (silent RPC row-skip) as part of the structural migration — that's a financial-logic change requiring its own before/after test cycle, tracked separately, not bundled into a structural phase.

---

## Final Decision

**SAFE TO CONTINUE** — Phase 2 (build system introduction) may begin once the Phase 0 preconditions above are checked off. No further code changes are made by this plan document itself; execution of Phase 2 is a separate, explicit next step requiring your go-ahead.
