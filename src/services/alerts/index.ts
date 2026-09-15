/* ==========================================================================
   BILLNAW — ALERT & SUGGESTION ENGINE (typed extraction)

   Ported from alertEngine.js, which is entirely pure over APP_STATE (no
   DOM reads/writes, no network) — that's exactly why it was the second
   module extracted, right after gstConfig.js.

   One real (behavior-preserving) change from the legacy file: the legacy
   functions read the global APP_STATE directly; these take `inventory`/
   `tenantProfile` as explicit parameters instead. A real ES module
   shouldn't depend on an implicit global the way a classic script can —
   this is a module-boundary fix, not a logic change. tests/alerts-parity.js
   proves it by constructing one fixture, feeding it to both the legacy
   global-reading functions and this module's explicit-parameter functions,
   and asserting identical output.

   alertEngine.js remains UNCHANGED and is still what index.html loads.
   ========================================================================== */

export interface AlertTenantProfile {
  lowStockThreshold?: number;
  expiryWarnDays?: number;
}

export interface InventoryBatch {
  batch?: string;
  expiry?: string;
  stock?: number;
}

export interface InventoryItem {
  id: string | number;
  name: string;
  category?: string;
  stock: number;
  lowStockLevel?: number;
  batches?: InventoryBatch[];
  meta?: { composition?: string };
  composition?: string;
}

export interface AlertThresholds {
  lowStock: number;
  expiryDays: number;
}

export function getAlertThresholds(tenantProfile: AlertTenantProfile): AlertThresholds {
  return {
    lowStock: Number.isFinite(tenantProfile.lowStockThreshold) ? (tenantProfile.lowStockThreshold as number) : 5,
    expiryDays: Number.isFinite(tenantProfile.expiryWarnDays) ? (tenantProfile.expiryWarnDays as number) : 30,
  };
}

// Batch expiry is stored as 'YYYY-MM' or 'YYYY-MM-DD'. A month-only value is
// treated as the LAST day of that month — a batch marked 2026-09 is
// saleable through 30 Sep, and treating it as the 1st would flag stock as
// expired up to a month early.
export function parseBatchExpiry(raw: unknown): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = str.match(/^(\d{4})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2], 0); // day 0 of next month = last day of this one
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((date.getTime() - Date.now()) / 86400000);
}

export function getLowStockItems(inventory: InventoryItem[], tenantProfile: AlertTenantProfile): InventoryItem[] {
  const { lowStock } = getAlertThresholds(tenantProfile);
  return (inventory || [])
    .filter((i) => {
      // Per-item override wins over the shop-wide default: a shop may want
      // a 2-unit floor on a slow-moving ₹65k chain but 20 on daily FMCG.
      const threshold = Number.isFinite(i.lowStockLevel) ? (i.lowStockLevel as number) : lowStock;
      return i.stock <= threshold;
    })
    .sort((a, b) => a.stock - b.stock);
}

export interface ExpiryAlert {
  itemId: string | number;
  name: string;
  batch?: string;
  expiry?: string;
  days: number;
  stock: number;
  expired: boolean;
}

export function getExpiryAlerts(inventory: InventoryItem[], tenantProfile: AlertTenantProfile): ExpiryAlert[] {
  const { expiryDays } = getAlertThresholds(tenantProfile);
  const out: ExpiryAlert[] = [];
  (inventory || []).forEach((item) => {
    (item.batches || []).forEach((b) => {
      const exp = parseBatchExpiry(b.expiry);
      if (!exp) return;
      const days = daysUntil(exp);
      if (days === null || days > expiryDays) return;
      if ((b.stock ?? item.stock) <= 0) return; // nothing left to worry about
      out.push({
        itemId: item.id,
        name: item.name,
        batch: b.batch,
        expiry: b.expiry,
        days,
        stock: b.stock ?? item.stock,
        expired: days < 0,
      });
    });
  });
  // Already-expired first, then soonest — that's the order a shop should
  // act in (pull from shelf now, then plan the rest).
  return out.sort((a, b) => a.days - b.days);
}

// Composition is normalised (case, spacing, separators) before comparison so
// "Paracetamol 650mg", "paracetamol  650 mg" and "PARACETAMOL-650MG" match.
export function normaliseComposition(raw: unknown): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

// Splits a composition into its active salts so a combination drug still
// matches on a shared component (e.g. "Paracetamol + Caffeine" overlaps
// with plain "Paracetamol").
export function compositionTokens(raw: unknown): string[] {
  return normaliseComposition(raw)
    .split(/\s*\+\s*|\s{2,}/)
    .map((t) => t.replace(/\b\d+\s*(mg|ml|mcg|g|iu)\b/g, '').trim())
    .filter(Boolean);
}

export interface AlternativeMatch {
  alt: InventoryItem;
  shared: string[];
  exact: boolean;
}

export function findAlternatives(item: InventoryItem | null | undefined, inventory: InventoryItem[]): AlternativeMatch[] {
  if (!item || item.category !== 'Pharmacy') return [];
  const comp = item.meta?.composition || item.composition || '';
  if (!comp) return [];

  const wanted = new Set(compositionTokens(comp));
  if (!wanted.size) return [];

  return (inventory || [])
    .filter((alt) => alt.id !== item.id && alt.category === 'Pharmacy' && alt.stock > 0)
    .map((alt) => {
      const tokens = compositionTokens(alt.meta?.composition || alt.composition || '');
      const shared = tokens.filter((t) => wanted.has(t));
      return { alt, shared, exact: shared.length === wanted.size && tokens.length === wanted.size };
    })
    .filter((x) => x.shared.length > 0)
    // Exact salt matches first, then broadest overlap, then most stock.
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.shared.length - a.shared.length || b.alt.stock - a.alt.stock)
    .slice(0, 6);
}
