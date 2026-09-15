# BILLNAW ERP/POS — Target Architecture

Date: 2026-09-15 (Phase 1 baseline) — extended below with Phase 2–4 verification.
Basis: `docs/AUDIT_REPORT.md` current-state findings. Describes the destination state only — see `docs/MIGRATION_PLAN.md` for the incremental path to get there.

---

## 0. Phase 2–4 Progress Against This Target (new)

Comparing what actually shipped (verified in `docs/AUDIT_REPORT.md` §0) against the target structure defined in §3/§4 below:

| Target path | Status |
|---|---|
| `src/services/gst/` | **Done**, parity-tested against deployed `gstConfig.js`. |
| `src/services/export/` | **Done**, parity-tested. |
| `src/services/alerts/` | **Done**, parity-tested. |
| `src/services/printer/` | **Done**, parity-tested. |
| `src/services/supabase/` (typed `SB` replacement) | Not started. |
| `src/core/security/` | Partially started — `escape.ts` exists, but per §6 below this should remain a UI-convenience layer only; confirm it hasn't been treated as a security boundary anywhere it's used. |
| `src/core/permissions/`, `src/core/auth/`, `src/core/database/`, `src/core/sync/` | Not started. |
| `src/features/settings/`, `src/features/customers/`, `src/features/vendors|purchases/` | **Not matched by what shipped.** Phase 4 created `settings.js`, `customers.js`, `purchases.js` at the *repository root*, as classic scripts sharing global scope — not under `src/features/*`, not TypeScript, not React components. This is a legitimate intermediate step (get the code out of the `app.js` monolith first, worry about the target module system later) but should not be read as "Phase 4 of the target architecture is complete" — it's "app.js decomposition, stage 1 of 2" for those three responsibility areas. |
| `src/features/pos/`, `auth/`, `inventory/`, `returns/`, `reports/`, `expenses/`, `subscriptions/`, `dashboard/` | Not started — still inside `app.js`. |
| React/Vite wired as the deployed frontend | Not started — Vite exists only as a parallel, non-deployed build. `index.html` is unchanged. |

**Net assessment**: roughly the lowest-risk 25–30% of the target's Phase 3/4 module boundary has been established, entirely in the "pure logic, low coupling" tier the original plan correctly prioritized. Nothing in POS/checkout, auth, or the Supabase service layer — the higher-risk, higher-value tiers — has moved. This is exactly the order `docs/MIGRATION_PLAN.md` §1 prescribed; the plan is being followed, not skipped ahead.

## 1. Guiding Constraint

Everything below is additive to, or an incremental extraction from, the current system documented in `docs/AUDIT_REPORT.md`. Nothing here implies a rewrite-from-scratch: the RLS policies, atomic RPCs, idempotency design, and role-redaction functions already meet the target bar and are preserved as-is unless a specific finding says otherwise.

## 2. Target Stack

- **Frontend**: TypeScript + React + Vite, replacing the current script-tag-loaded monolith. The build tooling now exists and works (`tsc --noEmit` passes, Vite dev server runs) — the target state makes it the actual deployment path instead of a parallel proof-of-concept.
- **Backend**: unchanged — Supabase, PostgreSQL, Supabase Auth, Supabase Edge Functions. The current RLS/RPC design is the target backend architecture, not a stepping stone to something else.
- **Offline**: local database (e.g. IndexedDB via a wrapper, or SQLite via a WASM/native binding depending on platform) replacing the current localStorage-based `SyncEngine`, preserving its idempotency-key + replay semantics exactly.
- **Platforms**: Web/PWA (current), Android + iOS (via Capacitor), Windows/Desktop (via Tauri) — added in later phases, sharing the same React/TS core.

## 3. Target Directory Structure

```
src/
  app/
    App.tsx
    router.tsx
  components/
  features/
    auth/
    dashboard/
    pos/
    inventory/
    products/
    customers/          ← currently customers.js at root
    vendors/
    purchases/           ← currently purchases.js at root
    returns/
    expenses/
    reports/
    subscriptions/
    settings/            ← currently settings.js at root
  core/
    auth/
    database/
    sync/
    permissions/
    security/            ← escape.ts exists here already
  services/
    gst/                  ✓ done
    printer/               ✓ done
    export/                ✓ done
    alerts/                 ✓ done
    ai/
    supabase/
  types/
  utils/
tests/
supabase/
docs/                    ✓ this document lives here now
public/
```

## 4. Mapping: Current → Target (status column added)

| Current | Target | Status |
|---|---|---|
| `gstConfig.js` | `src/services/gst/` | **Done**, parity-tested. |
| `exportEngine.js` | `src/services/export/` | **Done**, parity-tested. |
| `printerEngine.js` | `src/services/printer/` | **Done**, parity-tested. Web Bluetooth/print-dialog platform coupling noted, will need a thin adapter boundary for Capacitor/Tauri in Phase 9/10. |
| `alertEngine.js` | `src/services/alerts/` | **Done**, parity-tested. |
| `supabaseClient.js` (`SB` namespace) | `src/services/supabase/` | Not started — highest-financial-risk extraction, ~35 method contracts to preserve exactly (see `docs/MIGRATION_PLAN.md` §2). |
| `app.js` auth sections (`AuthFlow`) | `src/features/auth/` + `src/core/auth/` | Not started. |
| `app.js` `SyncEngine` | `src/core/sync/` + `src/core/database/` | Not started. |
| `app.js` `applyRoleSecurity` | `src/core/permissions/` | Not started; remains UI-convenience only wherever it lives. |
| `app.js` POS/checkout | `src/features/pos/` | Not started — highest cross-coupling in the current file, correctly deferred. |
| `settings.js` (Phase 4 root file) | `src/features/settings/` | **Stage 1 done** (out of app.js); stage 2 (into `src/features/`, typed, React) not started. No parity test yet — see `docs/AUDIT_REPORT.md` §9 gap. |
| `customers.js` (Phase 4 root file) | `src/features/customers/` | **Stage 1 done**; stage 2 not started. No parity test yet. |
| `purchases.js` (Phase 4 root file, includes AI OCR intake) | `src/features/purchases/` + `src/features/vendors/` | **Stage 1 done**; stage 2 not started. No parity test yet — highest-stakes of the three given the RPC calls it makes. |
| `app.js` inventory, returns, reports | `src/features/<name>/` | Not started, still in `app.js`. |
| `index.html` markup | React components | Requires a template-extraction pass not yet performed. |
| `styles.css` (68KB) | TBD — CSS Modules, Tailwind, or preserved global stylesheet | Not yet audited. |
| `sw.js` | Vite PWA plugin-managed service worker | Not started; preserve "wait for user confirmation before swapping caches" behavior. |

## 5. Target Offline Architecture

```
UI (React)
 ↓
Application Service (src/features/*)
 ↓
Local Repository (src/core/database)
 ↓
Local Database (IndexedDB/SQLite)
 ↓
Sync Queue (src/core/sync)
 ↓
Cloud (Supabase client)
 ↓
PostgreSQL (existing atomic RPCs, unchanged)
```

Not started. Every queued transaction carries, at minimum, the fields the current system already has via `idempotency_key` + envelope `{kind, payload, queuedAt}`, extended with an explicit `sync state` enum (`pending`/`syncing`/`synced`/`failed`/`conflict`) surfaced in the UI — today the queue state is implicit/internal only. This is a strict superset of the current design, not a replacement of its idempotency guarantees. **Do not begin this until the Supabase service layer (`src/services/supabase/`) is extracted and contract-verified** — building a new offline core against an as-yet-unextracted, untyped RPC surface multiplies the risk of both efforts simultaneously.

## 6. Target Security Architecture

No target-state change to the RLS/RPC/role-redaction design — it already matches the required pattern (Authentication + Authorization + Tenant isolation + RLS + Server-side validation + Audit logging). The target frontend must preserve, not relax, the existing discipline: `core/security/` and `core/permissions/` are UI-convenience layers only, exactly like today's `applyRoleSecurity()` — every financial/role-sensitive read or write still routes through the same server-side RPCs, called through `src/services/supabase/` rather than the current `SB` object, with identical contracts. **Verified this pass**: `src/core/security/escape.ts` (the one piece of `core/` that exists today) is an escaping utility, not an access-control mechanism — consistent with this constraint.

## 7. What Does Not Change

- Database schema, migrations, and RLS policies remain as-is; new requirements are additive migrations (`0010_...` onward), never edits to `0001`–`0009`. Confirmed unchanged through Phase 2–4.
- GST/financial calculation logic (`TaxEngine`) is extracted verbatim into `src/services/gst/` with types added — no behavior change, verified via parity test in this pass, not just asserted.

## 8. Complexity Estimate by Module (updated)

| Module | Complexity | Status |
|---|---|---|
| GST/export/alerts/printer services | Low | **Done.** |
| Supabase service layer | Medium | Not started — next highest-value target per `docs/MIGRATION_PLAN.md`. |
| Auth | Medium | Not started. |
| Settings/customers/purchases-vendors | Medium each | Stage 1 (out of app.js) done for all three; stage 2 (into `src/features/`, typed) not started. |
| Inventory/returns/reports | Medium each | Not started, still in `app.js`. |
| POS/checkout | High | Not started, correctly deferred. |
| Offline/sync core | High | Not started. |
| CSS/UI migration to React (Phase 8) | High | Unscoped, CSS audit not yet performed. |

## 9. First Safe Implementation Step (updated for current state)

The original "extract gstConfig.js" step is **done**. The next lowest-risk step that follows the same proven pattern (parallel extraction + parity test, no deployment change) is:

**Add parity tests for `settings.js`, `customers.js`, and `purchases.js` against their eventual `src/features/*` typed equivalents once those are created** — or, if those three files are considered "done enough" for now as an interim state, the next module-boundary work should be **extracting `supabaseClient.js`'s `SB` namespace into `src/services/supabase/`** with a contract-preservation test per the checklist in `docs/MIGRATION_PLAN.md` §2, since every subsequent feature extraction (customers, purchases, and eventually POS) depends on a typed, tested Supabase layer existing first.
