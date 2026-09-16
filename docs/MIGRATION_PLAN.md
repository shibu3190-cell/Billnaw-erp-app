# BILLNAW ERP/POS — Migration Plan

Date: 2026-09-15 (Phase 1 baseline) — extended below with Phase 2–4 verification and re-sequenced remaining work.
Basis: `docs/AUDIT_REPORT.md` and `docs/SECURITY_REPORT.md` findings, `docs/ARCHITECTURE_TARGET.md` destination state.
This plan sequences work; it does not itself change any code. Each step below requires its own Safety Gate check and, where noted, explicit approval before execution.

---

## 0. Preconditions Before Any Code Change — status

- [x] AUDIT_REPORT.md, SECURITY_REPORT.md, ARCHITECTURE_TARGET.md reviewed and approved by the user (this session).
- [x] RUNBOOK.md TEST 12 (tenant isolation) re-run live. **Done, 2026-09-15 — found and fixed a real cross-tenant leak in the process (see `docs/SECURITY_REPORT.md` §5).** Not a clean pass, but the finding is fixed and re-verified live: `supabase/migrations/0010_fix_shops_rls_leak.sql` (removed two dashboard-drifted policies on `shops`, one of them `using (true)`) and `0011_atomic_shop_signup.sql` (fixed the signup regression the leak-fix exposed, via a new atomic `create_shop_and_owner` RPC). §6 recommends running the same live-vs-migration policy diff on every other tenant table, since this incident proved drift is real, not just plausible.
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
- ~~Gap: none of these three has a parity test~~ — **Closed**, same day: `tests/extraction-parity.js` now covers all of `settings.js`/`customers.js`/`purchases.js` (34 checks).
- **`inventory.js` extracted, 2026-09-16**: `renderInventoryTable`/`openEditStockModal`/`closeEditStockModal`/`saveEditedStock`/`deleteInventoryItemPrompt` (stock-master table) and `resetCatalogPaging`/`loadMoreCatalog`/`renderPagerFooter`/`renderCatalog`/`openNewProductModal`/`closeNewProdModal`/`saveNewProduct` (catalogue grid + new product), 12 functions, byte-identical to their pre-extraction bodies per `tests/extraction-parity.js`. Deliberately excludes `openItemModal`/`commitModalItem`/`showAlternativesFor`/`selectAlternative` — those look inventory-adjacent but are actually the POS add-to-cart flow, staying with checkout.
- **`returns.js` extracted, 2026-09-16**: `openReturnModal`/`closeReturnModal`/`renderReturnModal`/`updateReturnQty`/`computeReturnTotals`/`updateReturnTotals`/`submitReturn`/`applyReturnLocally`, the full credit-note flow. 7 of 8 functions verified byte-identical against the same historical baseline as every other Phase 4 file; `submitReturn` was excluded from that specific check (it already carries F4/F5/Phase 6's reviewed edits from earlier in the week) but was separately diffed against its state immediately after those edits (commit `b90c609`) and confirmed to differ by exactly one line — the Phase 6 `persistMeta()` change already known and reviewed, nothing else. `r2()` (a generic rounding helper used by POS cart rendering and the dashboard, not returns-specific) deliberately stayed in `app.js` — checked its 7 call sites before assuming it was returns-scoped.
- **`reports.js` extracted, 2026-09-16**: `openReport`/`DASH_CARD_FILTERS`/`drillDashboardCard`/`renderDashDrillTable`/`closeReportDetail`/`renderActiveReportData`/`filterReportsCategory` (report drill-down and dashboard-card drill-through), `renderDashboard`/`renderActivityFeed`/`renderMobileInvoiceCards`/`computeReceivablesAgeing`/`renderKpiDeltas`/`renderDonutChart`/`renderTrendChart`/`setTrendRange` (dashboard KPIs, receivables ageing, revenue trend chart), and `exportCurrentReportCSV`/`printReportDocument` (report export/print) — 16 functions plus the `DASH_CARD_FILTERS` const, 732 lines. Deliberately excludes several functions that sit physically among these in `app.js` but aren't reports: `loadSubscriptionPanel`/`currentPlanUnlocksAll` (billing/subscription panel), `switchView` (core view-navigation infra called from everywhere, not report-specific), `openSearchModal`/`closeSearchModal`/`handleSearchModalInput` (global command-palette search), `toggleSidebarDrawer`/`closeSidebarDrawer` (nav chrome), `populateStateDropdowns` and its neighbouring customer/party entry code, `filterSector`/`handleSearch`/`handleGlobalSearch` (catalogue search, already kept in `app.js` during the inventory extraction), and `exportData` (generic khata-ledger CSV export, not report-specific) — each checked individually, not assumed, and confirmed still present and untouched in `app.js` after the edit. Checked git history between the pre-extraction baseline commit `1f56ed1` and HEAD for all 16 functions and the const: none were touched by the F1–F5 security fixes or the Phase 6 IndexedDB cutover that landed the same week (unlike `submitReturn` and `recordPurchaseBill` in the prior two extractions), so all 16 are byte-identical to their pre-extraction `app.js` bodies with no exclusions needed — verified by `tests/extraction-parity.js` (16/16 green) plus a standalone diff against the `1f56ed1` baseline. Full suite green (see below); real-browser boot test (Chromium via Playwright) confirmed `APP_STATE` initializes, `openReport`/`renderDashboard`/`DASH_CARD_FILTERS` are defined, and a `localStorage` marker survives a full page reload.
- `app.js` now 3,215 lines (from 5,442 originally; 3,921 before this extraction). Full suite: 14 files (adds `reports.js`'s 16 parity checks), green; `tsc --noEmit` clean; real-browser boot test re-verified after this extraction.
- **Not started**: `app.js` still contains auth (`AuthFlow`) and POS/checkout. Order per `docs/ARCHITECTURE_TARGET.md` §8 complexity table: auth and POS/checkout last (highest coupling, highest financial stakes).
- **Explicit stop condition, still in force**: any extraction that would require changing how `AuthFlow`, `SyncEngine`, or the checkout/invoice RPC call sequence work is NOT a Phase 4 change — that's Phase 5 territory. Verified this pass: the `settings.js`/`customers.js`/`purchases.js` extractions did not touch any of these three, consistent with staying inside Phase 4's scope.

### Phase 5 — Service/repository architecture — NOT STARTED
- Introduce `src/services/supabase/` as the typed replacement for the `SB` namespace, preserving every one of the ~35 method contracts (§2 below).
- Introduce `src/core/permissions/` mirroring `applyRoleSecurity()` — explicitly UI-convenience only, same as today.
- **Recommended to start next**, ahead of finishing all of Phase 4's remaining `app.js` extractions, because: (a) it's independently valuable and lower-risk than POS/checkout extraction, (b) every subsequent feature extraction (inventory, returns, reports, and eventually POS) will call through this layer once it exists, so extracting it later means touching those call sites twice.

### Phase 6 — Local database — DONE, INCLUDING CUTOVER (2026-09-15)
- Replace localStorage-backed state with a robust local DB (IndexedDB or SQLite-via-WASM).
- Must preserve `idempotency_key` semantics exactly; new schema is additive to, not a replacement of, the existing Postgres schema.
- Sequencing followed as planned: started only after Phase 5 (Supabase service layer) was complete and contract-verified.
- **Foundation** (first increment): `src/core/database/index.ts` — a typed IndexedDB layer (chosen over SQLite-via-WASM as the lower-complexity option, no new binary/WASM dependency). One object store per existing `bn_*` localStorage key, keyed to match the app's own existing identity scheme exactly: `inventory` by `id`, `customers` by `phone` (the real `(shop_id, phone)` unique constraint), `sales`/`returns`/`purchases` by `idempotency_key` (the exact key `SyncEngine.generateIdempotencyKey()` already produces), `syncQueue` autoIncrement, `meta` for scalars. `database.js` is the deployed plain-JS twin (loaded by `index.html`), kept in lockstep with the typed reference via `tests/database-parity.js`.
- **Cutover** (the actual switch): approved explicitly after scoping (`docs/PHASE6_CUTOVER_PLAN.md`) — and substantially simplified once it was confirmed no real shop uses the app yet, removing the entire existing-data-migration problem. What changed in `app.js`:
  - The old top-level **synchronous** `localStorage` load (script-parse-time, before `DOMContentLoaded`) is gone. `loadStateFromIndexedDB()` is now `async`, awaited from the `DOMContentLoaded` handler via a new `bootApp()`, before any UI code that reads `APP_STATE` runs.
  - A scan (not a guess) found real top-level code between the old load and `DOMContentLoaded` that depended on that synchronous timing (`APP_STATE.vendors = APP_STATE.vendors || []` and similar) — relocated into `initAppStateDefaults()`, called from `bootApp()` after the load resolves, so they can't run before real loaded data arrives and stomp it with empty defaults.
  - `persistState()` (25 call sites across `app.js`/`customers.js`/`settings.js`/`purchases.js`) **kept its exact call signature** — only its internals changed, to per-store `LocalDB.replaceAll()` calls instead of one giant `JSON.stringify` per `bn_*` key. 24 of 25 call sites needed zero changes, per the design in the cutover plan.
  - `SyncEngine._read()`/`_write()` now read/write an in-memory `_cache` array (populated at boot, mirrored to the `syncQueue` IndexedDB store on write) instead of `localStorage` directly — kept synchronous on purpose, since `pendingCount()`/`pendingBreakdown()` are called synchronously from UI code (the queue-count badge).
  - Every remaining scattered `localStorage.setItem`/`getItem` call (invoice/credit-note counters, last-synced timestamp) converted to a new `persistMeta(key, value)` helper, same call-site shape, writing through `LocalDB.setMeta()`.
  - **Zero `localStorage` references remain in `app.js`, `customers.js`, `settings.js`, or `purchases.js`** — verified by grep before committing, not assumed.
- **Verified live, not just via Node text tests**: a real Chromium boot smoke test (Playwright, the pre-installed browser in this environment) loaded the actual `index.html`, confirmed `indexedDB.databases()` shows a real `billnaw` v1 database, `APP_STATE` populated correctly post-boot (`inventory`/`vendors` are arrays, `catalogPage` defaulted to `1` — proving `initAppStateDefaults()` ran at the right time), zero uncaught page errors, and — the actual point of the whole change — **a written inventory item survived a full page reload**, read back correctly from IndexedDB by the new async boot path. The Supabase CDN script itself is blocked by this sandbox's network policy (unrelated to this work — same restriction hit earlier reaching `supabase.co` directly), so it was stubbed for this test; nothing about the storage-layer cutover depends on that stub.
- Full test suite: 13 files, 287 assertions, all green; `tsc --noEmit` clean.
- **Not done, and explicitly out of scope for this cutover** (per `docs/PHASE6_CUTOVER_PLAN.md` §9): no Capacitor/Tauri packaging, no change to any Postgres/RLS/RPC contract, no UI changes visible to a shop owner. Phase 7 (formalizing offline `sync state` beyond today's implicit pending/synced split) remains a separate, later step.

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

## Status as of 2026-09-15 (post-incident)

Since this plan was last written, the following happened, in order, all with explicit go-ahead at each step:

1. ~~Tag current HEAD as a rollback point~~ — attempted; the push was rejected by this session's git credentials (tag refs out of scope). The commit history itself remains a valid rollback point; a tag can be added manually if wanted.
2. ~~Add parity tests for `settings.js`/`customers.js`/`purchases.js`~~ — **Done** (`tests/extraction-parity.js`, 35/35 passing, diffs every function against its pre-extraction `app.js` body via git history).
3. ~~Begin Phase 5 (Supabase service layer extraction)~~ — **Done.** `src/services/supabase/index.ts` (typed `createSB` factory, all ~35 methods, `tests/supabase-parity.js`, 45/45) and `src/core/permissions/index.ts` (typed `applyRoleSecurity` port, `tests/permissions-parity.js`, 8/8, run against the actual legacy function via a stubbed DOM, not just a text diff).
4. ~~Run RUNBOOK TEST 12 live~~ — **Done, and it was not a clean pass.** Found a real, live cross-tenant leak on `shops` (two dashboard-drifted RLS policies, one `using (true)`), fixed it (`0010_fix_shops_rls_leak.sql`), which then exposed a real signup regression (Postgres requires `INSERT ... RETURNING` rows to satisfy SELECT policy, and a brand-new user has no profile yet), fixed with an atomic `SECURITY DEFINER` RPC (`0011_atomic_shop_signup.sql`) that also closed a pre-existing orphaned-shop-on-partial-failure bug. Full incident record in `docs/SECURITY_REPORT.md` §5. Both `supabaseClient.js` and its typed mirror were updated in lockstep and re-verified against `tests/supabase-parity.js`.

**This is the first genuinely live-verified checkpoint in this plan** — everything before it was static code review, however careful. The finding changes the risk picture: dashboard drift from the migrations-as-written is now a confirmed, not hypothetical, risk class for this project.

## Final Decision

**SAFE TO CONTINUE**, with one new mandatory precondition before treating any other table's RLS as trustworthy: **`docs/SECURITY_REPORT.md` §6 recommends running the same live-policy-vs-migration-file diff on every other tenant table** (`items`, `customers`, `sales`, `sales_returns`, `vendors`, `purchases`, `vendor_divisions`, `ai_purchase_staging`), not just `shops`. `shops` was only checked because TEST 12 happens to exercise it — nothing ruled out the same class of drift existing elsewhere. Recommended next actions, in order:

1. Live-diff the remaining 8 tenant tables' actual Dashboard policies against their migration files — cheap, no code change, directly informed by exactly how this incident was found.
2. Remove the two now-redundant `shops` INSERT policies once `create_shop_and_owner` is confirmed the only signup path in use.
3. Continue Phase 4 (`app.js` inventory/returns/reports/auth/POS extraction) or Phase 6 (local database) per your priority — both remain unstarted and are independent of the incident above.

No further code changes are made by this plan document itself; execution of any numbered step above is a separate, explicit next step requiring your go-ahead.
