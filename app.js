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

  sales: [],

  // Khata (party ledger) view state. Was set via top-level
  // `APP_STATE.vendors = APP_STATE.vendors || []; APP_STATE.khataTab =
  // 'customers'; ...` statements right before the Khata section's function
  // definitions, which the khata.js extraction can no longer rely on (those
  // statements ran once, at script-load time, and khataTab specifically
  // must NOT reset on every Khata-view navigation — moving it into a
  // per-navigation function like renderKhataView() would silently discard
  // the user's active tab choice every time they revisit the screen, unlike
  // the idempotent resets in the purchases.js/auth.js extractions). Folding
  // these into the APP_STATE literal itself preserves the exact same
  // one-time initialization behavior without any load-order dependency.
  vendors: [],
  khataTab: 'customers',
  khataSearch: '',
  khataFilter: 'all',

  // Sales-returns state — was `APP_STATE.returns = APP_STATE.returns || [];
  // APP_STATE.returnDraft = null;` as top-level statements right above the
  // Returns section's function definitions. Same fold-into-the-literal fix
  // as the Khata fields above, applied proactively this time.
  returns: [],
  returnDraft: null,

  // Catalog pagination — was `APP_STATE.catalogPage = 1;` as a top-level
  // statement right above the Pagination section's function definitions.
  // Same fold-into-the-literal fix as the fields above.
  catalogPage: 1
};

// Safe DOM Setters
const setTxt = (id, val) => { const el = $id(id); if (el) el.innerText = (val !== undefined && val !== null) ? val : ''; };
const setVal = (id, val) => { const el = $id(id); if (el) el.value = (val !== undefined && val !== null) ? val : ''; };
const setDisplay = (id, s) => { const el = $id(id); if (el) el.style.display = s; };

function persistState() {
  try {
    localStorage.setItem('bn_tenant', JSON.stringify(APP_STATE.tenantProfile));
    localStorage.setItem('bn_inv', JSON.stringify(APP_STATE.inventory));
    localStorage.setItem('bn_cust', JSON.stringify(APP_STATE.customers));
    localStorage.setItem('bn_sales', JSON.stringify(APP_STATE.sales));
    localStorage.setItem('bn_seq', APP_STATE.invCounter.toString());
    localStorage.setItem('bn_returns', JSON.stringify(APP_STATE.returns || []));
    localStorage.setItem('bn_purchases', JSON.stringify(APP_STATE.purchases || []));
  } catch (e) {}
}

try {
  const tp = localStorage.getItem('bn_tenant'); if (tp) APP_STATE.tenantProfile = { ...APP_STATE.tenantProfile, ...JSON.parse(tp) };
  const inv = localStorage.getItem('bn_inv'); if (inv) APP_STATE.inventory = JSON.parse(inv);
  const cst = localStorage.getItem('bn_cust'); if (cst) APP_STATE.customers = JSON.parse(cst);
  const sls = localStorage.getItem('bn_sales'); if (sls) APP_STATE.sales = JSON.parse(sls);
  const seq = localStorage.getItem('bn_seq'); if (seq) APP_STATE.invCounter = parseInt(seq, 10);
  const cnq = localStorage.getItem('bn_cn_seq'); if (cnq) APP_STATE.cnCounter = parseInt(cnq, 10);
  const rts = localStorage.getItem('bn_returns'); if (rts) APP_STATE.returns = JSON.parse(rts);
  const pch = localStorage.getItem('bn_purchases'); if (pch) APP_STATE.purchases = JSON.parse(pch);
  APP_STATE.lastSyncedAt = localStorage.getItem('bn_last_synced') || null;
} catch (e) {}

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
   OFFLINE DYNAMIC SVG QR CODE GENERATOR
   ========================================================================== */
/* ==========================================================================
   UPI QR CODE — real, scannable output via the vendored qrcode-generator
   library (vendor/qrcode.js). The previous version here was a hash-seeded
   random pattern that resembled a QR code but encoded nothing — every
   invoice printed so far had a UPI code that could not actually be scanned.
   This renders true QR modules and applies a premium finish (rounded
   finder-pattern eyes, brand-coloured corners, centre badge) without ever
   touching the payload-carrying data modules, so scannability is never
   sacrificed for style.
   ========================================================================== */
function generateDynamicUpiQR(amount, invoiceNo, opts = {}) {
  const upiId = APP_STATE.tenantProfile.upiId;
  const shop = APP_STATE.tenantProfile.shopName || 'Billnaw POS';

  if (!upiId) {
    // No UPI ID configured — showing a QR that can't be paid is worse than
    // showing nothing, because it looks functional until a customer tries it.
    return `<div style="width:140px; padding:14px; text-align:center; font-size:0.68rem; color:var(--text-muted); border:1px dashed var(--border); border-radius:10px;">
      Add a UPI ID in Settings → Hardware &amp; Print to enable scan-to-pay.
    </div>`;
  }

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shop)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`;

  let qr;
  try {
    // typeNumber 0 = auto-select the smallest QR version that fits the
    // payload; 'Q' (~25% error correction) — higher than the 'M' default —
    // because this code lives on thermal paper that fades/scuffs in a
    // pocket or under a counter, on top of carrying the centre badge below
    // (badge covers ~2.6% of the modules, comfortably inside this budget).
    qr = qrcode(0, 'Q');
    qr.addData(upiUrl);
    qr.make();
  } catch (err) {
    console.error('QR generation failed:', err);
    return `<div style="width:140px; padding:14px; text-align:center; font-size:0.68rem; color:var(--danger);">QR unavailable</div>`;
  }

  const count = qr.getModuleCount();
  const cell = opts.cell || 4.2;
  const quiet = cell * 2; // quiet zone: scanners need this margin to lock on
  const size = count * cell + quiet * 2;
  const dark = opts.dark || '#171A2E';   // navy — reads as "premium", not pure black
  const accent = opts.accent || '#6366D9';

  const isFinderZone = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);

  let modules = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      if (isFinderZone(r, c)) continue; // finder eyes drawn separately below
      const x = quiet + c * cell, y = quiet + r * cell;
      modules += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${(cell * 0.22).toFixed(2)}" fill="${dark}"/>`;
    }
  }

  // Three finder-pattern "eyes" with rounded corners in the brand colour —
  // the single biggest visual lever for "premium" without touching a data
  // module (scanners locate these by their exact 7x7/5x5/3x3 ratio, so
  // colour is safe to change but geometry is not).
  const eyePositions = [[0, 0], [0, count - 7], [count - 7, 0]];
  let eyes = '';
  eyePositions.forEach(([er, ec]) => {
    const ex = quiet + ec * cell, ey = quiet + er * cell;
    const outer = cell * 7, ring = cell * 5, inner = cell * 3;
    const rOuter = cell * 1.6, rInner = cell * 1.1;
    eyes += `
      <rect x="${ex}" y="${ey}" width="${outer}" height="${outer}" rx="${rOuter}" fill="none" stroke="${accent}" stroke-width="${cell * 0.9}"/>
      <rect x="${(ex + cell * 2).toFixed(2)}" y="${(ey + cell * 2).toFixed(2)}" width="${inner}" height="${inner}" rx="${rInner}" fill="${dark}"/>`;
  });

  // Centre badge: sits on the highest-redundancy area of an 'M'-correction
  // code, small enough (≤ ~6% of the code area) that error correction
  // reconstructs any covered modules — standard practice for branded QR
  // codes, not a hack.
  const badgeSize = size * 0.16;
  const badgeX = (size - badgeSize) / 2, badgeY = (size - badgeSize) / 2;
  const initial = esc((shop.trim()[0] || 'B').toUpperCase());
  const badge = `
    <rect x="${badgeX.toFixed(2)}" y="${badgeY.toFixed(2)}" width="${badgeSize.toFixed(2)}" height="${badgeSize.toFixed(2)}" rx="${(badgeSize * 0.28).toFixed(2)}" fill="#fff" stroke="${accent}" stroke-width="1.4"/>
    <text x="${(size / 2).toFixed(2)}" y="${(size / 2 + badgeSize * 0.14).toFixed(2)}" text-anchor="middle" font-size="${(badgeSize * 0.5).toFixed(2)}" font-weight="800" font-family="Inter, sans-serif" fill="${accent}">${initial}</text>`;

  return `<svg viewBox="0 0 ${size.toFixed(2)} ${size.toFixed(2)}" width="${opts.px || 132}" height="${opts.px || 132}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border-radius:10px;">
    <rect width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="#fff"/>
    ${modules}
    ${eyes}
    ${badge}
  </svg>`;
}

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

// Strips spaces, dashes and stray plus signs. Indian numbers get pasted in
// a dozen formats ("+91 86175 89620", "086175-89620"); Supabase needs E.164.
function normalizePhoneNumber(rawValue) {
  return String(rawValue || '').trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

// Blurring + disabling the shell behind the overlay stops a half-loaded
// dashboard being clickable through the auth screen.
function applyAuthLockState(isLocked) {
  const overlay = $id('authOverlay');
  const appShell = $q('.app-shell');
  if (appShell) {
    appShell.style.pointerEvents = isLocked ? 'none' : 'auto';
    appShell.style.filter = isLocked ? 'blur(3px)' : 'none';
    appShell.style.opacity = isLocked ? '0.5' : '1';
  }
  if (overlay) overlay.classList.toggle('hidden', !isLocked);
}

function togglePasswordVisibility(inputId, btn) {
  const el = $id(inputId);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  if (btn) btn.innerText = show ? '🙈' : '👁';
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
function isFatalSyncError(error) {
  if (!error) return false;
  return !/duplicate key/i.test(String(error));
}

const SyncEngine = {
  queueKey: 'bn_offline_sync_queue',

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

  _read() {
    try { return JSON.parse(localStorage.getItem(this.queueKey) || '[]'); }
    catch (e) { return []; }
  },
  _write(q) { localStorage.setItem(this.queueKey, JSON.stringify(q)); },

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

      let error = null;
      try {
        if (kind === 'sale') {
          ({ error } = await SB.saveSale(shopId, payload));
        } else if (kind === 'return') {
          if (!payload.cloudSaleId) {
            // The parent invoice hasn't synced yet, so there's no row to
            // attach this credit note to. Keep it queued and retry after
            // the sale ahead of it lands.
            remaining.push(entry);
            continue;
          }
          ({ error } = await SB.processReturn(shopId, payload.cloudSaleId, payload));
        } else if (kind === 'purchase') {
          ({ error } = await SB.savePurchase(shopId, payload));
        }
      } catch (e) {
        error = e.message;
      }

      // A duplicate idempotency key means it already committed — success.
      if (isFatalSyncError(error)) {
        remaining.push(entry);
        console.warn(`Sync retry pending (${kind}):`, error);
      }
    }

    this._write(remaining);
    updateSyncIndicator();
    if (!remaining.length) {
      APP_STATE.lastSyncedAt = new Date().toISOString();
      localStorage.setItem('bn_last_synced', APP_STATE.lastSyncedAt);
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
    localStorage.setItem('bn_last_synced', APP_STATE.lastSyncedAt);
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

window.addEventListener('DOMContentLoaded', () => {
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
