/* ==========================================================================
   BILLNAW — ALERT & SUGGESTION ENGINE
   Extracted from app.js. Everything here is a pure calculation over
   APP_STATE — no DOM reads, no DOM writes, no network. That is exactly why
   it was safe to move first: the rendering that consumes these results
   stayed in app.js, so nothing about the UI changed.

   These are the functions covered by tests/run-tests.js (expiry parsing,
   composition matching), so a broken extraction fails the suite rather than
   failing silently in a shop.

   Load order matters (no bundler): this must load BEFORE app.js.
   ========================================================================== */

/* ==========================================================================
   STOCK & EXPIRY ALERTS
   Two different failure modes a shop actually loses money to: running out of
   a fast mover, and a pharmacy batch quietly passing its expiry date on the
   shelf (which is also a legal problem to sell, not just a write-off).
   Both surface in one notification centre so a shop owner has a single place
   to look each morning.
   ========================================================================== */
function getAlertThresholds() {
  const p = APP_STATE.tenantProfile;
  return {
    lowStock: Number.isFinite(p.lowStockThreshold) ? p.lowStockThreshold : 5,
    expiryDays: Number.isFinite(p.expiryWarnDays) ? p.expiryWarnDays : 30
  };
}

// Batch expiry is stored as 'YYYY-MM' or 'YYYY-MM-DD'. A month-only value
// is treated as the LAST day of that month — a batch marked 2026-09 is
// saleable through 30 Sep, and treating it as the 1st would flag stock as
// expired up to a month early.
function parseBatchExpiry(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = str.match(/^(\d{4})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2], 0); // day 0 of next month = last day of this one
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(date) {
  if (!date) return null;
  return Math.floor((date.getTime() - Date.now()) / 86400000);
}

function getLowStockItems() {
  const { lowStock } = getAlertThresholds();
  return (APP_STATE.inventory || [])
    .filter(i => {
      // Per-item override wins over the shop-wide default: a shop may want
      // a 2-unit floor on a slow-moving ₹65k chain but 20 on daily FMCG.
      const threshold = Number.isFinite(i.lowStockLevel) ? i.lowStockLevel : lowStock;
      return i.stock <= threshold;
    })
    .sort((a, b) => a.stock - b.stock);
}

function getExpiryAlerts() {
  const { expiryDays } = getAlertThresholds();
  const out = [];
  (APP_STATE.inventory || []).forEach(item => {
    (item.batches || []).forEach(b => {
      const exp = parseBatchExpiry(b.expiry);
      if (!exp) return;
      const days = daysUntil(exp);
      if (days === null || days > expiryDays) return;
      if ((b.stock ?? item.stock) <= 0) return; // nothing left to worry about
      out.push({
        itemId: item.id, name: item.name, batch: b.batch,
        expiry: b.expiry, days, stock: b.stock ?? item.stock,
        expired: days < 0
      });
    });
  });
  // Already-expired first, then soonest — that's the order a shop should
  // act in (pull from shelf now, then plan the rest).
  return out.sort((a, b) => a.days - b.days);
}

/* ==========================================================================
   PHARMACY — SIMILAR MOLECULE SUGGESTIONS
   When a medicine is out of stock, a pharmacist's instinct is to reach for
   another brand of the same salt. This surfaces that automatically instead
   of relying on the person at the counter knowing every brand equivalence.
   Composition is normalised (case, spacing, separators) before comparison so
   "Paracetamol 650mg", "paracetamol  650 mg" and "PARACETAMOL-650MG" match.
   ========================================================================== */
function normaliseComposition(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

// Splits a composition into its active salts so a combination drug still
// matches on a shared component (e.g. "Paracetamol + Caffeine" overlaps
// with plain "Paracetamol").
function compositionTokens(raw) {
  return normaliseComposition(raw)
    .split(/\s*\+\s*|\s{2,}/)
    .map(t => t.replace(/\b\d+\s*(mg|ml|mcg|g|iu)\b/g, '').trim())
    .filter(Boolean);
}

function findAlternatives(item) {
  if (!item || item.category !== 'Pharmacy') return [];
  const comp = item.meta?.composition || item.composition || '';
  if (!comp) return [];

  const wanted = new Set(compositionTokens(comp));
  if (!wanted.size) return [];

  return (APP_STATE.inventory || [])
    .filter(alt => alt.id !== item.id
      && alt.category === 'Pharmacy'
      && alt.stock > 0)
    .map(alt => {
      const tokens = compositionTokens(alt.meta?.composition || alt.composition || '');
      const shared = tokens.filter(t => wanted.has(t));
      return { alt, shared, exact: shared.length === wanted.size && tokens.length === wanted.size };
    })
    .filter(x => x.shared.length > 0)
    // Exact salt matches first, then broadest overlap, then most stock.
    .sort((a, b) => (Number(b.exact) - Number(a.exact)) || (b.shared.length - a.shared.length) || (b.alt.stock - a.alt.stock))
    .slice(0, 6);
}

window.getAlertThresholds = getAlertThresholds;
window.parseBatchExpiry = parseBatchExpiry;
window.daysUntil = daysUntil;
window.getLowStockItems = getLowStockItems;
window.getExpiryAlerts = getExpiryAlerts;
window.normaliseComposition = normaliseComposition;
window.compositionTokens = compositionTokens;
window.findAlternatives = findAlternatives;
