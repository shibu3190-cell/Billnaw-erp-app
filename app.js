/* ==========================================================================
   BILLNAW ENTERPRISE POS, ERP & REPORTS ENGINE (V7.0 REFINED)
   ========================================================================== */

const APP_STATE = {
  activeSector: 'All',
  invCounter: 1001,
  cart: [],
  selectedTender: 'Cash',
  currentUser: { role: 'Owner' },
  stagingItem: null,
  liveGoldRate: 7200.00,
  currentReportKey: 'party_outstanding',
  reportTabFilter: 'all',
  aiStagingItems: [],
  
  tenantProfile: {
    shopName: 'Om Betar Bhawan',
    gstin: '19ABCDE1234F1Z5',
    phone: '9876543210',
    address: 'Bongaon, West Bengal - 743235',
    stateCode: '19',
    assignedIndustry: 'All',
    isLocked: false,
    logoData: '',
    isRegistered: true,
    bankName: 'State Bank of India',
    bankAcc: '38472910481',
    bankIfsc: 'SBIN0001234',
    upiId: 'ombetar@sbi',
    terms: '1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. All disputes subject to local jurisdiction.',
    printerFormat: 'a4',
    autoCut: true,
    cutType: 'partial',
    cashDrawer: false,
    drawerPin: '2',
    thermalWidth: 80,
    mandatoryHsn: false,
    requireIdentifier: false,
    showRoundOff: true,
    gstPriceMode: 'exclusive',
    defaultGstRate: 18,
    defaultHsn: '',
    logo: '',
    lowStockThreshold: 5,
    expiryWarnDays: 30
  },

  inventory: [
    { 
      id: '1', 
      name: 'Motorola G84 5G (12/256)', 
      category: 'Electronics', 
      barcode: '8901234567890',
      hsn: '8517', 
      price: 18999.00, 
      cost: 16500.00, 
      gst: 18, 
      stock: 12, 
      serials: ['864592039481920', '864592039481921', '864592039481922'], 
      huids: [],
      batches: [],
      meta: { imei: '864592039481920', warranty: '12 Months' } 
    },
    { 
      id: '2', 
      name: 'Boat Rockerz 255 Pro+', 
      category: 'Electronics', 
      barcode: '8909876543210',
      hsn: '8518', 
      price: 1299.00, 
      cost: 950.00, 
      gst: 18, 
      stock: 45, 
      serials: ['SN-BT-98231'], 
      huids: [],
      batches: [],
      meta: { imei: 'SN-BT-98231', warranty: '12 Months' } 
    },
    { 
      id: '3', 
      name: 'Paracetamol 650mg Dolo', 
      category: 'Pharmacy', 
      barcode: '8901112223334',
      hsn: '3004', 
      price: 34.00, 
      cost: 22.00, 
      gst: 12, 
      stock: 220, 
      serials: [],
      huids: [],
      batches: [{ batch: 'DL-901', expiry: '2027-11', stock: 220 }],
      meta: { batch: 'DL-901', expiry: '2027-11' } 
    },
    { 
      id: '4', 
      name: 'Gold Ring 22K Hallmarked', 
      category: 'Jewelry', 
      barcode: '7113001',
      hsn: '7113', 
      price: 42500.00, 
      cost: 38000.00, 
      gst: 3, 
      stock: 6, 
      serials: [],
      huids: ['HUID-A92B1', 'HUID-X81C9'],
      batches: [],
      meta: { karat: '22K', netWt: 5.2, grossWt: 5.4, making: 2200 } 
    },
    { 
      id: '5', 
      name: 'Fortune Sunlite Oil 1L', 
      category: 'Grocery', 
      barcode: '8905556667778',
      hsn: '1512', 
      price: 135.00, 
      cost: 110.00, 
      gst: 5, 
      stock: 80, 
      serials: [],
      huids: [],
      batches: [],
      meta: { pack: 'Pouch' } 
    }
  ],

  customers: [
    { 
      phone: '91999888710', 
      name: 'Vijay Sharma', 
      category: 'Retail', 
      address: 'Kolkata, WB', 
      gstin: '19AABCV1234A1Z1', 
      dues: 11.00, 
      totalOrdersVal: 24500.00,
      orderHistory: [
        { invoiceNo: 'INV-1000', date: '22/08/2026', items: 'Motorola G84 5G', total: 18999.00, tender: 'UPI', status: 'PAID' }
      ]
    },
    { 
      phone: '98847636781', 
      name: 'Denish Desai', 
      category: 'Wholesale', 
      address: 'Bongaon, WB', 
      gstin: '19AABCD5678B1Z2', 
      dues: 2000.00, 
      totalOrdersVal: 185000.00,
      orderHistory: []
    }
  ],

  sales: []
};

// Safe DOM Setters
const setTxt = (id, val) => { const el = $id(id); if (el) el.innerText = (val !== undefined && val !== null) ? val : ''; };
const setVal = (id, val) => { const el = $id(id); if (el) el.value = (val !== undefined && val !== null) ? val : ''; };
const setDisplay = (id, s) => { const el = $id(id); if (el) el.style.display = s; };

// Phase 6 cutover (docs/PHASE6_CUTOVER_PLAN.md): storage moved from
// localStorage to IndexedDB (database.js / LocalDB). Two things this
// section preserves on purpose, unchanged from before the cutover:
//   1. APP_STATE stays the single synchronous, in-memory source of truth
//      every other part of this file already assumes — nothing about
//      reading APP_STATE.* changed. IndexedDB is a durability layer
//      underneath it, not a replacement for it.
//   2. persistState() keeps its exact call signature (still called
//      synchronously, fire-and-forget, from ~25 places across this file
//      and customers.js/settings.js/purchases.js) — only its internals
//      changed. No call site needed to change.
// What's different: no more ~5-10MB browser cap, and no more rewriting
// the ENTIRE dataset as one JSON string on every single state change —
// each collection is now its own IndexedDB store, written independently.
function persistState() {
  if (!APP_STATE._db) return; // boot hasn't opened the database yet
  const db = APP_STATE._db;
  LocalDB.setMeta(db, 'tenantProfile', APP_STATE.tenantProfile).catch(() => {});
  LocalDB.replaceAll(db, 'inventory', APP_STATE.inventory).catch(() => {});
  LocalDB.replaceAll(db, 'customers', APP_STATE.customers).catch(() => {});
  LocalDB.replaceAll(db, 'sales', APP_STATE.sales).catch(() => {});
  LocalDB.setMeta(db, 'invCounter', APP_STATE.invCounter).catch(() => {});
  LocalDB.replaceAll(db, 'returns', APP_STATE.returns || []).catch(() => {});
  LocalDB.replaceAll(db, 'purchases', APP_STATE.purchases || []).catch(() => {});
}

// Single-key meta writes (invoice/credit-note counters, last-synced
// timestamp) that used to be individual localStorage.setItem calls
// scattered at their own call sites — kept as individual call sites
// rather than folded into persistState(), so behavior at each of those
// sites is unchanged, just retargeted to IndexedDB.
function persistMeta(key, value) {
  if (!APP_STATE._db) return;
  LocalDB.setMeta(APP_STATE._db, key, value).catch(() => {});
}

// Replaces the old top-level `try { ...localStorage.getItem... } catch {}`
// block, which ran synchronously at script-parse time — localStorage
// allowed that; IndexedDB has no synchronous API, so this is now called
// (and awaited) from bootApp(), before anything that reads APP_STATE runs.
async function loadStateFromIndexedDB() {
  const db = await LocalDB.openBillnawDB();
  APP_STATE._db = db;

  try {
    const tp = await LocalDB.getMeta(db, 'tenantProfile');
    if (tp) APP_STATE.tenantProfile = { ...APP_STATE.tenantProfile, ...tp };
    const inv = await LocalDB.getAll(db, 'inventory'); if (inv.length) APP_STATE.inventory = inv;
    const cst = await LocalDB.getAll(db, 'customers'); if (cst.length) APP_STATE.customers = cst;
    const sls = await LocalDB.getAll(db, 'sales'); if (sls.length) APP_STATE.sales = sls;
    const seq = await LocalDB.getMeta(db, 'invCounter'); if (seq != null) APP_STATE.invCounter = seq;
    const cnq = await LocalDB.getMeta(db, 'cnCounter'); if (cnq != null) APP_STATE.cnCounter = cnq;
    const rts = await LocalDB.getAll(db, 'returns'); if (rts.length) APP_STATE.returns = rts;
    const pch = await LocalDB.getAll(db, 'purchases'); if (pch.length) APP_STATE.purchases = pch;
    APP_STATE.lastSyncedAt = (await LocalDB.getMeta(db, 'lastSyncedAt')) || null;

    SyncEngine._cache = await LocalDB.getAll(db, 'syncQueue');
  } catch (e) {
    console.warn('IndexedDB load failed, continuing with defaults:', e.message);
  }
}

// Every APP_STATE default that used to be bare top-level script code,
// relocated here (see each removal site for the "moved to
// initAppStateDefaults()" comment left in its place). These must run
// AFTER loadStateFromIndexedDB() resolves, not before — several of them
// (`|| []` patterns) only matter if the load found nothing, same as
// before the cutover; running them first would stomp real loaded data.
function initAppStateDefaults() {
  APP_STATE.cloudSession = APP_STATE.cloudSession ?? null;
  APP_STATE.cloudProfile = APP_STATE.cloudProfile ?? null;
  APP_STATE.vendors = APP_STATE.vendors || [];
  APP_STATE.khataTab = 'customers';
  APP_STATE.khataSearch = '';
  APP_STATE.khataFilter = 'all';
  APP_STATE.returns = APP_STATE.returns || [];
  APP_STATE.returnDraft = null;
  resetCatalogPaging();
}

// Replaces the old implicit "script finishes parsing = state is ready"
// contract. Awaited from the DOMContentLoaded handler below, before any
// UI code that reads APP_STATE runs — see docs/PHASE6_CUTOVER_PLAN.md §3
// for why this ordering is load-bearing, not a formality.
async function bootApp() {
  await loadStateFromIndexedDB();
  initAppStateDefaults();
}

/* ==========================================================================
   NETWORK EVENT LISTENERS & STATUS
   ========================================================================== */
function updateNetworkStatus() {
  const badge = $id('networkStatusBadge');
  const txt = $id('networkStatusText');
  if (!badge || !txt) return;

  if (navigator.onLine) {
    badge.className = 'net-badge online';
    txt.innerText = 'Online';
    SyncEngine.flushSyncQueue();
  } else {
    badge.className = 'net-badge offline';
    txt.innerText = 'Offline (Local Mode)';
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

/* ==========================================================================
   SECURITY & ROLE-BASED ACCESS CONTROL (RBAC)
   ========================================================================== */
// Renders a money value that may legitimately be absent for this role.
// Without this, a cashier's Stock Summary showed "₹NaN" in every cost cell,
// which looks like a data-corruption bug rather than a permission.
/* ==========================================================================
   TOAST + AUTH LOCK  (carried over from your build — kept because a toast
   is a better fit here than alert(), which blocks the thread and looks
   like a browser error on Android)
   ========================================================================== */
function showSaasToast(message, duration = 4000, tone = 'ok') {
  const toast = $id('authToast');
  if (!toast) return;
  // message is escaped even though nearly every call site passes a hardcoded
  // string literal — a few pass a server error message straight through
  // (e.g. the return-quantity guard's Postgres RAISE EXCEPTION echoes the
  // product name back), and a shop owner can name a product anything.
  // Escaping here protects every current and future call site in one place
  // rather than relying on each caller remembering to do it themselves.
  toast.innerHTML = `<span class="toast-ico">${tone === 'err' ? '!' : '\u2713'}</span><span>${esc(message)}</span>`;
  toast.className = `saas-toast ${tone === 'err' ? 'err' : 'ok'}`;
  // showSaasToast stores its pending-hide timer on itself (a static-ish
  // property on the function) so a second toast cancels the first one's
  // auto-hide instead of racing it. TS doesn't track ad-hoc properties
  // stashed on a function value, hence the cast — behavior is unchanged.
  const self = /** @type {any} */ (showSaasToast);
  clearTimeout(self.timeoutId);
  self.timeoutId = setTimeout(() => toast.classList.add('hidden'), duration);
}

/* ==========================================================================
   HTML ESCAPING
   Item names, customer names, addresses and reasons are user-controlled and
   are interpolated into innerHTML all over this app. A party saved as
   <img src=x onerror=alert(1)> would execute on every screen that lists them.
   Every interpolation of user data now goes through esc().
   ========================================================================== */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escapes a value for safe use as a SINGLE-QUOTED JS STRING LITERAL
// embedded inside an HTML attribute — a genuinely different job from esc().
// The browser HTML-decodes an attribute's entities (so &#39; becomes ')
// BEFORE the JS engine parses that attribute's text as an onclick handler.
// That means esc() alone — correct for displaying text — actively breaks
// any onclick argument built from a name containing an apostrophe: D'Souza
// and D'Silva are common Indian surnames, and O'Brien's is a common shop
// name, so this was not a theoretical edge case.
// Order matters: escape the JS string literal first (backslash, then
// quote), THEN HTML-escape the result — reversing the order would
// re-escape the JS-level backslash and break it.
function escJs(v) {
  if (v === null || v === undefined) return '';
  const jsSafe = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return jsSafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtCost(v) {
  return (v === null || v === undefined || isNaN(v)) ? '—' : '₹' + Number(v).toFixed(2);
}

function applyRoleSecurity(role) {
  const isOwner = role === 'Owner' || role === 'owner';
  APP_STATE.isOwner = isOwner;

  // NOTE: hiding these elements is a usability measure, NOT the security
  // boundary. Anyone can un-hide a DOM node from devtools. The actual
  // enforcement is server-side: fetch_items_for_role / fetch_sales_for_role
  // return cost as NULL for cashiers, and shop_profit_summary refuses them
  // outright, so there is no cost data in the page to reveal.
  $qa('.admin-only').forEach((el) => {
    el.style.display = isOwner ? '' : 'none';
  });
  $qa('.cost-sensitive').forEach((el) => {
    el.style.display = isOwner ? '' : 'none';
  });
  
  const badge = $id('roleBadge');
  if (badge) {
    badge.innerText = isOwner ? '👑 Owner' : '🛒 Staff';
    badge.style.background = isOwner ? 'var(--forest-panel)' : '#eef5f1';
    badge.style.color = isOwner ? 'var(--accent-gold)' : 'var(--forest-dark)';
  }
}

/* ==========================================================================
   OFFLINE-FIRST SYNC ENGINE
   ========================================================================== */
// Returns a real boolean. Previously this was written inline as
// `error && !/duplicate key/i.test(error)`, which evaluates to null/undefined
// when error is null — falsy, so it happened to work, but a predicate that
// returns three different types is a trap for the next person who uses it
// with === or passes it to a filter.
//
// errorCode, when available, is the Postgres SQLSTATE from the Supabase
// client (SB.saveSale/savePurchase/processReturn now return it alongside
// the message — see supabaseClient.js). '23505' is unique_violation: the
// atomic RPCs' own idempotency check (SELECT-then-insert on idempotency_key)
// already turns a normal retry into a successful "replayed" response with
// no error at all, so a real 23505 here only happens in the narrow race
// between two concurrent calls with the same key — still "already synced,
// not a failure" either way. Checking the code is precise; the regex
// fallback below only runs when no code is available (e.g. a thrown JS
// exception with no Postgres error shape at all, or an older cached
// version of these SB methods during a rolling deploy) and is kept for
// that reason, not because it's still the primary signal.
function isFatalSyncError(error, errorCode) {
  if (!error) return false;
  if (errorCode) return errorCode !== '23505';
  return !/duplicate key/i.test(String(error));
}

// F5 fix (docs/SECURITY_REPORT.md, supabase/migrations/0014): the atomic
// invoice/purchase/return RPCs skip a malformed line (bad item id, missing
// item, non-positive quantity) rather than failing the whole transaction —
// correct for offline resilience, but the money for that line was already
// charged/credited while its stock movement silently didn't happen. The
// RPCs now report which lines were skipped via `warnings`; this is the one
// place that turns that into something the shop owner actually sees,
// called after every successful (non-replayed) invoice/purchase/return.
function reportRpcSkipWarnings(data) {
  if (!data || !Array.isArray(data.warnings) || !data.warnings.length) return;
  console.warn('RPC reported skipped line(s):', data.warnings);
  const extra = data.warnings.length > 1 ? ` (+${data.warnings.length - 1} more)` : '';
  showSaasToast(`⚠️ ${data.warnings.length} line(s) need attention: ${data.warnings[0]}${extra}`, 7000, 'err');
}

const SyncEngine = {
  // In-memory mirror of the 'syncQueue' IndexedDB store — populated once
  // at boot by loadStateFromIndexedDB(), kept in sync on every write. Same
  // "synchronous in-memory truth, async durability underneath" split as
  // APP_STATE/persistState() above: _read()/_write() stay synchronous so
  // enqueue()/pendingCount()/pendingBreakdown() (called synchronously from
  // UI code, e.g. the queue-count badge) don't need to change shape.
  _cache: [],

  generateIdempotencyKey() {
    // Fixed "10000000-1000-4000-8000-100000000000" template — previously
    // spelled out as ([1e7]+-1e3+-4e3+-8e3+-1e11), an array-to-string
    // arithmetic trick that evaluates to this exact constant every time.
    // Same output, but doesn't need a TS arithmetic-operand exception to
    // type-check.
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => {
      const n = Number(c);
      return (n ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> n / 4).toString(16);
    });
  },

  _read() { return this._cache; },
  _write(q) {
    this._cache = q;
    if (APP_STATE._db) LocalDB.replaceAll(APP_STATE._db, 'syncQueue', q).catch(() => {});
  },

  // Unified queue. Previously only sales were queued — an offline return or
  // purchase was written to local state and then simply never reached the
  // server, so stock and credit notes silently diverged between devices.
  // Every mutation now goes through the same envelope: { kind, payload }.
  enqueue(payload, kind = 'sale') {
    const q = this._read();
    q.push({ kind, payload, queuedAt: new Date().toISOString() });
    this._write(q);
    updateSyncIndicator();
  },

  pendingCount() { return this._read().length; },

  pendingBreakdown() {
    const q = this._read();
    return {
      total: q.length,
      sale: q.filter(e => (e.kind || 'sale') === 'sale').length,
      return: q.filter(e => e.kind === 'return').length,
      purchase: q.filter(e => e.kind === 'purchase').length
    };
  },

  async flushSyncQueue() {
    if (!navigator.onLine || !APP_STATE.cloudSession) return;
    const q = this._read();
    if (!q.length) return;

    const shopId = APP_STATE.tenantProfile.shopId;
    const remaining = [];

    for (const entry of q) {
      // Tolerate the old flat format (a bare invoice object) so a queue
      // written by a previous version still drains after an app update.
      const kind = entry.kind || 'sale';
      const payload = entry.payload || entry;

      let error = null, errorCode = null, data = null;
      try {
        if (kind === 'sale') {
          ({ data, error, errorCode } = await SB.saveSale(shopId, payload));
        } else if (kind === 'return') {
          if (!payload.cloudSaleId) {
            // The parent invoice hasn't synced yet, so there's no row to
            // attach this credit note to. Keep it queued and retry after
            // the sale ahead of it lands.
            remaining.push(entry);
            continue;
          }
          ({ data, error, errorCode } = await SB.processReturn(shopId, payload.cloudSaleId, payload));
        } else if (kind === 'purchase') {
          ({ data, error, errorCode } = await SB.savePurchase(shopId, payload));
        }
      } catch (e) {
        error = e.message;
      }

      // A duplicate idempotency key means it already committed — success.
      if (isFatalSyncError(error, errorCode)) {
        remaining.push(entry);
        console.warn(`Sync retry pending (${kind}):`, error);
      } else {
        reportRpcSkipWarnings(data);
      }
    }

    this._write(remaining);
    updateSyncIndicator();
    if (!remaining.length) {
      APP_STATE.lastSyncedAt = new Date().toISOString();
      persistMeta('lastSyncedAt', APP_STATE.lastSyncedAt);
      updateLastSyncedLabel();
    }
  }
};

/* ==========================================================================
   OFFLINE SYNC STATUS INDICATOR
   A shop owner who closes the app with unsynced sales sitting in localStorage
   has no way to know they're at risk. This makes the queue visible.
   ========================================================================== */
function updateSyncIndicator() {
  const el = $id('syncStatusChip');
  if (!el) return;
  const b = SyncEngine.pendingBreakdown();
  const online = navigator.onLine;

  // Name what's actually waiting. "3 pending" tells a shop owner nothing;
  // "2 sales, 1 return waiting" tells them exactly what's at risk.
  const parts = [];
  if (b.sale) parts.push(`${b.sale} sale${b.sale > 1 ? 's' : ''}`);
  if (b.return) parts.push(`${b.return} return${b.return > 1 ? 's' : ''}`);
  if (b.purchase) parts.push(`${b.purchase} purchase${b.purchase > 1 ? 's' : ''}`);
  const label = parts.join(', ');

  if (!online) {
    el.className = 'sync-chip offline';
    el.innerHTML = `<span class="sync-dot"></span>Offline${label ? ` · ${esc(label)} waiting` : ''}`;
  } else if (b.total > 0) {
    el.className = 'sync-chip pending';
    el.innerHTML = `<span class="sync-dot"></span>${esc(label)} waiting to sync`;
  } else {
    el.className = 'sync-chip ok';
    el.innerHTML = `<span class="sync-dot"></span>Synced`;
  }
  el.title = APP_STATE.lastSyncedAt
    ? `Last synced ${new Date(APP_STATE.lastSyncedAt).toLocaleString('en-IN')}`
    : 'Not synced yet';
}

/* Human-readable "last synced" stamp (P1 #5). */
function updateLastSyncedLabel() {
  const el = $id('lastSyncedLabel');
  if (!el) return;
  if (!APP_STATE.lastSyncedAt) { el.innerText = 'Never synced from cloud'; return; }
  const mins = Math.floor((Date.now() - new Date(APP_STATE.lastSyncedAt).getTime()) / 60000);
  el.innerText = mins < 1 ? 'Synced just now'
    : mins < 60 ? `Synced ${mins} min ago`
    : `Synced ${new Date(APP_STATE.lastSyncedAt).toLocaleString('en-IN')}`;
}

/* Explicit pull-from-cloud (P1 #5). Reports read from local state, so a
   second device showed stale figures until the page was reloaded. */
async function refreshFromCloud() {
  if (!APP_STATE.cloudSession || !APP_STATE.tenantProfile.shopId) {
    showSaasToast('Sign in to refresh from cloud.', 3000, 'err');
    return;
  }
  if (!navigator.onLine) {
    showSaasToast('You are offline — showing the last cached data.', 3000, 'err');
    return;
  }

  const btn = $id('refreshCloudBtn');
  if (btn) { btn.disabled = true; btn.innerText = 'Refreshing…'; }

  try {
    await SyncEngine.flushSyncQueue();      // push local changes up first
    await hydrateCloudData(APP_STATE.tenantProfile.shopId);  // then pull down
    APP_STATE.lastSyncedAt = new Date().toISOString();
    persistMeta('lastSyncedAt', APP_STATE.lastSyncedAt);
    persistState();
    renderDashboard();
    renderCatalog();
    renderAlertCentre();
    updateLastSyncedLabel();
    updateSyncIndicator();
    showSaasToast('Refreshed from cloud.', 2500);
  } catch (err) {
    showSaasToast(`Refresh failed: ${err.message}`, 4000, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Refresh from cloud'; }
  }
}



async function hydrateCloudData(shopId) {
  const [itemsRes, custRes, salesRes, purchRes, retRes] = await Promise.all([
    SB.fetchItems(shopId), SB.fetchCustomersTagged(shopId), SB.fetchSales(shopId),
    SB.fetchPurchases(shopId), SB.fetchReturns(shopId)
  ]);

  if (purchRes && purchRes.data) {
    APP_STATE.purchases = purchRes.data.map(p => ({
      idempotency_key: p.idempotency_key, vendor: p.vendor_snapshot || {},
      billNo: p.bill_no || '', billDate: p.bill_date,
      date: new Date(p.created_at).toLocaleDateString('en-IN'), timestamp: p.created_at,
      taxable: Number(p.taxable), gstTotal: Number(p.gst_total),
      roundOff: Number(p.round_off), total: Number(p.total),
      interstate: p.interstate, paymentStatus: p.payment_status,
      amountPaid: Number(p.amount_paid), source: p.source, items: p.items || []
    }));
  }

  if (retRes && retRes.data) {
    APP_STATE.returns = retRes.data.map(r => ({
      creditNoteNo: r.credit_note_no, idempotency_key: r.idempotency_key,
      invoiceNo: null, cloudSaleId: r.sale_id,
      date: new Date(r.created_at).toLocaleDateString('en-IN'), timestamp: r.created_at,
      customer: r.customer_snapshot || {}, reason: r.reason, restock: r.restock,
      taxable: Number(r.taxable), gstTotal: Number(r.gst_total),
      roundOff: Number(r.round_off), total: Number(r.total),
      interstate: r.interstate, items: r.items || []
    }));
  }

  if (itemsRes.data && itemsRes.data.length) {
    APP_STATE.inventory = itemsRes.data.map(i => ({
      id: i.id, name: i.name, category: i.category, barcode: i.barcode,
      hsn: i.hsn, price: Number(i.price), cost: Number(i.cost), gst: Number(i.gst),
      stock: i.stock, serials: i.serials || [], huids: i.huids || [],
      batches: i.batches || [], meta: i.meta || {},
      lowStockLevel: i.low_stock_level ?? undefined,
      composition: i.composition || ''
    }));
  }

  if (custRes.data) {
    APP_STATE.customers = custRes.data
      .filter(c => !c.archived) // archived customers stay in the DB (history intact) but off every UI list
      .map(c => ({
        id: c.id, phone: c.phone, name: c.name, gstin: c.gstin || '', pan: c.pan || '',
        drugLicenseNo: c.drug_license_no || '', address: c.address || '',
        stateCode: c.state_code || '', category: c.category,
        dues: Number(c.dues), totalOrdersVal: Number(c.total_orders_val),
        isStarred: !!c.is_starred, isFrequent: !!c.is_frequent,
        ordersLast90d: Number(c.orders_last_90d) || 0, orderHistory: []
      }));
  }

  if (salesRes.data) {
    APP_STATE.sales = salesRes.data.map(s => ({
      invoiceNo: s.invoice_no, idempotency_key: s.idempotency_key,
      date: new Date(s.created_at).toLocaleDateString('en-IN'), timestamp: s.created_at,
      customer: s.customer_snapshot, tender: s.tender,
      taxable: Number(s.taxable), gstTotal: Number(s.gst_total),
      roundOff: Number(s.round_off), total: Number(s.total),
      interstate: s.interstate, placeOfSupply: s.place_of_supply,
      placeOfSupplyName: GST_STATE_CODES[s.place_of_supply] || '',
      industry: s.industry, items: s.items
    }));

    // Invoice numbers are unique per shop in the database. A fresh device or
    // cleared cache would otherwise restart the local counter and generate a
    // number that already exists — the insert then fails as a duplicate and
    // is never retried, silently losing a real sale.
    let maxSeen = 0;
    APP_STATE.sales.forEach(s => {
      const n = parseInt(String(s.invoiceNo).replace(/[^\d]/g, ''), 10);
      if (!isNaN(n) && n > maxSeen) maxSeen = n;
    });
    // Credit notes come back referencing sale_id; map them to the human
    // invoice number so Customer 360 and the register can pair them up.
    const byCloudId = {};
    APP_STATE.sales.forEach(sl => { if (sl.cloudId) byCloudId[sl.cloudId] = sl.invoiceNo; });
    (APP_STATE.returns || []).forEach(r => {
      if (!r.invoiceNo && r.cloudSaleId && byCloudId[r.cloudSaleId]) r.invoiceNo = byCloudId[r.cloudSaleId];
    });

    if (maxSeen + 1 > APP_STATE.invCounter) {
      APP_STATE.invCounter = maxSeen + 1;
      persistMeta('invCounter', APP_STATE.invCounter);
      if (APP_STATE._db) {
        LocalDB.replaceAll(APP_STATE._db, 'returns', APP_STATE.returns || []).catch(() => {});
        LocalDB.replaceAll(APP_STATE._db, 'purchases', APP_STATE.purchases || []).catch(() => {});
      }
    }
  }
}

/* ==========================================================================
   SHOP LOGO
   Downscaled to 256×256 and re-encoded before storage. An unprocessed phone
   photo is 3–8MB of base64 — that would be written to localStorage on every
   persistState(), shipped in every shop row, and re-parsed on every load.
   256px is beyond what either A4 print (≈20mm) or a 58/80mm thermal head
   (≈384px wide, 1-bit) can resolve, so nothing visible is lost.
   ========================================================================== */
const LOGO_MAX_PX = 256;

function handleLogoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    setTxt('logoStatus', 'Use a PNG, JPG or WebP image.');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    setTxt('logoStatus', 'That image is over 8MB — pick a smaller one.');
    return;
  }

  setTxt('logoStatus', 'Processing…');
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(LOGO_MAX_PX / img.width, LOGO_MAX_PX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // White matte behind transparent PNGs: a thermal printer and a printed
      // A4 both render transparency as black, turning a clean logo into a blob.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      APP_STATE.tenantProfile.logo = dataUrl;
      persistState();
      applyShopLogo();
      setTxt('logoStatus', `Saved · ${w}×${h}px · ${Math.round(dataUrl.length / 1024)}KB`);

      if (APP_STATE.cloudSession && APP_STATE.tenantProfile.shopId) {
        SB.updateShopSettings(APP_STATE.tenantProfile.shopId, { logo: dataUrl });
      }
    };
    img.onerror = () => setTxt('logoStatus', "That file couldn't be read as an image.");
    // readAsDataURL always resolves reader.result to a string (never
    // ArrayBuffer, which only happens with readAsArrayBuffer) — cast
    // reflects that guarantee rather than changing it.
    img.src = /** @type {string} */ (reader.result);
  };
  reader.onerror = () => setTxt('logoStatus', 'Could not read the file.');
  reader.readAsDataURL(file);
}

function removeShopLogo() {
  APP_STATE.tenantProfile.logo = '';
  persistState();
  applyShopLogo();
  setTxt('logoStatus', 'Logo removed.');
  if (APP_STATE.cloudSession && APP_STATE.tenantProfile.shopId) {
    SB.updateShopSettings(APP_STATE.tenantProfile.shopId, { logo: null });
  }
}

// Paints the logo everywhere it appears, with a clean initial-letter
// fallback so a shop that never uploads one still looks finished.
function applyShopLogo() {
  const p = APP_STATE.tenantProfile;
  const logo = p.logo || '';
  const initial = (p.shopName || 'B').trim().slice(0, 2).toUpperCase();

  const preview = $id('logoPreview');
  if (preview) {
    preview.innerHTML = logo
      ? `<img src="${logo}" alt="Shop logo">`
      : esc(initial);
  }
  const removeBtn = $id('logoRemoveBtn');
  if (removeBtn) removeBtn.style.display = logo ? 'inline-flex' : 'none';

  const pLogo = $id('pLogo');
  if (pLogo) {
    if (logo) { pLogo.src = logo; pLogo.style.display = 'block'; }
    else { pLogo.style.display = 'none'; }
  }

  const sidebarLogo = $id('sidebarLogoBox');
  if (sidebarLogo) {
    sidebarLogo.innerHTML = logo
      ? `<img src="${logo}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`
      : esc(initial.slice(0, 1));
  }
}

/* Stock/expiry alert calculations live in alertEngine.js (loaded first). */

function renderAlertCentre() {
  const low = getLowStockItems();
  const exp = getExpiryAlerts();
  const total = low.length + exp.length;

  const badge = $id('alertBadge');
  if (badge) {
    badge.innerText = total > 99 ? '99+' : String(total);
    badge.style.display = total ? 'inline-flex' : 'none';
  }

  const panel = $id('alertPanelBody');
  if (!panel) return;

  if (!total) {
    panel.innerHTML = `<div class="empty-state" style="padding:26px;">
      <div class="es-ico">✓</div><h4>Nothing needs attention</h4>
      <p>Stock levels and batch expiry all look healthy.</p></div>`;
    return;
  }

  let html = '';

  if (exp.length) {
    const expired = exp.filter(e => e.expired).length;
    html += `<div class="alert-group">
      <h5>Expiry${expired ? ` · ${expired} already expired` : ''}</h5>` +
      exp.slice(0, 15).map(e => `
        <button class="alert-row" onclick="switchView('inventory')">
          <span class="alert-ico ${e.expired ? 'danger' : 'warn'}">${e.expired ? '!' : '⏱'}</span>
          <span class="alert-body">
            <strong>${esc(e.name)}</strong>
            <small>Batch ${esc(e.batch || '—')} · ${e.expired
              ? `expired ${Math.abs(e.days)} day(s) ago`
              : `expires in ${e.days} day(s)`} · ${e.stock} in stock</small>
          </span>
        </button>`).join('') + `</div>`;
  }

  if (low.length) {
    const { lowStock } = getAlertThresholds();
    html += `<div class="alert-group">
      <h5>Low stock · threshold ${lowStock}</h5>` +
      low.slice(0, 15).map(i => `
        <button class="alert-row" onclick="switchView('inventory')">
          <span class="alert-ico ${i.stock === 0 ? 'danger' : 'warn'}">${i.stock === 0 ? '0' : i.stock}</span>
          <span class="alert-body">
            <strong>${esc(i.name)}</strong>
            <small>${i.stock === 0 ? 'Out of stock' : `${i.stock} left`} · reorder level ${
              Number.isFinite(i.lowStockLevel) ? i.lowStockLevel : lowStock}</small>
          </span>
        </button>`).join('') + `</div>`;
  }

  panel.innerHTML = html;
}

function toggleAlertPanel() {
  const panel = $id('alertPanel');
  if (!panel) return;
  const opening = !panel.classList.contains('open');
  panel.classList.toggle('open', opening);
  if (opening) renderAlertCentre();
}

function saveAlertSettings() {
  const p = APP_STATE.tenantProfile;
  const low = parseInt($id('cfgLowStock')?.value, 10);
  const days = parseInt($id('cfgExpiryDays')?.value, 10);
  p.lowStockThreshold = Number.isFinite(low) && low >= 0 ? low : 5;
  p.expiryWarnDays = Number.isFinite(days) && days >= 0 ? days : 30;
  persistState();
  renderAlertCentre();
  renderDashboard();
  showSaasToast('Alert thresholds saved.', 2500);
}


/* ==========================================================================
   KHATA — PARTY LEDGER (Customers + Vendors)
   Two distinct debt directions: customers owe the shop (receivable),
   vendors are owed BY the shop (payable). Settling one never touches the
   other's balance. Vendors already existed in Supabase (migration 0007)
   but were never fetched into APP_STATE — invisible data until this.
   ========================================================================== */
// defaults moved to initAppStateDefaults() — see the comment near
// persistState() for why.

function setKhataTab(tab) {
  APP_STATE.khataTab = tab;
  $id('khataTabCustomers')?.classList.toggle('active', tab === 'customers');
  $id('khataTabVendors')?.classList.toggle('active', tab === 'vendors');
  renderKhataView();
}

async function renderKhataView() {
  if (APP_STATE.khataTab === 'vendors' && !APP_STATE.vendorsLoaded && APP_STATE.cloudSession) {
    const { data } = await SB.fetchVendors(APP_STATE.tenantProfile.shopId);
    APP_STATE.vendors = (data || []).map(v => ({
      id: v.id, name: v.name, phone: v.phone || '', gstin: v.gstin || '',
      pan: v.pan || '', drugLicenseNo: v.drug_license_no || '',
      address: v.address || '', payables: Number(v.payables) || 0,
      isStarred: !!v.is_starred
    }));
    APP_STATE.vendorsLoaded = true;
  }

  const isVendorTab = APP_STATE.khataTab === 'vendors';
  let list = isVendorTab ? APP_STATE.vendors : APP_STATE.customers;
  const grid = $id('khataGrid');
  const summaryRow = $id('khataSummaryRow');
  if (!grid) return;

  const balanceOf = p => isVendorTab ? (p.payables || 0) : (p.dues || 0);

  const q = (APP_STATE.khataSearch || '').trim().toLowerCase();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.phone || '').includes(q));

  if (APP_STATE.khataFilter === 'starred') list = list.filter(p => p.isStarred);
  else if (APP_STATE.khataFilter === 'frequent') list = list.filter(p => p.isFrequent || p.isStarred);
  else if (APP_STATE.khataFilter === 'due') list = list.filter(p => balanceOf(p) > 0.005);

  const owingAll = (isVendorTab ? APP_STATE.vendors : APP_STATE.customers).filter(p => balanceOf(p) > 0.005);
  const totalOwed = TaxEngine.round2(owingAll.reduce((s, p) => s + balanceOf(p), 0));

  if (summaryRow) {
    summaryRow.innerHTML = `
      <div class="khata-stat">
        <span class="khata-stat-label">${isVendorTab ? 'You owe suppliers' : 'Customers owe you'}</span>
        <strong class="khata-stat-value ${isVendorTab ? 'danger' : 'ok'}">₹${totalOwed.toLocaleString('en-IN')}</strong>
      </div>
      <div class="khata-stat">
        <span class="khata-stat-label">Parties with a balance</span>
        <strong class="khata-stat-value">${owingAll.length}</strong>
      </div>`;
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="es-ico">${isVendorTab ? '🚚' : '👥'}</div>
      <h4>No ${isVendorTab ? 'vendors' : 'customers'} match</h4>
      <p>${q || APP_STATE.khataFilter !== 'all' ? 'Try clearing the search or filter.' : (isVendorTab ? 'Vendors appear here after your first Inward Purchase.' : 'Customers appear here after their first sale.')}</p>
    </div>`;
    return;
  }

  grid.innerHTML = [...list].sort((a, b) => balanceOf(b) - balanceOf(a)).map(p => {
    const balance = balanceOf(p);
    const settled = balance <= 0.005;
    const isFrequent = !isVendorTab && p.isFrequent;
    return `<div class="khata-card ${settled ? 'settled' : (isVendorTab ? 'payable' : 'receivable')}">
      <div class="khata-card-top">
        <div>
          <strong>${p.isStarred ? '⭐ ' : ''}${esc(p.name)}</strong>
          ${isFrequent ? '<span class="pill info" style="margin-left:6px;">Frequent</span>' : ''}
          <p class="khata-card-phone">${esc(p.phone || 'No phone on file')}</p>
        </div>
        <span class="khata-balance ${settled ? 'zero' : (isVendorTab ? 'payable' : 'receivable')}">
          ${settled ? 'Settled' : `₹${balance.toLocaleString('en-IN')}`}
        </span>
      </div>
      <div class="khata-card-actions">
        ${!isVendorTab ? `<button class="btn-pill secondary" style="flex:1;" onclick="switchView('reports'); openReport('cust_360', '${esc(p.phone)}');">View 360</button>` : `<button class="btn-pill secondary" style="flex:1;" onclick="openVendorEditModal('${esc(p.id)}')">Details</button>`}
        ${!settled ? `<button class="btn-pill primary" style="flex:1;" onclick="openSettlementModal('${isVendorTab ? 'vendor' : 'customer'}', '${esc(p.id || p.phone)}')">Settle</button>` : ''}
        ${!isVendorTab && !settled && p.phone ? `<button class="btn-pill ghost" onclick="sendWhatsAppReminder('${esc(p.phone)}')" title="Send WhatsApp reminder">💬</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function handleKhataSearch(value) {
  APP_STATE.khataSearch = value;
  renderKhataView();
}

function setKhataFilter(filter, el) {
  APP_STATE.khataFilter = filter;
  $qa('.khata-filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderKhataView();
}

function openSettlementModal(kind, id) {
  const party = kind === 'vendor'
    ? APP_STATE.vendors.find(v => v.id === id)
    : APP_STATE.customers.find(c => c.phone === id);
  if (!party) return;

  APP_STATE.settlementTarget = { kind, id };
  setTxt('settlementModalTitle', kind === 'vendor' ? 'Pay Supplier' : 'Record Payment');
  setTxt('settlementPartyName', party.name);
  setTxt('settlementAmountLabel', kind === 'vendor' ? 'Amount Paid' : 'Amount Received');
  const balance = kind === 'vendor' ? party.payables : party.dues;
  setTxt('settlementCurrentDue', `₹${(balance || 0).toFixed(2)}`);
  setVal('settlementAmount', (balance || 0).toFixed(2));
  $id('settlementModal')?.classList.add('open');
}

function closeSettlementModal() {
  $id('settlementModal')?.classList.remove('open');
  APP_STATE.settlementTarget = null;
}

async function submitSettlement() {
  const target = APP_STATE.settlementTarget;
  if (!target) return;

  const amount = parseFloat($id('settlementAmount')?.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showSaasToast('Enter a valid settlement amount.', 3000, 'err');
    return;
  }
  const mode = $id('settlementMode')?.value || 'Cash';

  if (target.kind === 'vendor') {
    const v = APP_STATE.vendors.find(x => x.id === target.id);
    if (!v) return;
    v.payables = Math.max(0, TaxEngine.round2(v.payables - amount));
    if (APP_STATE.cloudSession) {
      SB.client.from('vendors').update({ payables: v.payables }).eq('id', v.id)
        .then(({ error }) => { if (error) console.warn('Vendor settlement sync failed:', error.message); });
    }
    showSaasToast(`₹${amount.toFixed(2)} paid to ${v.name} via ${mode}.`, 3000);
  } else {
    const c = APP_STATE.customers.find(x => x.phone === target.id);
    if (!c) return;
    c.dues = Math.max(0, TaxEngine.round2(c.dues - amount));
    persistState();
    if (APP_STATE.cloudSession && c.id) {
      SB.upsertCustomer(APP_STATE.tenantProfile.shopId, {
        phone: c.phone, name: c.name, gstin: c.gstin || null,
        dues: c.dues, total_orders_val: c.totalOrdersVal || 0
      }).then(({ error }) => { if (error) console.warn('Customer settlement sync failed:', error.message); });
    }
    showSaasToast(`₹${amount.toFixed(2)} recorded from ${c.name} via ${mode}.`, 3000);
  }

  closeSettlementModal();
  renderKhataView();
  renderDashboard();
}

async function openVendorEditModal(vendorId) {
  const v = APP_STATE.vendors.find(x => x.id === vendorId);
  if (!v) return;
  APP_STATE.editingVendorId = vendorId;

  setVal('vendEditName', v.name);
  setVal('vendEditPhone', v.phone || '');
  setVal('vendEditAddress', v.address || '');
  setVal('vendEditGstin', v.gstin || '');
  setVal('vendEditPan', v.pan || '');
  setVal('vendEditDrugLicense', v.drugLicenseNo || '');
  setTxt('vendEditPayables', `₹${(v.payables || 0).toFixed(2)}`);

  const divList = $id('vendDivisionsList');
  if (divList) {
    divList.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem;">Loading divisions…</span>`;
    const { data } = await SB.fetchVendorDivisions(APP_STATE.tenantProfile.shopId, vendorId);
    divList.innerHTML = (data || []).length
      ? data.map(d => `<span class="pill info">${esc(d.name)}</span>`).join(' ')
      : `<span style="color:var(--text-muted); font-size:0.8rem;">No divisions recorded yet — add one during Inward Purchase.</span>`;
  }

  $id('vendorEditModal')?.classList.add('open');
}

function closeVendorEditModal() {
  $id('vendorEditModal')?.classList.remove('open');
  APP_STATE.editingVendorId = null;
}

function saveVendorEdit() {
  const v = APP_STATE.vendors.find(x => x.id === APP_STATE.editingVendorId);
  if (!v) return;

  v.name = $id('vendEditName')?.value.trim() || v.name;
  v.phone = $id('vendEditPhone')?.value.trim() || '';
  v.address = $id('vendEditAddress')?.value.trim() || '';
  v.gstin = $id('vendEditGstin')?.value.trim() || '';
  v.pan = $id('vendEditPan')?.value.trim().toUpperCase() || '';
  v.drugLicenseNo = $id('vendEditDrugLicense')?.value.trim() || '';

  if (APP_STATE.cloudSession) {
    SB.updateVendorDetails(v.id, {
      name: v.name, phone: v.phone || null, address: v.address || null,
      gstin: v.gstin || null, pan: v.pan || null, drug_license_no: v.drugLicenseNo || null
    }).then(({ error }) => { if (error) showSaasToast(`Sync failed: ${error}`, 3500, 'err'); });
  }

  closeVendorEditModal();
  renderKhataView();
  showSaasToast('Vendor details updated.', 2500);
}

function toggleVendorStar() {
  const v = APP_STATE.vendors.find(x => x.id === APP_STATE.editingVendorId);
  if (!v) return;
  v.isStarred = !v.isStarred;
  if (APP_STATE.cloudSession) SB.setVendorStar(v.id, v.isStarred);
  renderKhataView();
}

function sendWhatsAppReminder(phone) {
  const cust = APP_STATE.customers.find(c => c.phone === phone);
  if (!cust) return;

  const shopName = APP_STATE.tenantProfile.shopName || 'us';
  const message = `Hello ${cust.name}, this is a friendly reminder from ${shopName}. ` +
    `Your outstanding balance is ₹${(cust.dues || 0).toFixed(2)}. ` +
    `Please settle at your convenience. Thank you!`;

  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;

  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
}

function exportKhataToExcel() {
  const isVendorTab = APP_STATE.khataTab === 'vendors';
  const list = isVendorTab ? APP_STATE.vendors : APP_STATE.customers;
  if (!list.length) { showSaasToast('Nothing to export.', 2500, 'err'); return; }

  const headers = isVendorTab
    ? ['Vendor', 'Phone', 'GSTIN', 'PAN', 'Drug License', 'Payable (₹)']
    : ['Customer', 'Phone', 'GSTIN', 'PAN', 'Drug License', 'Due (₹)', 'Lifetime Value (₹)'];

  const rows = list.map(p => isVendorTab
    ? [p.name, p.phone, p.gstin || '', p.pan || '', p.drugLicenseNo || '', p.payables || 0]
    : [p.name, p.phone, p.gstin || '', p.pan || '', p.drugLicenseNo || '', p.dues || 0, p.totalOrdersVal || 0]);

  exportToExcel(
    `khata-${isVendorTab ? 'vendors' : 'customers'}-${new Date().toISOString().slice(0, 10)}`,
    isVendorTab ? 'Vendor Payables' : 'Customer Receivables',
    headers, rows
  );
}


/* PrinterEngine lives in printerEngine.js (loaded before this file). */

/* ==========================================================================
   SUBSCRIPTION & BILLING PANEL
   Plan, price and feature list are read from subscription_plans in
   Supabase, never hardcoded — the "app is free for now" state is a row
   (id='free', all_features_unlocked=true), not an absence of gating logic.
   Changing what a shop is allowed to do later is a database update from
   the backend, not a client deploy.
   ========================================================================== */
async function loadSubscriptionPanel() {
  const block = $id('currentPlanBlock');
  if (!APP_STATE.cloudSession || !APP_STATE.tenantProfile.shopId) {
    setTxt('planName', 'Not signed in');
    setDisplay('planFreeBanner', 'none');
    return;
  }

  const [{ data: sub, error: subErr }, { data: plans }] = await Promise.all([
    SB.fetchSubscription(APP_STATE.tenantProfile.shopId),
    SB.fetchAllPlans()
  ]);

  if (subErr || !sub?.plan) {
    setTxt('planName', 'Free Access');
    setTxt('planPrice', '₹0 / month');
    showSaasToast('Could not load live plan details — showing defaults.', 3500, 'err');
    return;
  }

  const plan = sub.plan;
  const usage = sub.usage || {};

  setTxt('planName', plan.name);
  setTxt('planPrice', plan.price_monthly > 0
    ? `₹${Number(plan.price_monthly).toLocaleString('en-IN')} / month`
    : 'Free');

  const pill = $id('planStatusPill');
  if (pill) { pill.className = 'pill paid'; pill.innerText = 'Active'; }

  setTxt('planInvoiceUsage', plan.max_invoices_monthly
    ? `${usage.invoices_this_month || 0} / ${plan.max_invoices_monthly}`
    : `${usage.invoices_this_month || 0} (unlimited)`);
  setTxt('planStaffUsage', plan.max_staff_accounts
    ? `${usage.staff_accounts || 0} / ${plan.max_staff_accounts}`
    : `${usage.staff_accounts || 0} (unlimited)`);

  const featureList = $id('planFeatureList');
  if (featureList) {
    const features = Array.isArray(plan.features) ? plan.features : [];
    featureList.innerHTML = features.map(f => `
      <li style="display:flex; align-items:center; gap:8px;">
        <span style="color:${f.included ? 'var(--mint-ink)' : 'var(--text-faint)'}; font-weight:800;">${f.included ? '✓' : '—'}</span>
        <span style="color:${f.included ? 'var(--text-dark)' : 'var(--text-faint)'};">${esc(f.label)}</span>
      </li>`).join('');
  }

  setDisplay('planFreeBanner', plan.all_features_unlocked ? 'block' : 'none');

  // Other plans, shown but never clickable — is_purchasable stays false
  // until the backend flips it, and this screen never fakes a checkout.
  const otherList = $id('otherPlansList');
  if (otherList) {
    const others = (plans || []).filter(p => p.id !== plan.id);
    otherList.innerHTML = others.length
      ? others.map(p => `
          <div style="border:1px solid var(--border); border-radius:11px; padding:13px 15px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <strong style="font-size:0.9rem;">${esc(p.name)}</strong>
              <p style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                ${p.price_monthly > 0 ? `₹${Number(p.price_monthly).toLocaleString('en-IN')}/month` : 'Free'}
                ${p.max_staff_accounts ? ` · ${p.max_staff_accounts} staff` : ''}
                ${p.max_invoices_monthly ? ` · ${p.max_invoices_monthly} invoices/mo` : ''}
              </p>
            </div>
            <span class="pill draft">${p.is_purchasable ? 'Available' : 'Coming soon'}</span>
          </div>`).join('')
      : `<p class="settings-hint">No other plans published yet.</p>`;
  }
}

// Client-side convenience check for future use — mirrors shop_has_feature()
// server-side, which is the real enforcement point. This local copy is for
// instant UI decisions (e.g. greying out a button) and must never be the
// only gate on anything that touches money or data.
function currentPlanUnlocksAll() {
  return APP_STATE.subscriptionCache?.all_features_unlocked !== false; // default open while free
}

function switchView(viewName, el) {
  $qa('.nav-item').forEach(n => n.classList.remove('active'));
  $qa('.mob-nav-item').forEach(n => n.classList.remove('active'));
  $qa('.view-container').forEach(v => v.classList.remove('active'));
  closeSettingsPanel(); // never land on a stale open panel from a previous visit

  if (el) el.classList.add('active');
  const target = $id(`view-${viewName}`);
  if (target) target.classList.add('active');

  // Mobile nav's Settings icon has no `el` passed in from openSettingsHome()
  // (it calls switchView('settings') with no second arg) — mark it active
  // manually so the bottom bar still reflects where the user actually is.
  if (viewName === 'settings') {
    $q('.mob-nav-item[onclick*="openSettingsHome"]')?.classList.add('active');
  }

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'pos') renderCatalog();
  if (viewName === 'inventory') renderInventoryTable();
  if (viewName === 'khata') renderKhataView();
  if (viewName === 'reports') closeReportDetail();
}

function openSearchModal() {
  const modal = $id('searchModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  setTimeout(() => $id('searchInput')?.focus(), 20);
}

function closeSearchModal() {
  const modal = $id('searchModal');
  if (!modal) return;
  modal.classList.add('hidden');
  const q = $id('searchInput');
  if (q) q.value = '';
  const results = $id('searchResults');
  if (results) results.innerHTML = '';
}

function handleSearchModalInput(value) {
  const q = (value || '').trim().toLowerCase();
  const results = $id('searchResults');
  if (!results) return;

  if (!q) {
    results.innerHTML = '<div class="search-empty">Search inventory, customers, or invoices.</div>';
    return;
  }

  const matches = [];

  (APP_STATE.inventory || []).forEach(item => {
    const haystack = [item.name, item.barcode, item.hsn, item.category, item.composition, ...(item.serials || []), ...(item.huids || [])].join(' ').toLowerCase();
    if (haystack.includes(q)) {
      matches.push({
        kind: 'Item',
        title: item.name,
        subtitle: `${item.category} • ₹${(item.price || 0).toFixed(2)}`,
        select: () => { closeSearchModal(); if (typeof openItemModal === 'function') openItemModal(item); }
      });
    }
  });

  (APP_STATE.customers || []).forEach(c => {
    const haystack = [c.name, c.phone, c.gstin, c.address].join(' ').toLowerCase();
    if (haystack.includes(q)) {
      matches.push({
        kind: 'Customer',
        title: c.name,
        subtitle: `${c.phone || '—'} • Due ${fmtCost(c.dues || 0)}`,
        select: () => { closeSearchModal(); if (typeof openCustEditModal === 'function') openCustEditModal(c); }
      });
    }
  });

  (APP_STATE.sales || []).forEach(s => {
    const haystack = [s.invoiceNo, s.customer?.name, s.customer?.phone, s.date].join(' ').toLowerCase();
    if (haystack.includes(q)) {
      matches.push({
        kind: 'Invoice',
        title: s.invoiceNo || 'Invoice',
        subtitle: `${s.customer?.name || 'Cash Customer'} • ₹${(s.total || 0).toLocaleString('en-IN')}`,
        select: () => { closeSearchModal(); if (typeof openInvoiceActionPopup === 'function') openInvoiceActionPopup(s.invoiceNo); }
      });
    }
  });

  const deduped = matches.slice(0, 8);
  results.innerHTML = deduped.length
    ? deduped.map((m, idx) => `
      <button class="search-result" type="button" data-index="${idx}">
        <span class="search-kind">${esc(m.kind)}</span>
        <strong>${esc(m.title)}</strong>
        <small>${esc(m.subtitle)}</small>
      </button>
    `).join('')
    : '<div class="search-empty">No matches found.</div>';

  results.querySelectorAll('.search-result').forEach((button, idx) => {
    button.addEventListener('click', () => deduped[idx].select());
  });
}

function toggleSidebarDrawer() {
  const drawer = $id('sidebarDrawer');
  if (!drawer) return;
  drawer.classList.toggle('open');
  const backdrop = $id('sidebarBackdrop');
  if (backdrop) backdrop.classList.toggle('visible', drawer.classList.contains('open'));
}

function closeSidebarDrawer() {
  const drawer = $id('sidebarDrawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  const backdrop = $id('sidebarBackdrop');
  if (backdrop) backdrop.classList.remove('visible');
}

/* ==========================================================================
   CUSTOMER PARTY ENTRY — address, place of supply, live tax-type hint
   ========================================================================== */
function populateStateDropdowns() {
  const opts = Object.entries(GST_STATE_CODES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
  const custSel = $id('custState');
  if (custSel) custSel.innerHTML = `<option value="">Place of Supply (State)</option>` + opts;
  // Default the billing state to the shop's own — the overwhelming majority
  // of counter sales are to a local, same-state customer. Still fully
  // editable per sale; this just removes a click most invoices don't need.
  resetCustomerStateToShopDefault();
}

// Called after populating the dropdown AND after clearing the party form
// post-checkout, so the default reasserts itself for the next customer
// rather than staying on whatever the previous customer's state was.
function resetCustomerStateToShopDefault() {
  const custSel = $id('custState');
  const shopState = APP_STATE.tenantProfile.stateCode || '';
  if (custSel && shopState && GST_STATE_CODES[shopState]) {
    custSel.value = shopState;
  }
}

function onCustomerStateChange() { updateTaxTypeHint(); }

function onCustomerGstinInput(val) {
  // Auto-select the state implied by the GSTIN so the cashier sees
  // immediately which tax will apply — silent misclassification here is
  // exactly the kind of error that surfaces months later at filing time.
  const code = (val || '').trim().slice(0, 2);
  const sel = $id('custState');
  if (sel && GST_STATE_CODES[code]) sel.value = code;
  updateTaxTypeHint();
}

function updateTaxTypeHint() {
  const hint = $id('taxTypeHint');
  if (!hint) return;
  const interstate = TaxEngine.isInterstate({
    customerGstin: $id('custGstin')?.value || '',
    customerStateCode: $id('custState')?.value || '',
    shopStateCode: APP_STATE.tenantProfile.stateCode || ''
  });
  hint.innerText = interstate
    ? 'Tax type: IGST (inter-state supply)'
    : 'Tax type: CGST + SGST (intra-state)';
  hint.style.color = interstate ? 'var(--info)' : 'var(--text-muted)';
}

/* ==========================================================================
   SETTINGS — GST slabs & printer format
   ========================================================================== */
function saveGstSlabs() {
  const raw = $id('cfgGstSlabs')?.value || '';
  const result = GstConfig.setSlabs(raw.split(',').map(s => s.trim()).filter(Boolean));
  const status = $id('gstSlabStatus');
  if (result.error) {
    if (status) { status.innerText = result.error; status.style.color = 'var(--danger)'; }
    return;
  }
  GstConfig.refreshAllRateSelects();
  if (status) {
    status.innerText = `✅ Saved: ${result.slabs.join('%, ')}%. Existing invoices unchanged.`;
    status.style.color = 'var(--success)';
  }
}

function onPrinterFormatChange() {
  const fmt = $id('cfgPrinterFormat')?.value || 'a4';
  setDisplay('thermalWidthRow', fmt === 'thermal' ? 'block' : 'none');
  savePrinterSettings();
}

// Previously these controls loaded from state but nothing ever wrote back —
// a shop would set Thermal, reload, and silently be on A4 again at the next
// sale. Persisted locally immediately, and pushed to the shop row so the
// setting follows the owner to a second device.
function savePrinterSettings() {
  const p = APP_STATE.tenantProfile;
  p.printerFormat = $id('cfgPrinterFormat')?.value || 'a4';
  p.thermalWidth = parseInt($id('cfgThermalWidth')?.value, 10) || 80;

  const cut = $id('cfgCutType')?.value || 'partial';
  p.autoCut = cut !== 'none';
  p.cutType = cut === 'none' ? 'partial' : cut;

  const drawer = $id('cfgCashDrawer')?.value || 'off';
  p.cashDrawer = drawer !== 'off';
  p.drawerPin = drawer === 'pin5' ? '5' : '2';

  persistState();

  if (APP_STATE.cloudSession && p.shopId) {
    SB.updateShopSettings(p.shopId, {
      printer_format: p.printerFormat,
      thermal_width: p.thermalWidth
    });
  }
}

function loadPrinterAndGstSettingsIntoDOM() {
  const p = APP_STATE.tenantProfile;
  setVal('cfgPrinterFormat', p.printerFormat || 'a4');
  setVal('cfgThermalWidth', String(p.thermalWidth || 80));
  setVal('cfgGstSlabs', GstConfig.getSlabs().join(', '));
  setVal('cfgCutType', p.autoCut === false ? 'none' : (p.cutType || 'partial'));
  setVal('cfgCashDrawer', p.cashDrawer ? (p.drawerPin === '5' ? 'pin5' : 'pin2') : 'off');
  onPrinterFormatChange();
  GstConfig.refreshAllRateSelects();
}

function filterSector(sec, el) {
  APP_STATE.activeSector = sec;
  $qa('.sector-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderCatalog();
}

function handleSearch(q) {
  const cards = $qa('.catalog-card');
  cards.forEach(c => { c.style.display = c.innerText.toLowerCase().includes(q.toLowerCase()) ? 'flex' : 'none'; });
}

function handleGlobalSearch(q) {
  if (!q) return;
  const found = APP_STATE.inventory.find(i => 
    i.name.toLowerCase().includes(q.toLowerCase()) || 
    i.barcode === q.trim() ||
    (Array.isArray(i.serials) && i.serials.includes(q.trim()))
  );
  if (found) { switchView('pos'); openItemModal(found); }
}

/* downloadCSV lives in exportEngine.js (loaded before this file). */

function exportData(type) {
  if (type === 'khata') {
    const rows = [['Name', 'Category', 'Phone', 'GSTIN', 'Closing Due (₹)', 'Lifetime Value (₹)']];
    APP_STATE.customers.forEach(c => {
      rows.push([c.name, c.category || 'Retail', c.phone, c.gstin || '', (c.dues || 0).toFixed(2), (c.totalOrdersVal || 0).toFixed(2)]);
    });
    downloadCSV(`khata-ledger-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }
}

// Hardware Barcode Interceptor
let barcodeBuffer = "";
let barcodeTimer = null;
window.addEventListener('keypress', (e) => {
  const authEl = $id('authOverlay');
  if (authEl && authEl.classList.contains('hidden')) {
    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 2) {
        handleScannedCode(barcodeBuffer);
      }
      barcodeBuffer = "";
    } else {
      barcodeBuffer += e.key;
      clearTimeout(barcodeTimer);
      barcodeTimer = setTimeout(() => { barcodeBuffer = ""; }, 60);
    }
  }
});

/* ==========================================================================
   GLOBAL SCOPE ATTACHMENT
   ========================================================================== */
window.showSaasToast = showSaasToast;
window.togglePasswordVisibility = togglePasswordVisibility;
window.applyAuthLockState = applyAuthLockState;
window.showRequestStep = showRequestStep;
window.showRegisterStep = showRegisterStep;
window.submitRegistration = submitRegistration;
window.finishOnboarding = finishOnboarding;
window.requestOtp = requestOtp;
window.editOtpTarget = editOtpTarget;
window.onOtpPaste = onOtpPaste;
window.signInWithGoogle = signInWithGoogle;
window.toggleCountryList = toggleCountryList;
window.pickCountry = pickCountry;
window.onPhoneInput = onPhoneInput;
window.onRegGstinInput = onRegGstinInput;
window.pickIndustry = pickIndustry;
window.setLoginMethod = setLoginMethod;
window.verifyOtpCode = verifyOtpCode;
window.resendOtp = resendOtp;
window.onOtpInput = onOtpInput;
window.onOtpKeydown = onOtpKeydown;
window.onCustomerStateChange = onCustomerStateChange;
window.onCustomerGstinInput = onCustomerGstinInput;
window.updateTaxTypeHint = updateTaxTypeHint;
window.saveGstSlabs = saveGstSlabs;
window.onPrinterFormatChange = onPrinterFormatChange;
window.savePrinterSettings = savePrinterSettings;




window.commitAiBill = commitAiBill;
window.editAiStagingField = editAiStagingField;
window.discardAiStagingItem = discardAiStagingItem;
window.matchInventoryItem = matchInventoryItem;
window.refreshFromCloud = refreshFromCloud;
window.loadMoreCatalog = loadMoreCatalog;
window.updateLastSyncedLabel = updateLastSyncedLabel;
window.loadSubscriptionPanel = loadSubscriptionPanel;
window.toggleAlertPanel = toggleAlertPanel;
window.saveAlertSettings = saveAlertSettings;
window.handleLogoUpload = handleLogoUpload;
window.removeShopLogo = removeShopLogo;
window.selectAlternative = selectAlternative;
window.updateSyncIndicator = updateSyncIndicator;
window.openSearchModal = openSearchModal;
window.closeSearchModal = closeSearchModal;
window.handleSearchModalInput = handleSearchModalInput;
window.toggleSidebarDrawer = toggleSidebarDrawer;
window.closeSidebarDrawer = closeSidebarDrawer;


function expandMobileSearch(e) {
  const box = $id('globalSearchBox');
  if (!box || box.classList.contains('expanded')) return;
  if (window.innerWidth > 640) return; // desktop is always expanded, nothing to do
  box.classList.add('expanded');
  $id('globalSearchInput')?.focus();
}

window.handleKhataSearch = handleKhataSearch;
window.setKhataFilter = setKhataFilter;
window.openVendorEditModal = openVendorEditModal;
window.closeVendorEditModal = closeVendorEditModal;
window.saveVendorEdit = saveVendorEdit;
window.toggleVendorStar = toggleVendorStar;
window.handleCust360Search = handleCust360Search;
window.selectCust360Result = selectCust360Result;
window.toggleCurrentCustomerStar = toggleCurrentCustomerStar;
window.openCustEditModal = openCustEditModal;
window.closeCustEditModal = closeCustEditModal;
window.saveCustEdit = saveCustEdit;
window.archiveCurrentCustomer = archiveCurrentCustomer;
window.escJs = escJs;
window.onPurVendorInput = onPurVendorInput;
window.expandMobileSearch = expandMobileSearch;
window.setKhataTab = setKhataTab;
window.renderKhataView = renderKhataView;
window.openSettlementModal = openSettlementModal;
window.closeSettlementModal = closeSettlementModal;
window.submitSettlement = submitSettlement;
window.sendWhatsAppReminder = sendWhatsAppReminder;
window.exportKhataToExcel = exportKhataToExcel;
window.openEditStockModal = openEditStockModal;
window.closeEditStockModal = closeEditStockModal;
window.saveEditedStock = saveEditedStock;
window.deleteInventoryItemPrompt = deleteInventoryItemPrompt;
window.renderInventoryTable = renderInventoryTable;

window.openInvoiceActionPopup = openInvoiceActionPopup;
window.closeInvoiceActionPopup = closeInvoiceActionPopup;
window.iapDownload = iapDownload;
window.iapPrint = iapPrint;
window.iapOpenEdit = iapOpenEdit;
window.iapSaveEdit = iapSaveEdit;
window.iapOpenCancel = iapOpenCancel;
window.openReturnModal = openReturnModal;
window.closeReturnModal = closeReturnModal;
window.updateReturnQty = updateReturnQty;
window.submitReturn = submitReturn;
window.drillDashboardCard = drillDashboardCard;
window.exportCurrentViewToExcel = exportCurrentViewToExcel;
window.exportCustomer360 = exportCustomer360;
window.exportToExcel = exportToExcel;
window.prefillFromExistingItem = prefillFromExistingItem;
window.populateRestockPicker = populateRestockPicker;
window.openSettingsHome = openSettingsHome;
window.openSettingsPanel = openSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.saveComplianceSettings = saveComplianceSettings;
window.saveIndustrySettings = saveIndustrySettings;

window.toggleScanContinuous = toggleScanContinuous;
window.submitManualScan = submitManualScan;
window.setTrendRange = setTrendRange;
window.renderTrendChart = renderTrendChart;
window.fullSignOut = fullSignOut;
window.lockPOS = lockPOS;
window.switchView = switchView;
window.openItemModal = openItemModal;
window.closeModal = closeModal;
window.commitModalItem = commitModalItem;
window.removeCart = removeCart;
window.setTender = setTender;
window.jumpToStep = jumpToStep;
window.checkoutBill = checkoutBill;
window.openInwardPurchaseModal = openInwardPurchaseModal;
window.closeInwardModal = closeInwardModal;
window.toggleInwardMode = toggleInwardMode;
window.saveManualPurchase = saveManualPurchase;
window.processAiInvoice = processAiInvoice;
window.openCameraScanner = openCameraScanner;
window.closeCameraScanner = closeCameraScanner;
window.openNewProductModal = openNewProductModal;
window.closeNewProdModal = closeNewProdModal;
window.saveNewProduct = saveNewProduct;
window.filterSector = filterSector;
window.handleSearch = handleSearch;
window.handleGlobalSearch = handleGlobalSearch;
window.autoFillCustomer = autoFillCustomer;
window.openReport = openReport;
window.closeReportDetail = closeReportDetail;
window.filterReportsCategory = filterReportsCategory;
window.renderCustomer360Profile = renderCustomer360Profile;
window.exportCurrentReportCSV = exportCurrentReportCSV;
window.exportData = exportData;
window.printReportDocument = printReportDocument;
window.saveAllSettings = saveAllSettings;
window.toggleAccordion = toggleAccordion;
window.updateLivePreview = updateLivePreview;
window.PrinterEngine = PrinterEngine;

/* ==========================================================================
   PWA UPDATE FLOW
   Detects a new service worker, shows a banner, and only activates it
   (+ clears old caches, which sw.js already does on 'activate') once the
   user taps "Update Now" — never silently swaps assets under an open tab.
   ========================================================================== */
let swRegistration = null;
let waitingWorker = null;

function showUpdateBanner(worker) {
  waitingWorker = worker;
  const banner = $id('updateBanner');
  if (banner) banner.classList.remove('hidden');
}

function dismissUpdateBanner() {
  const banner = $id('updateBanner');
  if (banner) banner.classList.add('hidden');
}

function applyAppUpdate() {
  if (!waitingWorker) { window.location.reload(); return; }
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

// Once the new worker takes control, do a one-time reload to load new assets.
let refreshingPage = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingPage) return;
    refreshingPage = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('sw.js').then((reg) => {
    swRegistration = reg;

    // Case 1: an update is already waiting when the page loads.
    if (reg.waiting) showUpdateBanner(reg.waiting);

    // Case 2: a new worker starts installing while the page is open.
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newWorker);
        }
      });
    });

    // Periodically ask the browser to check for a new sw.js (every 30 min,
    // plus once whenever the tab regains focus) — otherwise updates are
    // only ever checked on a hard page load.
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
}

window.showUpdateBanner = showUpdateBanner;
window.dismissUpdateBanner = dismissUpdateBanner;
window.applyAppUpdate = applyAppUpdate;

window.addEventListener('DOMContentLoaded', async () => {
  // Everything below reads APP_STATE — must not run until bootApp()'s
  // IndexedDB load has actually resolved. This await is the entire point
  // of the Phase 6 cutover's boot-sequence change (docs/PHASE6_CUTOVER_PLAN.md
  // §3): the old localStorage-based load was synchronous, so this ordering
  // was implicit; IndexedDB has no synchronous API, so it's explicit now.
  await bootApp();

  populateStateDropdowns();
  loadPrinterAndGstSettingsIntoDOM();
  applyShopLogo();
  renderAlertCentre();
  updateSyncIndicator();
  window.addEventListener('online', updateSyncIndicator);
  window.addEventListener('offline', updateSyncIndicator);
  setLoginMethod('email');
  initAuthGate();
  updateNetworkStatus();
  renderDashboard();
  renderCatalog();
  updateTaxTypeHint();
  setTxt('pDate', new Date().toLocaleDateString('en-IN'));
});
