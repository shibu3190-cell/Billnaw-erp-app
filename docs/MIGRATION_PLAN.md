# BILLNAW ERP/POS — Migration Plan

Date: 2026-09-15 (Phase 1 baseline) — extended below with Phase 2–4 verification and re-sequenced remaining work.
Basis: `docs/AUDIT_REPORT.md` and `docs/SECURITY_REPORT.md` findings, `docs/ARCHITECTURE_TARGET.md` destination state.
This plan sequences work; it does not itself change any code. Each step below requires its own Safety Gate check and, where noted, explicit approval before execution.

---

## 0. Preconditions Before Any Code Change — status

- [x] AUDIT_REPORT.md, SECURITY_REPORT.md, ARCHITECTURE_TARGET.md reviewed and approved by the user (this session).
- [ ] RUNBOOK.md TEST 12 (tenant isolation) re-run live to confirm static RLS review matches runtime behavior. **Still open — highest-priority unresolved precondition, carried forward from Phase 1 with no progress across two audit passes.**
- [ ] RUNBOOK.md's stale claims corrected — now three items instead of two (PIN limitation, non-atomic invoice/stock claim, and the Phase-1-era file listing that predates `settings.js`/`customers.js`/`purchases.js`/`src/`/`docs/`). Documentation-only, low risk, still not done.
- [x] Resolve F1 (stale duplicate edge function) — **done**, verified in `docs/SECURITY_REPORT.md` §0.
- [ ] Create a `stable`/`phase-4-complete` tag at current HEAD as a rollback point before further Phase 4 or Phase 5 work begins. **Not yet done** — recommend doing this immediately, since Phase 4 work (settings/customers/purchases extraction) has already landed without one.

## 1. Phase-by-Phase Plan (status updated)

### ~~Phase 2 — Build system introduction~~ — DONE, VERIFIED
- Vite + TypeScript added as a parallel build target; `index.html` still deployed unchanged.
- **Exit criteria met**: confirmed this pass — `npx tsc --noEmit` clean, `vite.config.mjs` present and valid.

### ~~Phase 3 — First TypeScript extraction (gstConfig.js)~~ — DONE, VERIFIED
- Extracted into `src/services/gst/`, typed, zero behavior change.
- **Exit criteria met**: `gst-parity.js` (47/47) passes, diffing the new module against the still-deployed original.

### ~~Phase 3 (continued) — exportEngine/alertEngine/printerEngine~~ — DONE, VERIFIED
- All three extracted to `src/services/{export,alerts,printer}/`, each with its own parity test, all green (8/8, 28/28, 5/5 respectively).

### Phase 4 — Break apart `app.js` — IN PROGRESS
- **Done**: `settings.js`, `customers.js`, `purchases.js` extracted from `app.js` to root-level classic-script files, verbatim (verified: identical total `innerHTML` count pre/post, `run-tests.js`/`shop-day-simulation.js` still pass unmodified).
- **Gap identified this pass**: unlike the Phase 3 modules, none of these three has a parity test. `docs/AUDIT_REPORT.md` §9 and `docs/SECURITY_REPORT.md` §5 both flag this. **Recommended next action within Phase 4** (not yet started): write a lightweight parity/smoke test for each — even a source-extraction-based test like `run-tests.js` already uses would close this gap without requiring the `src/features/*` migration to happen first.
- **Not started**: `app.js` still contains auth (`AuthFlow`), POS/checkout, inventory, returns, and reports — 4,333 lines remain. Order per `docs/ARCHITECTURE_TARGET.md` §8 complexity table: inventory → returns → reports next (medium complexity, moderate cross-references), auth and POS/checkout last (highest coupling, highest financial stakes).
- **Explicit stop condition, still in force**: any extraction that would require changing how `AuthFlow`, `SyncEngine`, or the checkout/invoice RPC call sequence work is NOT a Phase 4 change — that's Phase 5 territory. Verified this pass: the `settings.js`/`customers.js`/`purchases.js` extractions did not touch any of these three, consistent with staying inside Phase 4's scope.

### Phase 5 — Service/repository architecture — NOT STARTED
- Introduce `src/services/supabase/` as the typed replacement for the `SB` namespace, preserving every one of the ~35 method contracts (§2 below).
- Introduce `src/core/permissions/` mirroring `applyRoleSecurity()` — explicitly UI-convenience only, same as today.
- **Recommended to start next**, ahead of finishing all of Phase 4's remaining `app.js` extractions, because: (a) it's independently valuable and lower-risk than POS/checkout extraction, (b) every subsequent feature extraction (inventory, returns, reports, and eventually POS) will call through this layer once it exists, so extracting it later means touching those call sites twice.

### Phase 6 — Local database — NOT STARTED, requires explicit approval before starting
- Replace localStorage-backed state with a robust local DB (IndexedDB or SQLite-via-WASM).
- Must preserve `idempotency_key` semantics exactly; new schema is additive to, not a replacement of, the existing Postgres schema.
- **Sequencing note (new)**: should not start before Phase 5 is complete and contract-verified — building a new offline core against an untyped, unextracted `SB` namespace compounds risk unnecessarily.

### Phase 7 — Offline synchronization — NOT STARTED
- Formalize the `sync state` enum on top of the Phase 6 local DB.
- Add automated tests for the sync queue and atomic RPC idempotency — closing the biggest coverage gap identified in both audit passes. Should happen *before* Phase 7 is considered complete.

### Phase 8 — UI migration to React — NOT STARTED, blocked
- Blocked on a CSS/markup audit not yet performed.
- Migrate feature-by-feature, matching `src/features/*` boundaries, lowest-traffic screens first (settings, reports) before POS.

### Phase 9/10 — Mobile (Capacitor) / Desktop (Tauri) packaging — NOT STARTED
- Not started until Phase 8 is stable on web.

### Phase 11 — Automated AI development workflow — NOT STARTED
- Out of scope for detailed planning until Phases 2–8 establish the TS/React foundation.

## 2. Explicit RPC/Service Contract Preservation Checklist (Phase 5 gate) — unchanged, not yet exercised

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

Any deviation in this checklist is a **stop condition** requiring explicit approval before proceeding.

## 3. Testing Requirements at Each Phase — status

- Every phase: `tests/run-tests.js` and `tests/shop-day-simulation.js` must pass before and after. **Verified this pass**: still 40/40 and 17/17 after Phase 2–4 work.
- Phase 3 established the parity-test pattern (`*-parity.js`, byte-diff deployed-vs-extracted). **This pattern should now be treated as mandatory for every future extraction**, including the still-outstanding settings/customers/purchases gap and every subsequent Phase 4/5 step.
- Phase 6/7: new automated tests required for offline queue idempotency and conflict states — still untested, unchanged priority.
- Phase 5: new automated tests required for the atomic RPCs and RLS policies — still zero coverage, still the single biggest gap identified across both audit passes. **Recommend starting this test-writing work now, in parallel with whatever code work comes next** — it requires no frontend changes at all and has been recommended-but-not-started since Phase 1.
- Before Phase 8: manual RUNBOOK test plan (all 18 tests) re-run in full against the pre-React app as a final baseline snapshot.

## 4. Rollback Points

- Tag/branch at end of each phase. **Gap**: no `phase-2-complete`/`phase-3-complete`/`phase-4-complete` tags exist yet despite those phases being done — recommend creating them retroactively at current HEAD before any further work, so Phase 4's remaining work and Phase 5 each have a clean rollback boundary.
- Database: no schema changes are destructive in this plan; every DB change is a new migration file, never an edit to 0001–0009. Confirmed unchanged.

## 5. Explicit Non-Goals of This Plan (unchanged)

- Not migrating the database off Supabase/PostgreSQL.
- Not changing GST calculation logic during the extraction phases — only relocating and typing it (confirmed: `gst-parity.js` proves this held true for Phase 3).
- Not deploying anything to production as part of this plan.
- Not addressing SECURITY_REPORT.md F5 (silent RPC row-skip) as part of the structural migration.

---

## Final Decision

**SAFE TO CONTINUE.** Phase 2–4 (partial) work is verified sound, consistent with its own plan, and has not touched financial logic, RLS, or deployed behavior. Recommended next actions, in order, once you approve:

1. Tag current HEAD as a rollback point (no-code-change, near-zero risk).
2. Run RUNBOOK TEST 12 live against a real Supabase instance — the single longest-outstanding open item across two audit passes.
3. Add parity tests for `settings.js`/`customers.js`/`purchases.js` to close the Phase 4 coverage gap.
4. Begin Phase 5 (Supabase service layer extraction) as the next structural step, ahead of finishing the remainder of Phase 4's `app.js` breakup, per the sequencing rationale in §1.

No further code changes are made by this plan document itself; execution of any numbered step above is a separate, explicit next step requiring your go-ahead.
