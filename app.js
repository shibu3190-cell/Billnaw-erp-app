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

/* ==========================================================================
   CAMERA BARCODE & QR SCANNER ENGINE
   ========================================================================== */
let scannerStream = null;
let scannerInterval = null;

async function openCameraScanner() {
  const modal = $id('cameraScannerModal');
  const video = $id('scannerVideo');
  if (modal) modal.classList.add('open');

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    if (video) {
      video.srcObject = scannerStream;
      video.play();
    }

    // BarcodeDetector is Chrome/Edge/Android only. On iOS Safari and Firefox
    // it's absent — previously the camera just opened and sat there scanning
    // nothing, with no explanation, which reads as "the app is broken".
    // Now we say so and hand them a working manual path instead.
    if (!('BarcodeDetector' in window)) {
      setDisplay('scannerFallback', 'block');
      setTxt('scannerStatus', 'Live scanning is not supported by this browser.');
      const input = $id('scannerManualCode');
      if (input) { input.value = ''; input.focus(); }
      return;
    }

    setDisplay('scannerFallback', 'none');
    setTxt('scannerStatus', 'Point the camera at a barcode…');

    let supportedFormats = ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'ean_8', 'itf', 'codabar'];
    try {
      // Requesting a format the device can't decode makes the constructor
      // throw and kills scanning entirely — intersect with what's supported.
      const available = await BarcodeDetector.getSupportedFormats();
      supportedFormats = supportedFormats.filter(f => available.includes(f));
    } catch (e) { /* older impl without getSupportedFormats: use defaults */ }

    if (!supportedFormats.length) {
      setDisplay('scannerFallback', 'block');
      setTxt('scannerStatus', 'This device cannot decode barcode formats.');
      return;
    }

    const detector = new BarcodeDetector({ formats: supportedFormats });
    let lastCode = null, lastAt = 0;

    scannerInterval = setInterval(async () => {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      try {
        const barcodes = await detector.detect(video);
        if (!barcodes.length) return;

        const code = barcodes[0].rawValue;
        const now = Date.now();
        // Debounce: the detector fires ~4x/sec and would otherwise add the
        // same item repeatedly while the barcode is still in frame.
        if (code === lastCode && now - lastAt < 2000) return;
        lastCode = code; lastAt = now;

        beepScanFeedback();
        if (navigator.vibrate) navigator.vibrate(60);
        handleScannedCode(code);

        // Continuous mode keeps the camera open so a cashier can scan a
        // whole basket without reopening the scanner for each item.
        if (!APP_STATE.scanContinuous) closeCameraScanner();
        else setTxt('scannerStatus', `Added: ${code} — keep scanning`);
      } catch (e) { /* transient decode failure; next tick retries */ }
    }, 220);

  } catch (err) {
    const msg = err && err.name === 'NotAllowedError'
      ? 'Camera permission was denied. Allow camera access in your browser settings, or type the code manually.'
      : `Camera unavailable: ${err.message}`;
    setDisplay('scannerFallback', 'block');
    setTxt('scannerStatus', msg);
  }
}

// Short synthesised beep — no audio file to ship or cache, and it works
// offline. Confirms a scan when the cashier isn't looking at the screen.
function beepScanFeedback() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.start(); osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 250);
  } catch (e) { /* audio blocked until user gesture; silent is acceptable */ }
}

function toggleScanContinuous(el) {
  APP_STATE.scanContinuous = !!(el && el.checked);
}

function submitManualScan() {
  const input = $id('scannerManualCode');
  const code = (input?.value || '').trim();
  if (!code) return;
  handleScannedCode(code);
  if (input) input.value = '';
  if (!APP_STATE.scanContinuous) closeCameraScanner();
}

function closeCameraScanner() {
  const modal = $id('cameraScannerModal');
  if (modal) modal.classList.remove('open');
  if (scannerInterval) clearInterval(scannerInterval);
  if (scannerStream) {
    scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
  }
}

function handleScannedCode(code) {
  const c = code.trim();
  if (!c) return;

  const match = APP_STATE.inventory.find(i => 
    i.barcode === c || 
    (Array.isArray(i.serials) && i.serials.includes(c)) ||
    (Array.isArray(i.huids) && i.huids.includes(c)) ||
    (Array.isArray(i.batches) && i.batches.some(b => b.batch === c))
  );

  if (match) {
    openItemModal(match);
    setTimeout(() => {
      const sel = $id('mSerialSelect');
      if (sel) sel.value = c;
    }, 100);
  } else {
    alert(`Scanned code "${c}" not found in stock master.`);
  }
}

/* ==========================================================================
   GST TAX SPLIT (CGST+SGST vs IGST)
   Determines transaction type from customer GSTIN state code vs shop state
   code. B2C (no customer GSTIN) is treated as intra-state — the overwhelming
   majority case for small retail/kirana/pharmacy counters. A shop that
   regularly bills registered out-of-state B2B parties should set the
   customer GSTIN each time; this is a reasonable low-cost default, not a
   full place-of-supply engine (see notes at end of this file).
   ========================================================================== */
// isInterstateSale() removed — superseded by TaxEngine.isInterstate(),
// which also considers the explicitly-selected billing state (needed for
// B2C customers who have no GSTIN). Keeping two implementations risked
// one screen classifying a sale differently from another.

// Fires after the sale is already printed/complete locally — never blocks
// the counter on network. On any failure this falls back to the same
// offline queue, retried by flushSyncQueue() next time the app is online.
// KNOWN LIMITATION: invoice-save and stock-decrement are two separate
// network calls, not one transaction — a failure between them (rare, but
// possible on a dropped connection) can leave stock un-decremented for an
// invoice that did save. Low-cost fix for now; the real fix is a single
// Postgres function that does both atomically — flag if you want that next.
// Fires after the sale is already printed/complete locally — never blocks
// the counter on network. On any failure this falls back to the offline
// queue, retried by flushSyncQueue() next time the app is online.
//
// SB.saveSale() calls create_invoice_atomic, which does ALL THREE of:
// insert invoice, decrement every line's stock, upsert the customer ledger —
// inside one Postgres transaction. Nothing else belongs here.
//
// This function previously ALSO looped SB.decrementStock() and called
// SB.upsertCustomer() after saveSale. Two real bugs resulted:
//   1. Every online sale decremented stock TWICE (once in the RPC, once in
//      the loop), so inventory drained at double the real rate.
//   2. The upsert passed `dues: existing.dues` — the pre-sale balance — which
//      overwrote the value the RPC had just correctly incremented, silently
//      erasing the debt from every Khata (credit) sale.
async function syncInvoiceToCloud(invoice) {
  if (!APP_STATE.cloudSession) { SyncEngine.enqueue(invoice); return; }
  const shopId = APP_STATE.tenantProfile.shopId;

  try {
    const { data, error } = await SB.saveSale(shopId, invoice);

    // A duplicate idempotency_key means this exact sale is already committed
    // (a retry landed twice). That's success, not failure — re-queuing it
    // would loop forever.
    if (isFatalSyncError(error)) throw new Error(error);

    // Keep the server-assigned row id so returns can be raised against this
    // invoice without a round-trip to look it up.
    if (data && data.sale_id) {
      invoice.cloudId = data.sale_id;
      const local = APP_STATE.sales.find(s => s.idempotency_key === invoice.idempotency_key);
      if (local) local.cloudId = data.sale_id;
      persistState();
    }
    updateSyncIndicator();
  } catch (err) {
    console.warn('Cloud sync failed, queued for retry:', err.message);
    SyncEngine.enqueue(invoice);
    updateSyncIndicator();
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
APP_STATE.vendors = APP_STATE.vendors || [];
APP_STATE.khataTab = 'customers';
APP_STATE.khataSearch = '';
APP_STATE.khataFilter = 'all';

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

/* Composition matching lives in alertEngine.js (loaded first). */

function showAlternativesFor(item) {
  const alts = findAlternatives(item);
  const box = $id('altSuggestBox');
  if (!box) return;

  if (!alts.length) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = `
    <div class="alt-head">
      <strong>${esc(item.name)} is out of stock</strong>
      <button onclick="$id('altSuggestBox').style.display='none'" aria-label="Dismiss">✕</button>
    </div>
    <p class="alt-sub">In-stock alternatives with the same composition:</p>
    ${alts.map(({ alt, exact }) => `
      <button class="alt-row" onclick="selectAlternative('${esc(alt.id)}')">
        <span class="alt-body">
          <strong>${esc(alt.name)}</strong>
          <small>${esc(alt.meta?.composition || alt.composition || '')} · ${alt.stock} in stock</small>
        </span>
        <span class="alt-tags">
          ${exact ? '<span class="pill paid">Same salt</span>' : '<span class="pill info">Similar</span>'}
          <span class="alt-price">₹${(alt.price || 0).toFixed(2)}</span>
        </span>
      </button>`).join('')}
    <p class="alt-foot">Suggestions only — confirm suitability before dispensing.</p>`;
}

function selectAlternative(itemId) {
  const item = (APP_STATE.inventory || []).find(i => i.id === itemId);
  if (!item) return;
  const box = $id('altSuggestBox');
  if (box) box.style.display = 'none';
  openItemModal(item);
}


/* ==========================================================================
   INVOICE ACTION POPUP
   Clicking any invoice row opens this rather than navigating away. Four
   actions, and each one is honest about its actual scope:

   - Download / Re-print: reuse the exact same print pipeline checkout
     already uses (PrinterEngine + printA4Invoice), so a re-print is
     byte-identical to the original, never a re-derived approximation.
   - Edit: contact details ONLY (name/phone/address on the record). GST law
     does not allow amending amounts or items on an issued tax invoice —
     that correction path is a credit note, which this app already has.
     Faking a full "edit invoice" would let someone quietly alter a filed
     tax document, which is the kind of feature this app should refuse to
     have rather than build unsafely.
   - Cancel / Return: does not invent a parallel cancellation mechanism.
     It opens the existing, tested Return modal pre-selected to return
     every line — the correct, audit-safe way to void a sale.
   ========================================================================== */
function openInvoiceActionPopup(invoiceNo) {
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  if (!sale) { showSaasToast('Invoice not found.', 3000, 'err'); return; }

  APP_STATE.iapInvoiceNo = invoiceNo;
  setTxt('iapInvoiceNo', invoiceNo);
  setTxt('iapCustomer', sale.customer?.name || 'Cash Customer');
  setTxt('iapDate', sale.date);
  setTxt('iapTender', sale.tender);
  setTxt('iapTotal', `₹${(sale.total || 0).toFixed(2)}`);

  const statusEl = $id('iapStatus');
  if (statusEl) {
    const map = { returned: ['overdue', 'RETURNED'], partially_returned: ['pending', 'PARTIALLY RETURNED'], cancelled: ['draft', 'CANCELLED'] };
    const [cls, label] = map[sale.status] || ['paid', 'ACTIVE'];
    statusEl.innerHTML = `<span class="pill ${cls}">${label}</span>`;
  }

  const cancelBtn = $id('iapCancelBtn');
  if (cancelBtn) {
    const fullyDone = sale.status === 'returned' || sale.status === 'cancelled';
    cancelBtn.disabled = fullyDone;
    cancelBtn.style.opacity = fullyDone ? '0.5' : '1';
    cancelBtn.title = fullyDone ? 'This invoice has already been fully returned or cancelled.' : '';
  }

  setDisplay('iapEditPanel', 'none');
  $id('invoiceActionModal')?.classList.add('open');
}

function closeInvoiceActionPopup() {
  $id('invoiceActionModal')?.classList.remove('open');
  APP_STATE.iapInvoiceNo = null;
}

function getIapSale() {
  return APP_STATE.sales.find(s => s.invoiceNo === APP_STATE.iapInvoiceNo);
}

function iapDownload() {
  const sale = getIapSale();
  if (!sale) return;
  printA4Invoice(sale);
  window.print(); // "Download" via the browser's own Save as PDF — matches
                   // exactly what was printed at checkout, not a re-render.
  closeInvoiceActionPopup();
}

function iapPrint() {
  const sale = getIapSale();
  if (!sale) return;
  printA4Invoice(sale);
  PrinterEngine.dispatchPrint(sale); // same routing checkout uses: thermal if configured, else A4 dialog
  closeInvoiceActionPopup();
}

function iapOpenEdit() {
  const sale = getIapSale();
  if (!sale) return;
  setVal('iapEditName', sale.customer?.name || '');
  setVal('iapEditPhone', sale.customer?.phone || '');
  setVal('iapEditAddress', sale.customer?.address || '');
  setDisplay('iapEditPanel', 'block');
}

function iapSaveEdit() {
  const sale = getIapSale();
  if (!sale) return;

  sale.customer = sale.customer || {};
  sale.customer.name = $id('iapEditName')?.value.trim() || sale.customer.name;
  sale.customer.phone = $id('iapEditPhone')?.value.trim() || sale.customer.phone;
  sale.customer.address = $id('iapEditAddress')?.value.trim() || '';

  persistState();

  // Sync just the customer_snapshot column — never touches items/totals/tax,
  // matching the "contact details only" scope enforced in the UI above.
  if (APP_STATE.cloudSession && sale.cloudId) {
    SB.client.from('sales').update({ customer_snapshot: sale.customer }).eq('id', sale.cloudId)
      .then(({ error }) => { if (error) console.warn('Invoice contact update sync failed:', error.message); });
  }

  showSaasToast('Contact details updated on this invoice.', 2500);
  setDisplay('iapEditPanel', 'none');
  renderDashboard();
}

function iapOpenCancel() {
  const sale = getIapSale();
  if (!sale || sale.status === 'returned' || sale.status === 'cancelled') return;
  closeInvoiceActionPopup();
  // Hands off to the existing, tested return flow rather than inventing a
  // second path — openReturnModal already pre-fills full returnable
  // quantities, so this is already "cancel the whole invoice" by default;
  // the owner can still reduce quantities if only part should be reversed.
  openReturnModal(sale.invoiceNo);
}

/* ==========================================================================
   SALES RETURNS / CREDIT NOTES
   A return is not a deletion. Under GST the original tax invoice must stay
   on record; the reversal is a separate credit note that reduces the tax
   liability. So the sale keeps its number and its data, gains a status of
   partially_returned / returned, and a credit note carries the reversed
   amounts. Tax is recomputed with the same TaxEngine used at billing, at
   the rate stamped on each line at the time of sale — never at today's
   rate, which would produce a credit that doesn't match what was charged.
   ========================================================================== */
APP_STATE.returns = APP_STATE.returns || [];
APP_STATE.returnDraft = null;

function openReturnModal(invoiceNo) {
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  if (!sale) { showSaasToast('Invoice not found.', 3000, 'err'); return; }
  if (sale.status === 'returned') {
    showSaasToast(`${invoiceNo} has already been fully returned.`, 3500, 'err');
    return;
  }

  // Returnable = sold qty minus anything already returned on earlier credit
  // notes for this invoice. Computed locally so the modal opens instantly
  // offline; the server revalidates on submit and is the real authority.
  const already = {};
  APP_STATE.returns
    .filter(r => r.invoiceNo === invoiceNo)
    .forEach(r => (r.items || []).forEach(i => {
      already[i.id] = (already[i.id] || 0) + (i.qty || 0);
    }));

  APP_STATE.returnDraft = {
    sale,
    lines: (sale.items || []).map(it => ({
      ...it,
      soldQty: it.qty,
      returnableQty: Math.max(0, (it.qty || 0) - (already[it.id] || 0)),
      returnQty: 0
    }))
  };

  renderReturnModal();
  $id('returnModal')?.classList.add('open');
}

function closeReturnModal() {
  $id('returnModal')?.classList.remove('open');
  APP_STATE.returnDraft = null;
}

function renderReturnModal() {
  const d = APP_STATE.returnDraft;
  if (!d) return;

  setTxt('retInvoiceNo', d.sale.invoiceNo);
  setTxt('retCustomer', `${d.sale.customer?.name || 'Cash Customer'} · ${d.sale.customer?.phone || '-'}`);
  setTxt('retTaxMode', d.sale.interstate ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)');

  const body = $id('retLinesBody');
  if (!body) return;

  body.innerHTML = d.lines.map((l, idx) => {
    const disabled = l.returnableQty === 0;
    return `<tr${disabled ? ' style="opacity:.45;"' : ''}>
      <td>
        <strong>${esc(l.name)}</strong>
        ${l.assignedIdentifier ? `<br><small style="color:var(--text-muted);">${esc(l.assignedIdentifier)}</small>` : ''}
      </td>
      <td style="text-align:center;">${l.soldQty}</td>
      <td style="text-align:center;">${l.returnableQty}</td>
      <td style="text-align:center;">
        <input type="number" min="0" max="${l.returnableQty}" value="${l.returnQty}"
               ${disabled ? 'disabled' : ''} style="width:64px; padding:6px; text-align:center;
               border:1px solid var(--border); border-radius:8px;"
               oninput="updateReturnQty(${idx}, this.value)">
      </td>
      <td style="text-align:right;">₹${(l.price || 0).toFixed(2)}</td>
    </tr>`;
  }).join('');

  updateReturnTotals();
}

function updateReturnQty(idx, val) {
  const d = APP_STATE.returnDraft;
  if (!d || !d.lines[idx]) return;
  let q = parseInt(val, 10) || 0;
  // Clamp rather than reject: a cashier typing 5 into a line with 3
  // returnable should see it correct itself, not get an error and lose input.
  if (q < 0) q = 0;
  if (q > d.lines[idx].returnableQty) q = d.lines[idx].returnableQty;
  d.lines[idx].returnQty = q;
  updateReturnTotals();
}

function computeReturnTotals() {
  const d = APP_STATE.returnDraft;
  if (!d) return null;

  const lines = d.lines
    .filter(l => l.returnQty > 0)
    .map(l => {
      // Reuse the exact rate this line was billed at, not the current slab.
      const rate = l.gstRateAtBilling !== undefined ? l.gstRateAtBilling : l.gst;
      const includeGst = l.gstModeAtBilling === 'inclusive';
      const computed = TaxEngine.computeLine({ price: l.price, qty: l.returnQty, gstRate: rate, includeGst });
      return {
        id: l.id, name: l.name, hsn: l.hsn, gst: rate, gstRateAtBilling: rate,
        price: l.price, qty: l.returnQty,
        assignedIdentifier: l.assignedIdentifier || '',
        taxableValue: computed.taxableValue,
        gstAmount: computed.gstAmount,
        totalAmount: computed.totalAmount
      };
    });

  if (!lines.length) return { lines: [], taxable: 0, gstTotal: 0, total: 0, roundOff: 0 };

  const t = TaxEngine.computeInvoiceTotals(lines);
  return { lines, taxable: t.taxable, gstTotal: t.gstTotal, total: t.total, roundOff: t.roundOff };
}

function updateReturnTotals() {
  const r = computeReturnTotals();
  if (!r) return;
  const d = APP_STATE.returnDraft;
  const interstate = !!d.sale.interstate;

  setTxt('retTaxable', `₹${r.taxable.toFixed(2)}`);
  setTxt('retGst', `₹${r.gstTotal.toFixed(2)}`);
  setTxt('retTotal', `₹${r.total.toFixed(2)}`);

  // Show the split the same way the invoice did, so the credit note is
  // legible next to the original bill.
  const splitEl = $id('retGstSplit');
  if (splitEl) {
    if (r.gstTotal === 0) { splitEl.innerText = ''; }
    else if (interstate) { splitEl.innerText = `IGST reversed: ₹${r.gstTotal.toFixed(2)}`; }
    else {
      const half = TaxEngine.round2(r.gstTotal / 2);
      const other = TaxEngine.round2(r.gstTotal - half);
      splitEl.innerText = `CGST ₹${half.toFixed(2)} + SGST ₹${other.toFixed(2)} reversed`;
    }
  }

  const btn = $id('retSubmitBtn');
  if (btn) btn.disabled = r.lines.length === 0;
}

async function submitReturn() {
  const d = APP_STATE.returnDraft;
  const r = computeReturnTotals();
  if (!d || !r || !r.lines.length) {
    showSaasToast('Select at least one item to return.', 3000, 'err');
    return;
  }

  const restock = !!$id('retRestock')?.checked;
  const reason = $id('retReason')?.value.trim() || '';

  const creditNoteNo = `CN-${APP_STATE.cnCounter || 1}`;
  const ret = {
    creditNoteNo,
    invoiceNo: d.sale.invoiceNo,
    idempotency_key: SyncEngine.generateIdempotencyKey(),
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toISOString(),
    customer: d.sale.customer,
    reason, restock,
    taxable: r.taxable, gstTotal: r.gstTotal, roundOff: r.roundOff, total: r.total,
    interstate: !!d.sale.interstate,
    items: r.lines
  };

  const btn = $id('retSubmitBtn');
  if (btn) { btn.disabled = true; btn.innerText = 'Processing…'; }

  // Local state first so the counter is never blocked on network, matching
  // how a sale behaves; the cloud call self-queues on failure.
  applyReturnLocally(ret, restock);
  APP_STATE.cnCounter = (APP_STATE.cnCounter || 1) + 1;
  localStorage.setItem('bn_cn_seq', String(APP_STATE.cnCounter));
  persistState();

  // Same offline-first contract as a sale: never block the counter on
  // network, always end up on the queue if the write doesn't land.
  ret.cloudSaleId = d.sale.cloudId || null;

  if (APP_STATE.cloudSession && navigator.onLine && ret.cloudSaleId) {
    const { error } = await SB.processReturn(APP_STATE.tenantProfile.shopId, ret.cloudSaleId, ret);
    if (isFatalSyncError(error)) {
      SyncEngine.enqueue(ret, 'return');
      showSaasToast(`Credit note ${esc(creditNoteNo)} saved locally — will sync when possible.`, 4500);
    } else {
      showSaasToast(`Credit note ${esc(creditNoteNo)} created. Stock ${restock ? 'restored' : 'not restored (damaged)'}.`, 4000);
    }
  } else {
    // No session, offline, or the parent invoice hasn't synced yet — queue it.
    // flushSyncQueue() holds returns back until their parent sale has a
    // cloud id, so ordering is preserved without extra bookkeeping here.
    SyncEngine.enqueue(ret, 'return');
    showSaasToast(`Credit note ${esc(creditNoteNo)} saved locally — will sync when online.`, 4000);
  }

  if (btn) { btn.disabled = false; btn.innerText = 'Process Return'; }
  closeReturnModal();
  renderDashboard();
  renderCatalog();
}

function applyReturnLocally(ret, restock) {
  APP_STATE.returns.push(ret);

  if (restock) {
    ret.items.forEach(ri => {
      const item = APP_STATE.inventory.find(i => i.id === ri.id);
      if (!item) return;
      item.stock += ri.qty;
      // Return the specific unit's identifier to the sellable pool.
      if (ri.assignedIdentifier) {
        if (item.category === 'Electronics') {
          item.serials = item.serials || [];
          if (!item.serials.includes(ri.assignedIdentifier)) item.serials.push(ri.assignedIdentifier);
        } else if (item.category === 'Jewelry') {
          item.huids = item.huids || [];
          if (!item.huids.includes(ri.assignedIdentifier)) item.huids.push(ri.assignedIdentifier);
        }
      }
    });
  }

  const sale = APP_STATE.sales.find(s => s.invoiceNo === ret.invoiceNo);
  if (sale) {
    sale.returnedValue = TaxEngine.round2((sale.returnedValue || 0) + ret.total);
    sale.status = sale.returnedValue >= (sale.total - 0.01) ? 'returned' : 'partially_returned';
  }

  const cust = APP_STATE.customers.find(c => c.phone === ret.customer?.phone);
  if (cust) {
    if (sale && sale.tender === 'Khata') {
      cust.dues = Math.max(0, TaxEngine.round2((cust.dues || 0) - ret.total));
    }
    cust.totalOrdersVal = Math.max(0, TaxEngine.round2((cust.totalOrdersVal || 0) - ret.total));
  }
}

/* ==========================================================================
   INDUSTRY-SPECIFIC INVOICE THEMING
   Same legal skeleton (GST rules don't change by trade), but the identifier
   column and accent adapt — a jeweller's invoice showing "Serial / IMEI" or
   a pharmacy's omitting batch/expiry both look wrong to that trade's
   customers, and expiry on a medicine bill is a genuine requirement.
   ========================================================================== */
const INDUSTRY_INVOICE_PROFILES = {
  Electronics: { accent: '#2563eb', idLabel: 'Serial No. / IMEI', tagline: 'Warranty as per manufacturer terms' },
  Jewelry:     { accent: '#b45309', idLabel: 'HUID / Purity',      tagline: 'Hallmarked as per BIS standards' },
  Pharmacy:    { accent: '#059669', idLabel: 'Batch / Expiry',     tagline: 'Dispensed as per prescription. Not returnable.' },
  Grocery:     { accent: '#ea580c', idLabel: 'Batch / Pack',       tagline: 'Check packaging date at delivery' },
  All:         { accent: '#0d1e18', idLabel: 'Serial / HUID / Batch', tagline: '' }
};

function applyIndustryInvoiceTheme(industry) {
  const profile = INDUSTRY_INVOICE_PROFILES[industry] || INDUSTRY_INVOICE_PROFILES.All;
  const sheet = $id('printSheet') || $q('.print-sheet');
  if (sheet) {
    sheet.style.setProperty('--invoice-accent', profile.accent);
    // Jewelry gets a genuinely different frame, not just a colour swap —
    // ornate double-border and corner motifs read as "premium boutique"
    // the way a plain ruled table never does, matching how jewellers'
    // paper bills traditionally look. Pure CSS/SVG, no image asset, so it
    // still works fully offline and survives thermal/A4 print equally.
    sheet.classList.toggle('invoice-ornate', industry === 'Jewelry');
  }

  const idHeader = $id('pIdColHeader');
  if (idHeader) idHeader.innerText = profile.idLabel;

  const tagline = $id('pIndustryTagline');
  if (tagline) {
    tagline.innerText = profile.tagline;
    tagline.style.display = profile.tagline ? 'block' : 'none';
  }
}

function printA4Invoice(inv) {
  setTxt('pCustName', inv.customer.name);
  setTxt('pCustPhone', inv.customer.phone);
  setTxt('pCustGst', inv.customer.gstin || 'Unregistered / B2C');
  setTxt('pInvNum', inv.invoiceNo);
  setTxt('pDate', inv.date);
  setTxt('pTender', inv.tender.toUpperCase());

  // Address row hides itself entirely when blank — an invoice with an
  // empty "Address:" label looks like a broken template to a customer.
  const addrRow = $id('pCustAddrRow');
  if (addrRow) {
    if (inv.customer.address) {
      addrRow.style.display = 'block';
      setTxt('pCustAddr', inv.customer.address);
    } else {
      addrRow.style.display = 'none';
    }
  }

  setTxt('pStateCode', inv.placeOfSupplyName
    ? `${inv.placeOfSupplyName} (${inv.placeOfSupply})`
    : (inv.placeOfSupply || '-'));
  setTxt('pSupplyType', inv.interstate ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)');
  setTxt('pAmountWords', TaxEngine.amountInWords(inv.total));

  applyIndustryInvoiceTheme(inv.industry || APP_STATE.tenantProfile.assignedIndustry);

  const tbody = $id('pItemsBody');
  const hsnBody = $id('pHsnBody');
  if (!tbody || !hsnBody) return;
  tbody.innerHTML = '';
  hsnBody.innerHTML = '';

  let totTaxable = 0, totGst = 0;
  inv.items.forEach((it, idx) => {
    totTaxable += it.taxableValue;
    totGst += it.gstAmount;
    tbody.innerHTML += `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${esc(it.name)}</td>
        <td style="text-align:center;">${esc(it.hsn)}</td>
        <td>${esc(it.assignedIdentifier || it.meta?.batch || '-')}</td>
        <td style="text-align:center;">${it.qty}</td>
        <td style="text-align:right;">${it.price.toFixed(2)}</td>
        <td style="text-align:center;">${it.gst}%</td>
        <td style="text-align:right;">${it.totalAmount.toFixed(2)}</td>
      </tr>
    `;
  });

  setTxt('pTaxableSum', `₹${totTaxable.toFixed(2)}`);
  setTxt('pGstSum', `₹${totGst.toFixed(2)}`);
  setTxt('pGrandSum', `₹${inv.total.toFixed(2)}`);

  renderHsnTaxBreakup(inv, hsnBody);

  const pQrBox = $id('pUpiQrContainer');
  if (pQrBox) {
    pQrBox.innerHTML = generateDynamicUpiQR(inv.total, inv.invoiceNo) + `<p style="font-size:7.5px; margin-top:2px;">Scan to Pay</p>`;
  }
  // NOTE: printing itself is now decided by PrinterEngine.dispatchPrint()
  // (A4 window.print() vs Bluetooth thermal ESC/POS) — this function only
  // renders the on-screen/print-template DOM. Do not call window.print() here,
  // or A4-mode shops get two print dialogs per sale.
}

/* ==========================================================================
   HSN-WISE TAX BREAKUP (CGST+SGST or IGST, per GST invoice rules)
   ========================================================================== */
function renderHsnTaxBreakup(inv, hsnBody) {
  const thead = $id('pTaxTableHead');
  const interstate = !!inv.interstate;

  // Header must reflect the actual transaction type — showing CGST/SGST
  // columns on an inter-state invoice (or vice versa) is a compliance
  // error, not just a cosmetic one.
  if (thead) {
    thead.innerHTML = interstate
      ? `<tr><th>HSN/SAC</th><th>Taxable Amt</th><th>IGST%</th><th>IGST Amt</th><th>Total Tax</th></tr>`
      : `<tr><th>HSN/SAC</th><th>Taxable Amt</th><th>CGST%</th><th>CGST Amt</th><th>SGST%</th><th>SGST Amt</th><th>Total Tax</th></tr>`;
  }

  // Uses the same grouping function as the GSTR-1 report, so the invoice
  // and the return can never show different numbers for the same sale.
  const groups = TaxEngine.groupByHsn(inv.items, interstate);

  hsnBody.innerHTML = '';
  groups.forEach(g => {
    if (interstate) {
      hsnBody.innerHTML += `
        <tr>
          <td>${esc(g.hsn)}</td>
          <td style="text-align:right;">${g.taxable.toFixed(2)}</td>
          <td style="text-align:center;">${g.gstRate}%</td>
          <td style="text-align:right;">${g.igst.toFixed(2)}</td>
          <td style="text-align:right;">${g.gstAmt.toFixed(2)}</td>
        </tr>`;
    } else {
      hsnBody.innerHTML += `
        <tr>
          <td>${esc(g.hsn)}</td>
          <td style="text-align:right;">${g.taxable.toFixed(2)}</td>
          <td style="text-align:center;">${(g.gstRate / 2)}%</td>
          <td style="text-align:right;">${g.cgst.toFixed(2)}</td>
          <td style="text-align:center;">${(g.gstRate / 2)}%</td>
          <td style="text-align:right;">${g.sgst.toFixed(2)}</td>
          <td style="text-align:right;">${g.gstAmt.toFixed(2)}</td>
        </tr>`;
    }
  });

  const roundOffRow = $id('pRoundOffRow');
  if (roundOffRow) {
    if (inv.roundOff && Math.abs(inv.roundOff) >= 0.01) {
      roundOffRow.style.display = 'block';
      setTxt('pRoundOff', `${inv.roundOff > 0 ? '+' : ''}₹${inv.roundOff.toFixed(2)}`);
    } else {
      roundOffRow.style.display = 'none';
    }
  }
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

/* ==========================================================================
   PAGINATION  (P2 #11)
   A shop with 4,000 SKUs was rendering 4,000 DOM nodes on every catalog
   repaint — which is every add-to-cart. On a mid-range Android that is a
   visible freeze at the counter. Chunked rendering with a "load more" keeps
   the first paint bounded regardless of catalogue size, without pulling in
   a virtual-list library.
   ========================================================================== */
const PAGE_SIZE = 60;
APP_STATE.catalogPage = 1;

function resetCatalogPaging() { APP_STATE.catalogPage = 1; }

function loadMoreCatalog() {
  APP_STATE.catalogPage++;
  renderCatalog();
}

function renderPagerFooter(container, shown, total, onMoreFnName) {
  if (shown >= total) return;
  const footer = document.createElement('div');
  footer.className = 'pager-footer';
  footer.innerHTML = `
    <span>Showing ${shown} of ${total}</span>
    <button class="btn-pill secondary" onclick="${onMoreFnName}()">Load ${Math.min(PAGE_SIZE, total - shown)} more</button>`;
  container.appendChild(footer);
}

function renderCatalog() {
  const container = $id('catalogGrid');
  if (!container) return;
  container.innerHTML = '';
  const filtered = APP_STATE.inventory.filter(i => APP_STATE.activeSector === 'All' || i.category === APP_STATE.activeSector);

  const totalMatching = filtered.length;
  const pageLimit = APP_STATE.catalogPage * PAGE_SIZE;
  const visible = filtered.slice(0, pageLimit);

  const { lowStock } = getAlertThresholds();
  const expiryByItem = {};
  getExpiryAlerts().forEach(e => {
    // Keep only the most urgent batch per product for the card badge.
    if (!expiryByItem[e.itemId] || e.days < expiryByItem[e.itemId].days) expiryByItem[e.itemId] = e;
  });

  visible.forEach(it => {
    const card = document.createElement('div');
    const threshold = Number.isFinite(it.lowStockLevel) ? it.lowStockLevel : lowStock;
    const isOut = it.stock <= 0;
    const isLow = !isOut && it.stock <= threshold;
    const exp = expiryByItem[it.id];

    card.className = `catalog-card${isOut ? ' is-out' : ''}${isLow ? ' is-low' : ''}`;
    card.onclick = () => openItemModal(it);

    const tag = it.barcode ? `Barcode: ${esc(it.barcode)}` : `HSN: ${esc(it.hsn)}`;
    const comp = it.meta?.composition || it.composition || '';

    const badges = [
      isOut ? `<span class="mini-badge danger">Out of stock</span>` : '',
      isLow ? `<span class="mini-badge warn">Low · ${it.stock} left</span>` : '',
      exp ? `<span class="mini-badge ${exp.expired ? 'danger' : 'warn'}">${
        exp.expired ? `Expired ${Math.abs(exp.days)}d ago` : `Expires in ${exp.days}d`}</span>` : ''
    ].filter(Boolean).join('');

    card.innerHTML = `
      <div>
        <div class="name">${esc(it.name)}</div>
        <div class="meta">${tag} &bull; ${it.gst}% GST</div>
        ${comp ? `<div class="meta comp">${esc(comp)}</div>` : ''}
        ${badges ? `<div class="card-badges">${badges}</div>` : ''}
      </div>
      <div class="bottom">
        <span class="price">₹${it.price.toFixed(2)}</span>
        <span class="stock-tag ${isOut ? 'out' : (isLow ? 'low' : '')}">${it.stock} left</span>
      </div>
    `;
    container.appendChild(card);
  });

  renderPagerFooter(container, visible.length, totalMatching, 'loadMoreCatalog');
}

function openNewProductModal() { $id('newProdModal')?.classList.add('open'); }
function closeNewProdModal() { $id('newProdModal')?.classList.remove('open'); }

function saveNewProduct() {
  const name = $id('npName')?.value.trim();
  const category = $id('npCategory')?.value || 'Electronics';
  const barcode = $id('npBarcode')?.value.trim() || '';
  const hsn = $id('npHsn')?.value.trim() || '8517';
  const gst = parseInt($id('npGst')?.value, 10) || 18;
  const price = parseFloat($id('npPrice')?.value) || 0;
  const stock = parseInt($id('npStock')?.value, 10) || 0;
  const rawIds = $id('npIdentifiers')?.value || '';
  const idArray = rawIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  if (!name) return alert("Product name is required!");

  const metaByCategory = {
    Electronics: { imei: '', warranty: '' },
    Jewelry: { karat: '22K', netWt: 0, grossWt: 0, making: 0 },
    Pharmacy: { batch: idArray[0] || '', expiry: '2027-12' },
    Grocery: { pack: '' }
  };

  const newItem = {
    id: crypto.randomUUID(),
    name,
    category,
    barcode,
    hsn,
    gst,
    price,
    cost: price * 0.8,
    stock,
    serials: category === 'Electronics' ? idArray : [],
    huids: category === 'Jewelry' ? idArray : [],
    batches: category === 'Pharmacy' && idArray.length ? [{ batch: idArray[0], expiry: '2027-12', stock }] : [],
    meta: metaByCategory[category] || { pack: '' }
  };
  APP_STATE.inventory.push(newItem);

  persistState();
  syncItemToCloud(newItem);
  closeNewProdModal();
  renderCatalog();
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
