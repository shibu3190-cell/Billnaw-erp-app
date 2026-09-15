# Phase 6 Cutover — Scoping Document (not yet approved, not yet started)

Date: 2026-09-15
Status: **Scoping only.** Nothing in this document has been implemented. Per `docs/MIGRATION_PLAN.md`'s own gate for Phase 6, the cutover itself requires a separate, explicit go-ahead after this plan is reviewed — this document is that review artifact, not a head start on the work.

What exists already: `src/core/database/index.ts` (a typed IndexedDB layer, 10/10 tests passing) and nothing else. `app.js` still uses `localStorage` exclusively. This document scopes the work to actually switch the deployed app over.

---

## 1. The real obstacle (found by reading the code, not assumed)

The instinct is to think of this as "swap `localStorage.setItem` for an IndexedDB write." That's not the hard part. The hard part is this, at `app.js` lines 172–182:

```js
try {
  const tp = localStorage.getItem('bn_tenant'); if (tp) APP_STATE.tenantProfile = ...;
  const inv = localStorage.getItem('bn_inv'); if (inv) APP_STATE.inventory = JSON.parse(inv);
  // ...five more of these...
} catch (e) {}
```

This is not a function. It is **top-level script code that runs synchronously the instant `app.js` is parsed** — before `DOMContentLoaded`, before any other script on the page runs, before the 234 other places in `app.js` that read `APP_STATE.*` assuming it's already fully populated. `localStorage` is synchronous, so this works today with zero ceremony.

**IndexedDB has no synchronous API at all.** Every read is a promise (or callback), minimum one event-loop tick. There is no way to make `IndexedDB.get()` block script execution the way `localStorage.getItem()` does. This means the boot sequence itself has to change shape — from "assume `APP_STATE` is ready the moment this script finishes parsing" to "wait for a promise, then boot" — not just the storage backend underneath it.

This is the actual scope of the cutover. Getting this part wrong (e.g., a race where some code runs before the async load resolves) is how a financial app silently shows stale or empty data to a shop owner on launch. It gets the most scrutiny in this plan.

## 2. Design: IndexedDB as a durability layer under the existing synchronous model, not a replacement for it

**Keep `APP_STATE` exactly as it is** — the single synchronous, in-memory source of truth every one of those 234 reference sites already assumes. Do not try to make reads of `APP_STATE.inventory` etc. async; that would mean touching all 234 sites, an enormous and unnecessary blast radius.

Instead:
- **Boot**: replace the top-level synchronous block with an async `loadState()` that populates `APP_STATE` from IndexedDB, awaited once, before anything that reads `APP_STATE` is allowed to run.
- **Persist**: `persistState()` (currently 16 call sites in `app.js`, 3 each in `customers.js`/`settings.js`/`purchases.js` — 25 total) **keeps its current synchronous-looking call signature**. Internally, it fires IndexedDB writes without the caller awaiting them (matching how `localStorage.setItem()` already behaves as fire-and-forget from every caller's perspective today). **This means 24 of the 25 call sites need zero code changes** — only `persistState()`'s own body changes.

This is the key design choice that keeps the cutover's blast radius bounded and matches the same "parallel layer, minimal call-site disruption" pattern every other extraction this migration has used.

## 3. Boot sequence, concretely

Current shape:
```
<script src="app.js">   // parses top-to-bottom
  ...
  [SYNC top-level load from localStorage into APP_STATE]   // line ~172
  ...
  [function/const declarations, including persistState()]
  ...
  window.addEventListener('DOMContentLoaded', () => { ...init UI... });  // line ~4351
```

Target shape:
```
<script src="app.js">
  ...
  [function/const declarations — unchanged, unaffected by boot timing]
  ...
  async function bootApp() {
    await loadStateFromIndexedDB();   // new async replacement for the old sync block
    // ...whatever DOMContentLoaded's handler currently does...
  }
  window.addEventListener('DOMContentLoaded', () => { bootApp(); });
```

**Verification performed** (not left as an open question): scanned every top-level statement between line 172 and the `DOMContentLoaded` handler at line 4351. Found real, load-bearing top-level code that depends on the synchronous timing, e.g.:

```js
APP_STATE.vendors = APP_STATE.vendors || [];
APP_STATE.returns = APP_STATE.returns || [];
```

These run immediately at script-parse time, right after today's synchronous `localStorage` load — the `|| []` only matters if the load found nothing. **If the load becomes async without moving these lines too, they'd execute before the load resolves and stomp real loaded data with empty defaults.** This is exactly the class of bug this scoping pass exists to catch before it happens, not after. `if ('serviceWorker' in navigator) { ... }` is also top-level but doesn't depend on `APP_STATE`, so it's unaffected.

**Consequence for the design**: every top-level statement that touches `APP_STATE` between the old load block and `DOMContentLoaded` must move inside `bootApp()`, after the `await`. This is a small, identifiable set (found by the scan above, not a large unknown), but it means `bootApp()` isn't just "await a promise then call the existing init" — a handful of these initialization lines need to be relocated as part of the same change, and each one re-verified to still run at the right moment relative to the rest of boot.

## 4. Migration of existing users' data (the one-time, irreversible-feeling part)

A shop that's been using the app has real data sitting in `localStorage` right now. The cutover must not lose it.

- **On first boot after the upgrade**, `bootApp()` checks a migration-completed flag (stored in IndexedDB's `meta` store, e.g. `{key: 'migratedFromLocalStorage', value: true}`).
- **If not yet migrated**: read the existing `bn_*` localStorage keys (same keys `persistState()`/the old load block already use), bulk-import them into the new IndexedDB stores via `putAll()`, then set the migration-completed flag, all before proceeding to normal boot.
- **`localStorage` data is not deleted** as part of this migration — it's left in place, inert, as a manual recovery path if something goes wrong with the new store. (A later, separate cleanup step can clear it once the cutover has been live and trusted for a while — not part of this cutover.)
- **Idempotency**: the migration-completed flag makes this safe to run multiple times (e.g., if boot is interrupted mid-migration and retried) — `putAll()` on already-imported data just overwrites with the same values.
- **Multi-tab race**: if a shop has the app open in two tabs during the upgrade, both could run the migration check simultaneously. Needs a lock — simplest option is a short-lived IndexedDB record (`{key: 'migrationInProgress', value: <timestamp>}`) that other tabs check and back off from, or just accept that a double-run of `putAll()` with identical data is harmless (it is, given the idempotent design above) and skip the lock entirely. **Recommend the latter** — simpler, and the operation is naturally idempotent, so the lock would be defending against a problem that doesn't actually exist here.

## 5. Fallback for IndexedDB unavailability

IndexedDB is near-universal in modern browsers, but Safari private browsing has historically had restrictions (throwing on open, or silently capping at a small quota in older versions), and some embedded/webview contexts disable it. `bootApp()` should:
- Attempt to open the IndexedDB database.
- On failure, fall back to the existing `localStorage`-based load path unchanged — i.e., don't hard-fail the app if IndexedDB isn't available, degrade to today's behavior (which has its own known cap, but at least works).
- Log which path was taken (not surfaced to the shop owner as an error — this is a compatibility fallback, not a fault).

## 6. Testing strategy

- **Already done**: `tests/local-database.js` — unit-level correctness of the storage layer itself (10/10 passing).
- **New, needed before cutover**: an integration test simulating the actual migration path — seed a fake `localStorage` with realistic `bn_*` data, run the new migration routine against it, assert every record landed correctly in IndexedDB and the migration flag is set. This can run in Node with `fake-indexeddb` plus a simple in-memory `localStorage` shim (same pattern `tests/shop-day-simulation.js` already uses for `global.window`/`global.localStorage`).
- **New, needed before cutover**: a test proving the async boot sequence doesn't race — e.g., simulate a slow IndexedDB open and confirm nothing reads `APP_STATE` before it resolves.
- **Cannot be tested from Node at all**: real-browser behavior (actual IndexedDB quota behavior, Safari private-browsing fallback, multi-tab timing). This needs a manual test pass in an actual browser before shipping — added as a new numbered test in `RUNBOOK.md`, the same way `TEST 12` already exists for tenant isolation. Draft test plan: fresh install (no existing data) boots correctly; existing shop with real `localStorage` data upgrades and sees identical inventory/sales/customers post-migration; airplane-mode / offline boot still works; two tabs open during the upgrade don't corrupt anything; Safari private browsing (or an IndexedDB-disabled context) falls back gracefully.

## 7. Rollback plan

Because `localStorage` data is left untouched by the migration (§4), rolling back is: revert the `app.js` change (back to the old synchronous load block), redeploy. Existing `localStorage` data is still there and still valid — nothing about the old code path is broken by having also written to IndexedDB. This is the main reason to *not* delete `localStorage` data as part of this cutover (a later, separate, lower-stakes cleanup can do that once the new path is trusted).

## 8. Explicit list of what changes

- `app.js`: the top-level synchronous load block (→ async `loadStateFromIndexedDB()` + one-time migration), `persistState()`'s internals (→ writes to IndexedDB instead of `localStorage`, call signature unchanged), the `DOMContentLoaded` handler (→ awaits `bootApp()`).
- `customers.js`/`settings.js`/`purchases.js`: **no changes expected** — their `persistState()` calls stay as-is per §2's design.
- `index.html`: likely no changes — `src/core/database/index.ts` is TypeScript, not yet compiled into a script tag `index.html` could load directly. **This raises a question this plan doesn't resolve yet**: does the cutover load a *transpiled* version of `src/core/database/index.ts` as a new classic `<script>` (matching how `gstConfig.js` etc. still work today, with `src/services/gst/index.ts` as an untouched parallel copy) — i.e., hand-port the logic into a new `database.js` file at the repo root, keeping the TS version as the typed reference the way `gst`/`export`/`alerts`/`printer` already work? That's almost certainly the right call, consistent with how every other Phase 3/5 extraction handled the "TS exists, but nothing deployed reads TypeScript directly" problem — flagging it here explicitly so it's a decision made on purpose, not discovered mid-implementation.
- `RUNBOOK.md`: new manual test section per §6.
- New migration-related test file(s) per §6.

## 9. Non-goals (explicitly out of scope for this cutover)

- No change to the Postgres schema, RLS, or any RPC contract.
- No change to `SyncEngine`'s idempotency-key design — the offline sync queue's *logic* doesn't change, only where its queue entries physically live (`syncQueue` IndexedDB store instead of the `bn_offline_sync_queue` localStorage key).
- No deletion of existing `localStorage` data as part of this cutover (§7).
- No UI changes visible to a shop owner — this is entirely an internal storage-layer swap. If it's done right, nobody using the app should notice anything changed.

## 10. Recommended order, once approved

1. Resolve the open question in §8 (transpiled `.js` file vs. some other loading strategy) — small decision, but blocks everything else.
2. Write the migration + async-boot integration tests (§6) *before* touching `app.js` — same "test first" discipline as every fix earlier today.
3. Implement the `app.js` boot/`persistState()` changes.
4. Full regression: existing 12 test suites (278 assertions) must stay green, plus the new tests from step 2.
5. Manual browser test pass per the `RUNBOOK.md` additions from §6, on at least: Chrome desktop, Chrome Android, Safari (including private browsing), before this is called done.
6. Tag a rollback point before deploying, per this project's established convention.

Given the number of open questions this scoping pass surfaced (the boot-timing verification in §3, the loading-strategy decision in §8, the multi-tab question in §4), I'd expect implementation itself to be at least a full separate session, not a quick continuation — flagging that now rather than discovering it mid-way.
