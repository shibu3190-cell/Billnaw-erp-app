# BILLNAW ERP/POS — F2 XSS Coverage Audit

Date: 2026-09-15
Basis: `docs/SECURITY_REPORT.md` F2 (XSS coverage gap). This is the "audit-only pass first" step F2's own recommended fix called for: classify every `innerHTML`/`outerHTML`/`insertAdjacentHTML` call site as (a) static/trusted HTML, (b) already escaped, or (c) needs escaping, then patch category (c) incrementally with test coverage per site.

## Method

`grep -n "innerHTML\s*=\|outerHTML\s*=\|insertAdjacentHTML"` across the four files with interpolation sites (`app.js`, `customers.js`, `settings.js`, `purchases.js`) found **85 assignment/call sites** (the earlier substring-count of 99 in prior audit passes included non-assignment mentions of the property name — comments, reads — not distinct interpolation sites; 85 is the accurate count of places that actually write markup).

Every site was read with surrounding context and classified. For sites embedding a variable inside another variable (e.g. a toast message built from a template literal, then passed to a function that escapes the whole string), the trace was followed to its actual DOM-writing call, not just the immediate line — a value can be "raw" at assembly and still safe if something downstream escapes it before it reaches `innerHTML` (this is how `showSaasToast`, search-result rendering, and several report tables work: build with raw fields, `esc()` once at the final render). This surfaced several near-misses that read like findings on a shallow grep but are not.

## Result

**One confirmed, real, exploitable finding. Fixed in this pass. Zero others found in categories (c).**

### Fixed: `renderCart()` (app.js) — cart line rendered `assignedIdentifier` unescaped

```js
// before
${it.assignedIdentifier ? 'ID: ' + it.assignedIdentifier : 'Untracked'}
// after
${it.assignedIdentifier ? 'ID: ' + esc(it.assignedIdentifier) : 'Untracked'}
```

`assignedIdentifier` is a cashier-typed field (serial/IMEI/HUID/batch, entered via the "Or Type / Scan New Serial" input in the attribute modal). Every *other* place this exact field is rendered was already escaped — the return-processing modal (`esc(l.assignedIdentifier)`), the printed A4/thermal invoice (`esc(it.assignedIdentifier)`, covered by the existing `tests/run-tests.js` regression test from a prior hardening pass), and the invoice audit-trail string. The live POS cart — the screen a cashier looks at on every single sale — was the one path that didn't. A cashier typing `"><img src=x onerror=...>` as a serial number would have executed it in their own browser the moment the cart re-rendered (`tbody.innerHTML += ...` runs on every `renderCart()` call, i.e. every add-to-cart). RLS bounds the blast radius to that shop's own session — this isn't cross-tenant — but it's a real, live, easily-triggered stored-XSS in the single most-used screen of the app, not a theoretical gap.

**Fix**: wrapped in `esc()`, matching the pattern used everywhere else this field is rendered. **Test**: `tests/run-tests.js` now source-extracts `renderCart()` and asserts it calls `esc(it.assignedIdentifier)` — a regression here means someone removed the call again, not that `esc()` itself broke (the other 3 existing XSS tests already cover that). 41/41 passing.

## Everything else checked: category (a) or (b), no action needed

Representative sample of what was traced and confirmed safe (not exhaustive — the full 85-site list was reviewed, this documents the classes of "looks risky, isn't" that came up repeatedly so a future reviewer doesn't have to re-derive them):

- **`showSaasToast(...)` call sites** (~15 sites): the *argument* passed in is often an unescaped template literal (`` `${item.name} is out of stock.` ``), but `showSaasToast`'s own body does `toast.innerHTML = ...${esc(message)}...` — the whole assembled string gets escaped once, at the point it actually reaches the DOM. Safe by construction; escaping at the call site would be redundant, not wrong, but isn't a gap.
- **`setTxt(...)` call sites**: sets `.innerText`, not `.innerHTML` — immune to this bug class regardless of content. Confirmed `setTxt`'s implementation before relying on this.
- **`confirm(...)` dialogs**: native browser dialog, plain text only, not a DOM sink at all.
- **Search results / activity feed / dashboard "top parties"** (`handleSearchModalInput`, `renderActivityFeed`, dashboard top-customers list): fields are escaped at final render (`esc(m.title)`, `esc(m.subtitle)`, `esc(c.name)`, etc.) even when assembled from raw fields earlier in the function. Traced each to its actual `innerHTML` write.
- **AI OCR staging table & bill header** (`purchases.js`, the category this audit's own risk model flagged as highest-risk): every field — vendor name, item name, HSN, warnings, serials/batches/HUIDs — is either `esc()`'d before insertion or written via `setTxt` (vendor name, invoice number, GSTIN, date are all `setTxt`, not `innerHTML`). Clean.
- **Customer 360 profile / purchase history** (`customers.js`): one field found genuinely interesting — `rets.map(r => r.creditNoteNo).join(', ')` (line 235) is unescaped. Credit note numbers are server-generated via the same sequencing pattern as invoice numbers (not free user text), so this is not classified as an exploitable finding, but it's the one place in this file where the "everything gets `esc()`'d" discipline isn't literally true. Noted as a low-priority follow-up (§ below), not fixed in this pass since it isn't a real vector today.
- **Settings staff table** (`settings.js`): `roleLabel` has an unescaped fallback branch (`: m.role`), but `profiles.role` is constrained by a Postgres `CHECK` to exactly `'super_admin' | 'owner' | 'cashier'` — not free text, can't carry a payload regardless of client-side escaping. No finding.
- **Numeric fields in HTML attributes** (item price/stock/cost/gst-rate in `value="${...}"`, IDs in `<option value="${i.id}">`): all backed by `numeric`/`int`/`uuid` Postgres columns, not free text. Even unescaped, these can't carry an XSS payload without a much deeper DB-layer type-integrity break, which is a different class of problem than this audit's scope.
- **SVG chart labels** (revenue trend chart): `b.label` is `Date.toLocaleDateString(...)` output — machine-generated, not user-controllable.
- **Static templates** (empty-state messages, table headers, loading placeholders, wizard dots, country-code list from a hardcoded constant): no user data enters these at all.

## Residual, not fixed in this pass

- **`rets.map(r => r.creditNoteNo).join(', ')`** (`customers.js` line 235) — unescaped, but credit note numbers are server-sequenced, not free text. Low priority; would only become a real finding if that sequencing were ever bypassed. Recommend wrapping in `esc()` anyway next time this function is touched, for defense-in-depth, not urgency.
- **Coverage going forward**: this was a manual audit, not a lint rule. Nothing currently prevents a *new* `innerHTML =` call site from being added without escaping — that's a process gap, not a code gap. If this codebase adds ESLint at some point (not currently configured), a rule flagging raw template-literal interpolation into `.innerHTML` would catch this class of bug at write-time instead of at next audit.

## Conclusion vs. the original F2 finding

The original finding ("no systematic guarantee every interpolation site is escaped — 3 known-fixed spots out of 99 call sites") is now more precisely characterized: of the 85 actual interpolation sites, **84 were already correctly escaped or provably safe**, and the 1 real gap has been fixed and test-covered. F2 is not "resolved" in the sense of a lint rule now guaranteeing this forever, but the manual audit it called for is complete, and the actual live risk it was tracking (a real, unescaped, user-reachable interpolation site) is gone. Recommend `docs/SECURITY_REPORT.md` F2 be downgraded from "open" to "audited, one fix applied, no lint enforcement" rather than left as an open unknown.
