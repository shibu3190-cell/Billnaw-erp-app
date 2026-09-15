# BILLNAW ERP/POS — Target Architecture

Date: 2026-09-15
Basis: AUDIT_REPORT.md current-state findings. Describes the destination state only — see MIGRATION_PLAN.md for the incremental path to get there.

---

## 1. Guiding Constraint

Everything below is additive to, or an incremental extraction from, the current system documented in AUDIT_REPORT.md. Nothing here implies a rewrite-from-scratch: the RLS policies, atomic RPCs, idempotency design, and role-redaction functions already meet the target bar and are preserved as-is unless a specific finding says otherwise.

## 2. Target Stack

- **Frontend**: TypeScript + React + Vite, replacing the current script-tag-loaded monolith. `tsconfig.json`/`global.d.ts` already exist for static analysis — the target state makes them load-bearing (actual compilation) instead of advisory-only.
- **Backend**: unchanged — Supabase, PostgreSQL, Supabase Auth, Supabase Edge Functions. The current RLS/RPC design (§4/§5 of AUDIT_REPORT.md) is the target backend architecture, not a stepping stone to something else.
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
    customers/
    vendors/
    purchases/
    returns/
    expenses/
    reports/
    subscriptions/
    settings/
  core/
    auth/
    database/
    sync/
    permissions/
    security/
  services/
    gst/
    printer/
    export/
    alerts/
    ai/
    supabase/
  types/
  utils/
tests/
supabase/
docs/
public/
```

## 4. Mapping: Current → Target

| Current | Target | Notes |
|---|---|---|
| `gstConfig.js` (`TaxEngine`, GST_STATE_CODES) | `src/services/gst/` | Pure logic, already unit-tested — lowest-risk extraction, convert first. |
| `exportEngine.js` | `src/services/export/` | Pure logic, low coupling. |
| `printerEngine.js` | `src/services/printer/` | Some DOM/Bluetooth API coupling — needs a thin platform-adapter boundary for Capacitor/Tauri later. |
| `alertEngine.js` | `src/services/alerts/` | Pure logic. |
| `supabaseClient.js` (`SB` namespace) | `src/services/supabase/` | Preserve every one of the ~35 method contracts exactly (see MIGRATION_PLAN.md §5) — this is the highest-financial-risk extraction. |
| `app.js` auth sections (`AuthFlow`) | `src/features/auth/` + `src/core/auth/` | Split UI (`features/auth`) from session/role logic (`core/auth`). |
| `app.js` `SyncEngine` | `src/core/sync/` + `src/core/database/` | Becomes the offline-first core described in §5 below. |
| `app.js` `applyRoleSecurity` | `src/core/permissions/` | Remains explicitly documented as UI-convenience only; `core/security/` holds nothing that substitutes for server-side RLS. |
| `app.js` POS/checkout | `src/features/pos/` | Highest cross-coupling in the current file — migrate after lower-risk features are proven out. |
| `app.js` inventory, purchases, returns, customers, vendors, reports, settings, expenses, subscriptions | `src/features/<name>/` | One directory per existing responsibility cluster already identified in AUDIT_REPORT.md §1. |
| `index.html` markup | React components under `features/*/components` or `src/components/` | Requires a template-extraction pass not yet performed — flagged for a follow-up audit before Phase 8. |
| `styles.css` (68KB) | TBD — CSS Modules, Tailwind, or preserved as global stylesheet | Not yet audited; recommend a dedicated CSS architecture review before Phase 8 commits to an approach. |
| `sw.js` | Vite PWA plugin-managed service worker | Preserve the "wait for user confirmation before swapping caches" behavior — do not adopt an auto-`skipWaiting()` default. |

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

Every queued transaction carries, at minimum, the fields the current system already has via `idempotency_key` + envelope `{kind, payload, queuedAt}`, extended with an explicit `sync state` enum (`pending`/`syncing`/`synced`/`failed`/`conflict`) surfaced in the UI — today the queue state is implicit/internal only. This is a strict superset of the current design, not a replacement of its idempotency guarantees.

## 6. Target Security Architecture

No target-state change to the RLS/RPC/role-redaction design documented in AUDIT_REPORT.md §5 — it already matches the required pattern (Authentication + Authorization + Tenant isolation + RLS + Server-side validation + Audit logging). The target frontend must preserve, not relax, the existing discipline: `core/security/` and `core/permissions/` are UI-convenience layers only, exactly like today's `applyRoleSecurity()` — every financial/role-sensitive read or write still routes through the same server-side RPCs (`fetch_items_for_role`, `fetch_sales_for_role`, `shop_profit_summary`, `create_invoice_atomic`, etc.), called through `src/services/supabase/` rather than the current `SB` object, with identical contracts.

## 7. What Does Not Change

- Database schema, migrations, and RLS policies remain as-is; new requirements are additive migrations (`0010_...` onward), never edits to `0001`–`0009`.
- The two edge functions issue (SECURITY_REPORT.md F1) is resolved independently of this architecture work, not as part of it.
- GST/financial calculation logic (`TaxEngine`) is extracted verbatim into `src/services/gst/` with types added — no behavior change, verified by the existing `run-tests.js`/`shop-day-simulation.js` suites re-run against the extracted module before and after.

## 8. Complexity Estimate by Module (rough, for planning only)

| Module | Complexity | Why |
|---|---|---|
| GST/export/alerts services | Low | Pure functions, already tested. |
| Printer service | Low–Medium | Some Web Bluetooth/print-dialog platform coupling. |
| Supabase service layer | Medium | Large surface (~35 methods) but mechanical — contract-preserving wrap, not redesign. |
| Auth | Medium | OTP/OAuth flows + session/role handling; must preserve "no client-side PIN" design. |
| Inventory/customers/vendors/purchases/returns/reports/settings | Medium each | Independently extractable, moderate cross-references to POS/cart state. |
| POS/checkout | High | Most cross-coupled section of app.js; touches cart, GST, printing, offline queue, and invoice RPCs simultaneously. |
| Offline/sync core | High | Financial-integrity-critical; requires the most new test coverage (current gap per AUDIT_REPORT.md §8). |
| CSS/UI migration to React (Phase 8) | High | Unscoped until the dedicated CSS/markup audit recommended above is done. |

## 9. First Safe Implementation Step

Extract `gstConfig.js` into `src/services/gst/` under a new Vite+TS build that runs *alongside* the existing static files (does not replace `index.html`'s script-tag loading yet). Success criteria: `run-tests.js` and `shop-day-simulation.js` pass unmodified against the extracted module, `tsc` typechecks clean, and the existing app continues to load and function with zero behavior change. This proves the build pipeline and the extraction pattern on the lowest-risk, already-tested module before touching anything with financial or auth surface area.
