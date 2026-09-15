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
   AUTHENTICATION — OTP ONLY
   The Supabase session is the sole access boundary; RLS decides what it
   can read. There is no PIN: a 4-digit code stored in localStorage was
   readable and editable by anyone with devtools, so it protected nothing
   while creating the impression that it did.
   ========================================================================== */
APP_STATE.cloudSession = null;
APP_STATE.cloudProfile = null;

const AuthFlow = {
  channel: 'phone',        // 'phone' | 'email'
  target: null,            // +919876543210 | name@example.com
  purpose: 'login',        // 'login' | 'register'
  dialCode: '+91',
  pendingRegistration: null,
  timerHandle: null,
  busy: false
};

const COUNTRY_CODES = [
  { flag: '🇮🇳', dial: '+91', name: 'India' },
  { flag: '🇺🇸', dial: '+1', name: 'United States' },
  { flag: '🇬🇧', dial: '+44', name: 'United Kingdom' },
  { flag: '🇦🇪', dial: '+971', name: 'UAE' },
  { flag: '🇸🇬', dial: '+65', name: 'Singapore' },
  { flag: '🇦🇺', dial: '+61', name: 'Australia' },
  { flag: '🇧🇩', dial: '+880', name: 'Bangladesh' },
  { flag: '🇳🇵', dial: '+977', name: 'Nepal' }
];

async function initAuthGate() {
  const overlay = $id('authOverlay');
  buildCountryList();
  populateStateDropdowns();

  const { session, profile, shop } = await SB.getSessionAndProfile();

  // Signed in, profile exists, shop exists -> straight into the app.
  if (session && profile && shop) {
    if (shop.status !== 'active') {
      await SB.signOut();
      showRequestStep();
      applyAuthLockState(true);
      showSaasToast(`This shop account is ${shop.status}. Contact support.`, 6000, 'err');
      return;
    }
    APP_STATE.cloudSession = session;
    APP_STATE.cloudProfile = profile;
    hydrateTenantFromShop(shop);
    await hydrateCloudData(shop.id);
    enterApp();
    return;
  }

  // Verified session but no shop yet — this happens when someone verified
  // OTP and then closed the tab mid-onboarding. Resume at the profile step
  // rather than stranding them at a login screen they can't get past.
  if (session && (!profile || !shop)) {
    AuthFlow.pendingRegistration = AuthFlow.pendingRegistration || {
      shopName: '', ownerName: '',
      phone: session.user.phone || '',
      email: session.user.email || ''
    };
    showStep('authStepProfile');
    applyAuthLockState(true);
    return;
  }

  showRequestStep();
  applyAuthLockState(true);
}

function enterApp() {
  applyAuthLockState(false);
  applyRoleSecurity(APP_STATE.cloudProfile?.role === 'cashier' ? 'Cashier' : 'Owner');
  applyIndustryLock();
  loadPrinterAndGstSettingsIntoDOM();
  renderDashboard();
  renderCatalog();
  SyncEngine.flushSyncQueue();
}

/* ---------- step navigation ---------- */
function showStep(id) {
  ['authStepRequest', 'authStepOtp', 'authStepRegister', 'authStepProfile']
    .forEach(s => setDisplay(s, s === id ? 'block' : 'none'));
}

function showRequestStep() {
  AuthFlow.purpose = 'login';
  showStep('authStepRequest');
  setTxt('authHeroTitle', 'Get Started now');
  setTxt('authHeroSub', 'Sign in to run your counter');
}

function showRegisterStep() {
  AuthFlow.purpose = 'register';
  showStep('authStepRegister');
  renderWizardDots('wizDots', 0);
  setTxt('authHeroTitle', 'Create your store');
  setTxt('authHeroSub', 'Two minutes to your first bill');
}

function renderWizardDots(containerId, activeIdx) {
  const el = $id(containerId);
  if (!el) return;
  el.innerHTML = [0, 1, 2].map(i =>
    `<span class="wiz-dot ${i === activeIdx ? 'active' : ''} ${i < activeIdx ? 'done' : ''}"></span>`
  ).join('<span class="wiz-line"></span>');
}

/* ---------- channel + country ---------- */
function setLoginMethod(method) {
  AuthFlow.channel = method;
  const isPhone = method === 'phone';
  setDisplay('panePhone', isPhone ? 'block' : 'none');
  setDisplay('paneEmail', isPhone ? 'none' : 'block');
  $id('segPhoneBtn')?.classList.toggle('active', isPhone);
  $id('segEmailBtn')?.classList.toggle('active', !isPhone);
  setTxt('authFormSub', isPhone
    ? "Enter your phone number and we'll send you an OTP — no password needed."
    : "Enter your email address and we'll send you an OTP — no password needed.");
}

function buildCountryList() {
  const list = $id('ccList');
  if (!list) return;
  list.innerHTML = COUNTRY_CODES.map(c =>
    `<button type="button" class="cc-item" onclick="pickCountry('${c.dial}','${c.flag}')">${c.flag} ${esc(c.name)} <span>${c.dial}</span></button>`
  ).join('');
}

function toggleCountryList() {
  const list = $id('ccList');
  if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
}

function pickCountry(dial, flag) {
  AuthFlow.dialCode = dial;
  setTxt('ccDial', dial);
  setTxt('ccFlag', flag);
  setDisplay('ccList', 'none');
}

function onPhoneInput() {
  const el = $id('loginPhone');
  if (el) el.value = el.value.replace(/\D/g, '').slice(0, 12);
  setTxt('phoneError', '');
}

/* ---------- request OTP ---------- */
async function requestOtp(channel) {
  if (AuthFlow.busy) return;
  AuthFlow.channel = channel;

  let target, errEl, btnId;
  if (channel === 'phone') {
    const digits = normalizePhoneNumber($id('loginPhone')?.value).replace(/\D/g, '');
    errEl = 'phoneError'; btnId = 'phoneOtpBtn';
    if (digits.length < 6) { setTxt(errEl, 'Enter a valid mobile number.'); return; }
    target = AuthFlow.dialCode + digits;
  } else {
    const email = ($id('loginEmail')?.value || '').trim();
    errEl = 'emailError'; btnId = 'emailOtpBtn';
    if (!/^\S+@\S+\.\S+$/.test(email)) { setTxt(errEl, 'Enter a valid email address.'); return; }
    target = email;
  }

  setAuthBusy(btnId, true, 'Sending…');
  setTxt(errEl, '');

  // shouldCreateUser is false on the login path: a typo'd number must not
  // silently create an account with no shop behind it, which would leave
  // the person verified but stuck.
  const allowCreate = AuthFlow.purpose === 'register';
  const { error } = channel === 'phone'
    ? await SB.sendPhoneOtp(target, allowCreate)
    : await SB.sendEmailOtp(target, allowCreate);

  setAuthBusy(btnId, false, `Get OTP <span class="ap-ico">→]</span>`);

  if (error) {
    setTxt(errEl, /not found|signups not allowed/i.test(error)
      ? 'No account found. Tap "Register your shop" below.'
      : error);
    return;
  }

  AuthFlow.target = target;
  showSaasToast(channel === 'phone'
    ? 'OTP sent via SMS. Please check your messages.'
    : 'OTP sent. Please check your inbox (and spam).', 4000);
  openOtpStep();
}

function openOtpStep() {
  showStep('authStepOtp');
  const isPhone = AuthFlow.channel === 'phone';
  setTxt('otpTitle', isPhone ? 'Check your phone' : 'Check your inbox');
  setTxt('otpEditNoun', isPhone ? 'Number' : 'Email');
  setTxt('otpTargetLabel', maskTarget(AuthFlow.target, isPhone));
  setTxt('otpError', '');
  clearOtpBoxes();
  $id('otp-0')?.focus();
  startResendTimer(30);
}

// Masks the middle of the target — a shoulder-surfer shouldn't be able to
// read a full number off the screen, but the person needs enough to confirm
// they typed it correctly.
function maskTarget(t, isPhone) {
  if (!t) return '';
  if (isPhone) return t.length > 7 ? `${t.slice(0, 5)}***${t.slice(-3)}` : t;
  const [user, domain] = t.split('@');
  if (!domain) return t;
  return `${user.slice(0, 2)}***@${domain}`;
}

function startResendTimer(secs) {
  clearInterval(AuthFlow.timerHandle);
  setDisplay('otpResendLine', 'block');
  setDisplay('otpResendActions', 'none');
  let left = secs;
  const tick = () => {
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    setTxt('otpTimer', `${m}:${s}`);
    if (left <= 0) {
      clearInterval(AuthFlow.timerHandle);
      setDisplay('otpResendLine', 'none');
      setDisplay('otpResendActions', 'block');
    }
    left--;
  };
  tick();
  AuthFlow.timerHandle = setInterval(tick, 1000);
}

function editOtpTarget() {
  clearInterval(AuthFlow.timerHandle);
  if (AuthFlow.purpose === 'register') showRegisterStep();
  else showRequestStep();
}

async function resendOtp() {
  const allowCreate = AuthFlow.purpose === 'register';
  const { error } = AuthFlow.channel === 'phone'
    ? await SB.sendPhoneOtp(AuthFlow.target, allowCreate)
    : await SB.sendEmailOtp(AuthFlow.target, allowCreate);
  setTxt('otpError', error || '');
  if (!error) startResendTimer(30);
}

/* ---------- OTP boxes ---------- */
function clearOtpBoxes() { for (let i = 0; i < 6; i++) setVal(`otp-${i}`, ''); }

function readOtpCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += ($id(`otp-${i}`)?.value || '').trim();
  return c;
}

function onOtpInput(idx) {
  const box = $id(`otp-${idx}`);
  if (!box) return;
  box.value = box.value.replace(/\D/g, '').slice(0, 1);
  if (box.value && idx < 5) $id(`otp-${idx + 1}`)?.focus();
  if (readOtpCode().length === 6) verifyOtpCode();
}

function onOtpKeydown(e, idx) {
  if (e.key === 'Backspace' && !e.target.value && idx > 0) {
    $id(`otp-${idx - 1}`)?.focus();
  }
}

// Android SMS autofill and clipboard both deliver all 6 digits at once.
function onOtpPaste(e) {
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  const digits = text.replace(/\D/g, '').slice(0, 6);
  if (digits.length === 6) {
    e.preventDefault();
    for (let i = 0; i < 6; i++) setVal(`otp-${i}`, digits[i]);
    verifyOtpCode();
  }
}

async function verifyOtpCode() {
  if (AuthFlow.busy) return;
  const code = readOtpCode();
  if (code.length !== 6) { setTxt('otpError', 'Enter all 6 digits.'); return; }

  setAuthBusy('otpVerifyBtn', true, 'Verifying…');
  setTxt('otpError', '');

  const { error } = AuthFlow.channel === 'phone'
    ? await SB.verifyPhoneOtp(AuthFlow.target, code)
    : await SB.verifyEmailOtp(AuthFlow.target, code);

  setAuthBusy('otpVerifyBtn', false, 'Verify OTP <span class="ap-ico">✓</span>');

  if (error) {
    setTxt('otpError', /expired/i.test(error) ? 'That code expired. Request a new one.' : 'Incorrect code. Try again.');
    clearOtpBoxes();
    $id('otp-0')?.focus();
    return;
  }

  clearInterval(AuthFlow.timerHandle);

  showSaasToast('Verified successfully.', 2500);

  if (AuthFlow.purpose === 'register') {
    showStep('authStepProfile');
    renderWizardDots('wizDots2', 1);
    return;
  }
  await initAuthGate();
}

/* ---------- Google ---------- */
async function signInWithGoogle() {
  const { error } = await SB.signInWithGoogle();
  if (error) setTxt('phoneError', error);
  // On success the browser redirects to Google; initAuthGate() runs again
  // when it comes back.
}

/* ---------- registration ---------- */
async function submitRegistration() {
  const shopName = $id('regShopName')?.value.trim() || '';
  const ownerName = $id('regOwnerName')?.value.trim() || '';
  const phoneDigits = ($id('regPhone')?.value || '').replace(/\D/g, '');
  const email = $id('regEmail')?.value.trim() || '';

  if (!shopName) return setTxt('regError', 'Shop name is required.');
  if (!ownerName) return setTxt('regError', 'Owner name is required.');
  if (phoneDigits.length < 10) return setTxt('regError', 'Enter a valid 10-digit mobile number.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return setTxt('regError', 'That email address looks wrong.');

  AuthFlow.pendingRegistration = { shopName, ownerName, phone: '+91' + phoneDigits, email };
  AuthFlow.purpose = 'register';
  AuthFlow.channel = 'phone';
  AuthFlow.target = '+91' + phoneDigits;

  setTxt('regError', 'Sending OTP…');
  const { error } = await SB.sendPhoneOtp(AuthFlow.target, true);
  if (error) { setTxt('regError', error); return; }

  setTxt('regError', '');
  openOtpStep();
}

function onRegGstinInput(val) {
  const code = (val || '').trim().slice(0, 2);
  const sel = $id('regState');
  if (sel && GST_STATE_CODES[code]) {
    sel.value = code;
    setTxt('regStateHint', `Detected: ${GST_STATE_CODES[code]} — this becomes your home state for CGST/SGST vs IGST.`);
  } else {
    setTxt('regStateHint', '');
  }
}

function pickIndustry(ind, el) {
  AuthFlow.selectedIndustry = ind;
  $qa('.ind-card').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

async function finishOnboarding() {
  const address = $id('regAddress')?.value.trim() || '';
  const gstin = $id('regGstin')?.value.trim() || '';
  const stateCode = $id('regState')?.value || '';
  const industry = AuthFlow.selectedIndustry;

  if (!address) return setTxt('profileError', 'Store address is required — it prints on every invoice.');
  if (!stateCode) return setTxt('profileError', 'Select your state. GST split depends on it.');
  if (!industry) return setTxt('profileError', 'Pick an industry to continue.');

  const reg = AuthFlow.pendingRegistration || {};
  setTxt('profileError', 'Creating your store…');

  const { shop, error } = await SB.createShopForCurrentUser({
    shopName: reg.shopName || 'My Store',
    ownerName: reg.ownerName || '',
    phone: reg.phone || '',
    email: reg.email || '',
    address, gstin, stateCode, industry
  });

  if (error) { setTxt('profileError', error); return; }

  AuthFlow.pendingRegistration = null;
  setTxt('profileError', '');
  hydrateTenantFromShop(shop);
  const { session, profile } = await SB.getSessionAndProfile();
  APP_STATE.cloudSession = session;
  APP_STATE.cloudProfile = profile;
  enterApp();
}

/* ---------- hydration from cloud ---------- */
function hydrateTenantFromShop(shop) {
  const p = APP_STATE.tenantProfile;
  p.shopId = shop.id;
  p.shopName = shop.name;
  p.ownerName = shop.owner_name || '';
  p.gstin = shop.gstin || '';
  p.stateCode = shop.state_code || '';
  p.phone = shop.phone || '';
  p.address = shop.address || '';
  p.assignedIndustry = shop.industry || 'All';
  p.isLocked = !!shop.is_locked;
  p.bankName = shop.bank_name || p.bankName;
  p.bankAcc = shop.bank_acc || p.bankAcc;
  p.bankIfsc = shop.bank_ifsc || p.bankIfsc;
  p.upiId = shop.upi_id || p.upiId;
  p.terms = shop.terms || p.terms;
  p.printerFormat = shop.printer_format || p.printerFormat;
  p.thermalWidth = shop.thermal_width || p.thermalWidth;
  p.logo = shop.logo || p.logo || '';
  p.lowStockThreshold = shop.low_stock_threshold ?? p.lowStockThreshold ?? 5;
  p.expiryWarnDays = shop.expiry_warn_days ?? p.expiryWarnDays ?? 30;
  p.drugLicenseNo = shop.drug_license_no || p.drugLicenseNo || '';
  p.panNumber = shop.pan_number || p.panNumber || '';
  p.isRegistered = true;
  persistState();
  syncProfileToDOM();
  applyShopLogo();
  resetCustomerStateToShopDefault();
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
      localStorage.setItem('bn_seq', APP_STATE.invCounter.toString());
    localStorage.setItem('bn_returns', JSON.stringify(APP_STATE.returns || []));
    localStorage.setItem('bn_purchases', JSON.stringify(APP_STATE.purchases || []));
    }
  }
}

function setAuthBusy(btnId, busy, label) {
  AuthFlow.busy = busy;
  const btn = $id(btnId);
  if (!btn) return;
  btn.disabled = busy;
  btn.innerHTML = label;
}

async function fullSignOut() {
  clearInterval(AuthFlow.timerHandle);
  await SB.signOut();
  APP_STATE.cloudSession = null;
  APP_STATE.cloudProfile = null;
  applyAuthLockState(true);
  showRequestStep();
}
function lockPOS() { fullSignOut(); }

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
   INWARD PURCHASE & AI OCR (ONLINE RESTRICTED)
   ========================================================================== */
// Populates the Division datalist for whatever vendor name the owner has
// typed so far — matched against known vendors client-side first (instant,
// no network wait while typing), falling back to a cloud lookup only if
// the name matches a vendor we don't have cached locally yet.
let purVendorLookupTimer = null;
function onPurVendorInput(value) {
  clearTimeout(purVendorLookupTimer);
  const datalist = $id('purDivisionOptions');
  if (!datalist) return;

  const name = value.trim().toLowerCase();
  if (!name) { datalist.innerHTML = ''; return; }

  const localMatch = (APP_STATE.vendors || []).find(v => v.name.toLowerCase() === name);
  if (localMatch) { populateDivisionDatalist(localMatch.id); return; }

  // Debounced cloud lookup — this fires while the owner is still typing,
  // so a lookup per keystroke would be wasteful and would race itself.
  purVendorLookupTimer = setTimeout(async () => {
    if (!APP_STATE.cloudSession) return;
    const { data } = await SB.client.from('vendors')
      .select('id').eq('shop_id', APP_STATE.tenantProfile.shopId)
      .ilike('name', value.trim()).maybeSingle();
    if (data?.id) populateDivisionDatalist(data.id);
  }, 400);
}

async function populateDivisionDatalist(vendorId) {
  const datalist = $id('purDivisionOptions');
  if (!datalist) return;
  const { data } = await SB.fetchVendorDivisions(APP_STATE.tenantProfile.shopId, vendorId);
  datalist.innerHTML = (data || []).map(d => `<option value="${esc(d.name)}"></option>`).join('');
}

function openInwardPurchaseModal() {
  populateRestockPicker();
  const m = $id('inwardPurchaseModal');
  if (m) m.classList.add('open');
}
function closeInwardModal() {
  const m = $id('inwardPurchaseModal');
  if (m) m.classList.remove('open');
}

function toggleInwardMode(mode) {
  const manView = $id('inwardManualView');
  const aiView = $id('inwardAiView');
  const btnMan = $id('btnInwardManual');
  const btnAi = $id('btnInwardAi');

  if (mode === 'manual') {
    if (manView) manView.style.display = 'block';
    if (aiView) aiView.style.display = 'none';
    if (btnMan) btnMan.classList.add('active');
    if (btnAi) btnAi.classList.remove('active');
  } else {
    if (!navigator.onLine) {
      alert("⚠️ AI Invoice Ingestion requires an active internet connection.\nPlease connect or use Manual Entry.");
      return;
    }
    if (manView) manView.style.display = 'none';
    if (aiView) aiView.style.display = 'block';
    if (btnMan) btnMan.classList.remove('active');
    if (btnAi) btnAi.classList.add('active');
  }
}

// Maps a local inventory item to Supabase's items table shape and upserts.
// Client-generated ids must be real UUIDs (not Date.now() strings) to match
// the uuid primary key — see the id generation fix below.
async function syncItemToCloud(item) {
  if (!APP_STATE.cloudSession) return;
  const shopId = APP_STATE.tenantProfile.shopId;
  const { error } = await SB.saveItem({
    id: item.id,
    shop_id: shopId,
    name: item.name,
    category: item.category,
    barcode: item.barcode || null,
    hsn: item.hsn,
    gst: item.gst,
    price: item.price,
    cost: item.cost,
    stock: item.stock,
    serials: item.serials || [],
    huids: item.huids || [],
    batches: item.batches || [],
    meta: item.meta || {},
  });
  if (error) console.warn('Item cloud sync failed for', item.name, error);
}


/* ==========================================================================
   QUICK RESTOCK
   Repeat purchases of a product already in stock were matched by comparing
   the typed name string — a trailing space or "Motorola G84" vs
   "Motorola G84 5G" silently created a duplicate SKU with its own stock
   count and serial pool. Selecting the real product by id removes that
   whole class of error.
   ========================================================================== */
function populateRestockPicker() {
  const sel = $id('purExistingItem');
  if (!sel) return;
  const items = [...(APP_STATE.inventory || [])].sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = `<option value="">— New product / enter manually below —</option>` +
    items.map(i => `<option value="${i.id}">${esc(i.name)} — ${i.stock} in stock · HSN ${esc(i.hsn || '—')}</option>`).join('');
}

function prefillFromExistingItem(itemId) {
  const idField = $id('purExistingItemId');
  if (!itemId) {
    if (idField) idField.value = '';
    ['purName', 'purBarcode', 'purHsn', 'purIdentifiers'].forEach(f => setVal(f, ''));
    setDisplay('restockNotice', 'none');
    return;
  }

  const it = APP_STATE.inventory.find(i => i.id === itemId);
  if (!it) return;

  if (idField) idField.value = it.id;
  setVal('purName', it.name);
  setVal('purBarcode', it.barcode || '');
  setVal('purHsn', it.hsn || '');
  setVal('purGst', String(it.gst));
  setVal('purCategory', it.category);
  setVal('purCost', it.cost || '');
  setVal('purPrice', it.price || '');
  setVal('purIdentifiers', ''); // new units bring new serials — never reuse the old list

  const notice = $id('restockNotice');
  if (notice) {
    notice.style.display = 'block';
    notice.innerHTML = `Restocking <strong>${esc(it.name)}</strong> — currently ${it.stock} in stock. New quantity will be added to that, and any serials/batches you enter are appended to the existing pool.`;
  }
}

function saveManualPurchase() {
  const name = $id('purName')?.value.trim();
  const category = $id('purCategory')?.value || 'Electronics';
  const barcode = $id('purBarcode')?.value.trim() || '';
  const hsn = $id('purHsn')?.value.trim() || '8517';
  const gst = parseInt($id('purGst')?.value, 10) || 18;
  const qty = parseInt($id('purQty')?.value, 10) || 1;
  const cost = parseFloat($id('purCost')?.value) || 0;
  const price = parseFloat($id('purPrice')?.value) || (cost > 0 ? cost * 1.25 : 100);
  const rawIds = $id('purIdentifiers')?.value || '';
  const idArray = rawIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  if (!name || qty <= 0) return alert("Enter a valid Item Name and Quantity!");

  let targetItem;
  // Prefer the explicitly-picked product id; fall back to name match only
  // when the user typed a new product rather than selecting one.
  const pickedId = $id('purExistingItemId')?.value;
  const existing = pickedId
    ? APP_STATE.inventory.find(i => i.id === pickedId)
    : APP_STATE.inventory.find(i => i.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    existing.stock += qty;
    if (cost > 0) existing.cost = cost;
    if (price > 0) existing.price = price;
    if (barcode) existing.barcode = barcode;

    if (category === 'Electronics') {
      existing.serials = Array.isArray(existing.serials) ? existing.serials : [];
      idArray.forEach(id => { if (!existing.serials.includes(id)) existing.serials.push(id); });
    } else if (category === 'Jewelry') {
      existing.huids = Array.isArray(existing.huids) ? existing.huids : [];
      idArray.forEach(id => { if (!existing.huids.includes(id)) existing.huids.push(id); });
    }
    targetItem = existing;
    alert(`✅ Incremented stock for existing item: ${name} (+${qty} units)`);
  } else {
    const metaByCategory = {
      Electronics: { imei: idArray[0] || '', warranty: '' },
      Jewelry: { karat: '22K', netWt: 0, grossWt: 0, making: 0 },
      Pharmacy: { batch: idArray[0] || '', expiry: '2027-12' },
      Grocery: { pack: '' }
    };

    targetItem = {
      id: crypto.randomUUID(),
      name,
      category,
      barcode,
      hsn,
      gst,
      cost,
      price,
      stock: qty,
      serials: category === 'Electronics' ? idArray : [],
      huids: category === 'Jewelry' ? idArray : [],
      batches: category === 'Pharmacy' && idArray.length ? [{ batch: idArray[0], expiry: '2027-12', stock: qty }] : [],
      meta: metaByCategory[category] || { pack: '' }
    };
    APP_STATE.inventory.push(targetItem);
    alert(`✅ Created and added new item to stock: ${name}`);
  }

  persistState();
  syncItemToCloud(targetItem);

  // Record the supplier bill itself, not just the stock movement (P1 #4).
  recordPurchaseBill({
    vendor: {
      name: $id('purVendor')?.value.trim() || '',
      gstin: '', phone: '', stateCode: ''
    },
    billNo: $id('purBillNo')?.value.trim() || '',
    divisionName: $id('purDivision')?.value.trim() || '',
    items: [{
      id: targetItem.id, name: targetItem.name, hsn: targetItem.hsn,
      gst: targetItem.gst, qty, cost, price,
      identifier: idArray[0] || '', expiry: ''
    }],
    source: 'manual'
  });

  closeInwardModal();
  renderCatalog();
}

/* ==========================================================================
   PURCHASE BILL RECORDING  (P1 #4)
   The stock movement was already handled locally; this persists the vendor
   bill behind it so cost history, payables and GSTR-2 data survive a cache
   clear or a move to another device.
   ========================================================================== */
APP_STATE.purchases = APP_STATE.purchases || [];

function recordPurchaseBill({ vendor, billNo, divisionName = '', items, source = 'manual' }) {
  const lines = (items || []).filter(i => i.qty > 0);
  if (!lines.length) return;

  // Purchase GST uses the same engine as sales so input tax and output tax
  // are computed identically — a mismatch between the two is exactly what
  // makes a GSTR-3B reconciliation fail.
  const includeGst = APP_STATE.tenantProfile.gstPriceMode === 'inclusive';
  const priced = lines.map(l => ({
    ...l,
    ...TaxEngine.computeLine({ price: l.cost, qty: l.qty, gstRate: l.gst, includeGst })
  }));
  const totals = TaxEngine.computeInvoiceTotals(priced);

  const purchase = {
    idempotency_key: SyncEngine.generateIdempotencyKey(),
    vendor: vendor || {},
    billNo: billNo || '',
    // Division is scoped server-side to its vendor (same name under two
    // different companies must not collide) — see create_purchase_atomic.
    divisionName: divisionName || '',
    billDate: new Date().toISOString().slice(0, 10),
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toISOString(),
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    roundOff: totals.roundOff,
    total: totals.total,
    interstate: TaxEngine.isInterstate({
      customerGstin: vendor?.gstin || '',
      customerStateCode: vendor?.stateCode || '',
      shopStateCode: APP_STATE.tenantProfile.stateCode || ''
    }),
    paymentStatus: 'unpaid',
    amountPaid: 0,
    source,
    items: priced
  };

  APP_STATE.purchases.push(purchase);
  persistState();

  if (APP_STATE.cloudSession && navigator.onLine) {
    SB.savePurchase(APP_STATE.tenantProfile.shopId, purchase).then(({ error }) => {
      if (isFatalSyncError(error)) SyncEngine.enqueue(purchase, 'purchase');
      updateSyncIndicator();
      APP_STATE.vendorsLoaded = false; // force a refetch so the new/updated division shows up next time Khata → Vendors opens
    });
  } else {
    SyncEngine.enqueue(purchase, 'purchase');
  }
}

/* ==========================================================================
   AI PURCHASE INGESTION — client side
   The Edge Function returns a validated, reconciled bill (header + grouped
   items + derived totals + warnings). This screen's job is to make a human
   confirm it before anything touches stock, because an OCR mistake written
   into inventory is far more expensive to unwind than one caught here.
   ========================================================================== */
async function processAiInvoice(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!navigator.onLine) {
    showSaasToast('AI reading needs an internet connection. Use Manual Entry for now.', 4000, 'err');
    event.target.value = '';
    return;
  }
  if (!APP_STATE.cloudSession) {
    showSaasToast('Sign in to your cloud account to use AI invoice reading.', 4000, 'err');
    event.target.value = '';
    return;
  }

  setDisplay('aiProgressBox', 'block');
  setTxt('aiProgressText', 'Uploading and reading the bill…');
  setDisplay('aiStagingSection', 'none');

  const { bill, error } = await SB.parseInvoiceImage(file);

  setDisplay('aiProgressBox', 'none');
  event.target.value = ''; // allow re-uploading the same file after a fix

  if (error) {
    showSaasToast(`AI reading failed: ${error}`, 6000, 'err');
    return;
  }

  const items = bill?.bill_items || [];
  if (!items.length) {
    showSaasToast('No line items could be read. Try a flatter, better-lit photo — or use Manual Entry.', 6000, 'err');
    return;
  }

  APP_STATE.aiBill = bill;

  // Flatten to the staging shape, keeping every tracking identifier.
  APP_STATE.aiStagingItems = items.map(it => {
    const tm = it.tracking_metadata || {};
    return {
      name: it.product_name,
      hsn: it.hsn_sac || '',
      gst: Number(it.gst_percentage) || 0,
      qty: Number(it.quantity) || 0,
      cost: Number(it.unit_rate) || 0,
      lineTotal: Number(it.line_total_inclusive) || 0,
      serials: Array.isArray(tm.serial_or_imei) ? tm.serial_or_imei : [],
      batch: tm.batch_number || '',
      expiry: tm.expiry_date || '',
      huid: tm.hudi_or_other_id || '',
      // Resolved against existing stock so the reviewer can see at a glance
      // whether this is a restock or a brand-new SKU.
      matchedId: matchInventoryItem(it.product_name)?.id || null
    };
  });

  renderAiBillHeader(bill);
  renderAiStagingTable();
  setDisplay('aiStagingSection', 'block');
}

// Fuzzy-matches an extracted product name to existing stock. Exact match
// first, then a normalised compare — OCR routinely returns
// "Samsung  Galaxy A55" for an item saved as "Samsung Galaxy A55", and a
// strict compare would create a duplicate SKU with its own serial pool.
function matchInventoryItem(name) {
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(name);
  if (!target) return null;
  const inv = APP_STATE.inventory || [];
  return inv.find(i => norm(i.name) === target)
      || inv.find(i => norm(i.name).includes(target) || target.includes(norm(i.name)))
      || null;
}

function renderAiBillHeader(bill) {
  const h = bill.bill_header || {};
  const sum = bill.bill_summary || {};
  const meta = bill.extraction_meta || {};

  setTxt('aiVendorName', h.vendor_name || 'Not detected');
  setTxt('aiInvoiceNo', h.invoice_number || 'Not detected');
  setTxt('aiInvoiceDate', h.invoice_date || 'Not detected');
  setTxt('aiSupplierGstin', h.supplier_gstin || 'Not detected');
  setTxt('aiBillTotal', `₹${(sum.grand_total || 0).toFixed(2)}`);

  // Confidence is shown prominently rather than buried: a "low" badge is the
  // signal to check this bill against the paper before merging.
  const badge = $id('aiConfidenceBadge');
  if (badge) {
    const c = meta.confidence || 'medium';
    badge.className = `pill ${c === 'high' ? 'paid' : c === 'medium' ? 'pending' : 'overdue'}`;
    badge.innerText = `${c.toUpperCase()} CONFIDENCE`;
  }

  const warnBox = $id('aiWarningsBox');
  if (warnBox) {
    const warnings = meta.warnings || [];
    if (!warnings.length) {
      warnBox.style.display = 'none';
    } else {
      warnBox.style.display = 'block';
      warnBox.innerHTML = `<strong>${warnings.length} thing(s) to check:</strong><ul>` +
        warnings.map(w => `<li>${esc(w)}</li>`).join('') + `</ul>`;
    }
  }

  // Show the model's own total next to the derived one when they disagree —
  // the reviewer needs to see both numbers to decide which is right.
  const cmp = $id('aiTotalCompare');
  if (cmp) {
    const printed = sum.printed_grand_total;
    if (printed && Math.abs(printed - (sum.grand_total || 0)) > 1) {
      cmp.style.display = 'block';
      cmp.innerHTML = `Bill shows <strong>₹${printed.toFixed(2)}</strong>, line items add to <strong>₹${(sum.grand_total || 0).toFixed(2)}</strong>. Verify against the paper before merging.`;
    } else {
      cmp.style.display = 'none';
    }
  }
}

function renderAiStagingTable() {
  const tbody = $id('aiStagingBody');
  setTxt('aiStagingCount', APP_STATE.aiStagingItems.length);
  if (!tbody) return;

  tbody.innerHTML = APP_STATE.aiStagingItems.map((it, idx) => {
    const ids = [
      ...it.serials,
      it.batch ? `Batch ${it.batch}` : '',
      it.expiry ? `Exp ${it.expiry}` : '',
      it.huid ? `HUID ${it.huid}` : ''
    ].filter(Boolean);

    const serialWarn = it.serials.length > 0 && it.serials.length !== it.qty;

    return `<tr>
      <td>
        <strong>${esc(it.name)}</strong>
        ${it.matchedId
          ? '<br><span class="pill info" style="margin-top:3px;">Restock</span>'
          : '<br><span class="pill draft" style="margin-top:3px;">New product</span>'}
      </td>
      <td><code>${esc(it.hsn || '—')}</code></td>
      <td style="max-width:200px; font-size:0.74rem;">
        ${ids.length ? ids.map(v => `<code>${esc(v)}</code>`).join('<br>') : '<span style="color:var(--text-faint);">none</span>'}
        ${serialWarn ? `<br><span style="color:var(--danger); font-size:0.7rem;">${it.serials.length} ID(s) for ${it.qty} unit(s)</span>` : ''}
      </td>
      <td style="text-align:center;">${it.gst}%</td>
      <td style="text-align:center;">
        <input type="number" min="0" value="${it.qty}" style="width:58px; padding:5px; text-align:center; border:1px solid var(--border); border-radius:7px;"
               oninput="editAiStagingField(${idx}, 'qty', this.value)">
      </td>
      <td style="text-align:right;">
        <input type="number" min="0" step="0.01" value="${it.cost}" style="width:84px; padding:5px; text-align:right; border:1px solid var(--border); border-radius:7px;"
               oninput="editAiStagingField(${idx}, 'cost', this.value)">
      </td>
      <td style="text-align:center;">
        <button class="btn-pill secondary" style="padding:4px 9px; font-size:0.7rem;" onclick="discardAiStagingItem(${idx})">Drop</button>
      </td>
    </tr>`;
  }).join('');
}

// Every extracted value stays editable. OCR is a first draft, not an
// authority — the shop owner looking at the paper bill is.
function editAiStagingField(idx, field, value) {
  const it = APP_STATE.aiStagingItems[idx];
  if (!it) return;
  const n = parseFloat(value);
  it[field] = isFinite(n) && n >= 0 ? n : 0;
}

function discardAiStagingItem(idx) {
  APP_STATE.aiStagingItems.splice(idx, 1);
  renderAiStagingTable();
  if (!APP_STATE.aiStagingItems.length) setDisplay('aiStagingSection', 'none');
}

/* Commits the whole reviewed bill: stock in, purchase recorded, vendor
   payables updated — one confirmation, one atomic server call. */
function commitAiBill() {
  const staged = APP_STATE.aiStagingItems || [];
  if (!staged.length) { showSaasToast('Nothing to merge.', 3000, 'err'); return; }

  const zeroQty = staged.filter(i => i.qty <= 0);
  if (zeroQty.length) {
    showSaasToast(`${zeroQty.length} line(s) have quantity 0 — set a quantity or drop them first.`, 5000, 'err');
    return;
  }

  const header = APP_STATE.aiBill?.bill_header || {};
  const purchaseLines = [];

  staged.forEach(st => {
    let target = st.matchedId ? APP_STATE.inventory.find(i => i.id === st.matchedId) : null;

    if (target) {
      target.stock += st.qty;
      if (st.cost > 0) target.cost = st.cost;
      if (st.hsn) target.hsn = st.hsn;
    } else {
      // Category is inferred from which identifier type the bill carried —
      // a batch+expiry is a pharmacy line, a HUID is jewellery, a 15-digit
      // IMEI is electronics. Better than defaulting everything to one.
      const category =
        st.huid ? 'Jewelry'
        : (st.batch || st.expiry) ? 'Pharmacy'
        : st.serials.some(s => /^\d{15}$/.test(s)) ? 'Electronics'
        : (APP_STATE.tenantProfile.assignedIndustry !== 'All'
            ? APP_STATE.tenantProfile.assignedIndustry : 'Grocery');

      const initialMeta =
        category === 'Electronics' ? { imei: '', warranty: '' }
        : category === 'Jewelry' ? { karat: '22K', netWt: 0, grossWt: 0, making: 0 }
        : category === 'Pharmacy' ? { batch: st.batch || '', expiry: st.expiry || '' }
        : { pack: '' };

      target = {
        id: crypto.randomUUID(),
        name: st.name, category, barcode: '',
        hsn: st.hsn || APP_STATE.tenantProfile.defaultHsn || '',
        gst: st.gst, cost: st.cost,
        price: st.cost > 0 ? TaxEngine.round2(st.cost * 1.2) : 0,
        stock: st.qty,
        serials: [], huids: [], batches: [],
        meta: /** @type {any} */ (initialMeta)
      };
      APP_STATE.inventory.push(target);
    }

    // Attach identifiers to the right pool for the item's category.
    if (st.serials.length) {
      if (target.category === 'Jewelry') {
        target.huids = target.huids || [];
        st.serials.forEach(v => { if (!target.huids.includes(v)) target.huids.push(v); });
      } else {
        target.serials = target.serials || [];
        st.serials.forEach(v => { if (!target.serials.includes(v)) target.serials.push(v); });
      }
    }
    if (st.huid && !(target.huids || []).includes(st.huid)) {
      target.huids = target.huids || [];
      target.huids.push(st.huid);
    }
    if (st.batch) {
      target.batches = target.batches || [];
      target.batches.push({ batch: st.batch, expiry: st.expiry || '', stock: st.qty });
    }

    syncItemToCloud(target);

    purchaseLines.push({
      id: target.id, name: target.name, hsn: target.hsn, gst: st.gst,
      qty: st.qty, cost: st.cost, price: target.price,
      identifier: st.serials[0] || st.batch || st.huid || '',
      expiry: st.expiry || ''
    });
  });

  recordPurchaseBill({
    vendor: {
      name: header.vendor_name || 'Unknown Supplier',
      gstin: header.supplier_gstin || '',
      stateCode: (header.supplier_gstin || '').slice(0, 2)
    },
    billNo: header.invoice_number || '',
    items: purchaseLines,
    source: 'ai_ocr'
  });

  persistState();
  APP_STATE.aiStagingItems = [];
  APP_STATE.aiBill = null;
  setDisplay('aiStagingSection', 'none');
  closeInwardModal();
  renderCatalog();
  renderAlertCentre();
  showSaasToast(`${purchaseLines.length} item(s) merged into stock and the supplier bill recorded.`, 4500);
}

/* commitSingleAiItem / commitAllAiItems removed — superseded by
   commitAiBill(), which merges the whole reviewed bill atomically and
   records the supplier invoice behind it. */


/* ==========================================================================
   DYNAMIC IDENTIFIER MODAL (ELECTRONICS / PHARMA / JEWELRY)
   ========================================================================== */
function openItemModal(item) {
  // Out of stock: for pharmacy, surface same-molecule alternatives instead
  // of a dead end. Non-blocking — the cashier can still bill it if the shop
  // allows negative stock, or pick a suggestion.
  if (item.stock <= 0) {
    if (item.category === 'Pharmacy') {
      showAlternativesFor(item);
      const alts = findAlternatives(item);
      if (alts.length) return; // suggestions shown; let the cashier choose
    }
    showSaasToast(`${item.name} is out of stock.`, 3000, 'err');
    return;
  }

  // Near-expiry warning at the point of sale, not just on the dashboard —
  // a batch about to expire should be flagged while it's being dispensed.
  const nearExp = getExpiryAlerts().filter(e => e.itemId === item.id);
  if (nearExp.length) {
    const worst = nearExp[0];
    showSaasToast(worst.expired
      ? `Batch ${worst.batch} of ${item.name} EXPIRED ${Math.abs(worst.days)} day(s) ago — do not dispense.`
      : `Batch ${worst.batch} of ${item.name} expires in ${worst.days} day(s).`,
      5000, worst.expired ? 'err' : 'ok');
  }

  APP_STATE.stagingItem = JSON.parse(JSON.stringify(item));
  const modal = $id('attrModal');
  setTxt('attrModalTitle', `${item.name} (${item.category})`);
  const body = $id('attrModalBody');
  if (!body) return;
  body.innerHTML = '';

  const serialList = Array.isArray(item.serials) ? item.serials : [];
  const huidList = Array.isArray(item.huids) ? item.huids : [];
  const batchList = Array.isArray(item.batches) ? item.batches : [];

  if (item.category === 'Electronics') {
    let serialOptionsHtml = `<option value="">-- Bill without Serial / Untracked (${Math.max(0, item.stock - serialList.length)} left) --</option>`;
    serialList.forEach(s => { serialOptionsHtml += `<option value="${esc(s)}">IMEI: ${esc(s)}</option>`; });

    body.innerHTML = `
      <div class="form-input"><label>Select Registered IMEI / Serial</label><select id="mSerialSelect">${serialOptionsHtml}</select></div>
      <div class="form-input"><label>Or Type / Scan New Serial</label><input type="text" id="mCustomSerial" placeholder="Optional manual serial"></div>
      <div class="form-input"><label>Unit Price (Excl. Tax)</label><input type="number" id="mPrice" value="${item.price}"></div>
      <div class="form-input"><label>Quantity</label><input type="number" id="mQty" value="1" min="1" max="${item.stock}"></div>
    `;
  } else if (item.category === 'Jewelry') {
    let huidOptionsHtml = `<option value="">-- Select Registered HUID --</option>`;
    huidList.forEach(h => { huidOptionsHtml += `<option value="${esc(h)}">HUID: ${esc(h)}</option>`; });

    body.innerHTML = `
      <div class="form-input"><label>Select Hallmark HUID</label><select id="mHuidSelect">${huidOptionsHtml}</select></div>
      <div class="form-input"><label>Or Type New HUID</label><input type="text" id="mCustomHuid" placeholder="e.g. HUID-A92B1"></div>
      <div class="form-input"><label>Purity / Karat</label><input type="text" id="mKarat" value="${esc(item.meta?.karat || '22K')}"></div>
      <div class="form-input"><label>Gold Rate / gm (₹)</label><input type="number" id="mGoldRate" value="${APP_STATE.liveGoldRate}"></div>
      <div class="form-input"><label>Net Weight (Grams)</label><input type="number" step="0.001" id="mNetWt" value="${item.meta?.netWt || 5.0}"></div>
      <div class="form-input"><label>Making Charges (₹)</label><input type="number" id="mMaking" value="${item.meta?.making || 1500}"></div>
      <div class="form-input"><label>Quantity</label><input type="number" id="mQty" value="1" min="1" max="${item.stock}"></div>
    `;
  } else if (item.category === 'Pharmacy') {
    let batchOptionsHtml = `<option value="">-- Select Batch --</option>`;
    batchList.forEach(b => { batchOptionsHtml += `<option value="${esc(b.batch)}">Batch: ${esc(b.batch)} (Exp: ${esc(b.expiry)})</option>`; });

    body.innerHTML = `
      <div class="form-input"><label>Select Batch</label><select id="mBatchSelect">${batchOptionsHtml}</select></div>
      <div class="form-input"><label>Or Type Batch No</label><input type="text" id="mBatch" value="${esc(item.meta?.batch || '')}"></div>
      <div class="form-input"><label>Expiry Date</label><input type="month" id="mExp" value="${esc(item.meta?.expiry || '')}"></div>
      <div class="form-input"><label>Rate (₹)</label><input type="number" id="mPrice" value="${item.price}"></div>
      <div class="form-input"><label>Quantity</label><input type="number" id="mQty" value="1" min="1" max="${item.stock}"></div>
    `;
  } else {
    body.innerHTML = `
      <div class="form-input"><label>Selling Rate (₹)</label><input type="number" id="mPrice" value="${item.price}"></div>
      <div class="form-input"><label>Quantity</label><input type="number" id="mQty" value="1" min="1" max="${item.stock}"></div>
    `;
  }
  setStep(2);
  if (modal) modal.classList.add('open');
}
function closeModal() { const m = $id('attrModal'); if (m) m.classList.remove('open'); }

// Rounds to 2 decimals safely — prevents floating-point drift (0.1+0.2 style
// errors) from silently accumulating across a cart with many line items.
function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function commitModalItem() {
  const it = APP_STATE.stagingItem;
  let qty = parseInt($id('mQty')?.value, 10) || 1;
  let price = parseFloat($id('mPrice')?.value);
  if (price === undefined || isNaN(price)) price = it.price;

  // Guard rails: a 0/negative qty or price should never reach a saved
  // invoice — it silently corrupts stock counts and customer ledgers.
  if (qty < 1) qty = 1;
  if (qty > it.stock) qty = it.stock;
  if (price < 0) price = 0;

  let assignedIdentifier = '';
  if (it.category === 'Electronics') {
    const sel = $id('mSerialSelect')?.value.trim();
    const cust = $id('mCustomSerial')?.value.trim();
    assignedIdentifier = cust || sel || '';
    it.meta.imei = assignedIdentifier;
  } else if (it.category === 'Jewelry') {
    const sel = $id('mHuidSelect')?.value.trim();
    const cust = $id('mCustomHuid')?.value.trim();
    assignedIdentifier = cust || sel || '';
    it.meta.huid = assignedIdentifier;
    const netWt = parseFloat($id('mNetWt')?.value) || 0;
    const rate = parseFloat($id('mGoldRate')?.value) || APP_STATE.liveGoldRate;
    const making = parseFloat($id('mMaking')?.value) || 0;
    price = Math.max(0, (netWt * rate) + making);
  } else if (it.category === 'Pharmacy') {
    const sel = $id('mBatchSelect')?.value.trim();
    const cust = $id('mBatch')?.value.trim();
    assignedIdentifier = cust || sel || '';
    it.meta.batch = assignedIdentifier;
  }

  // Real enforcement for the Settings → Industry Vertical → "Require
  // Identifier" toggle. Only applies to categories that toggle actually
  // covers (INDUSTRY_TRACK_MAP), so grocery/other items are never blocked
  // by a rule meant for electronics/jewelry/pharmacy.
  const p = APP_STATE.tenantProfile;
  if (p.requireIdentifier && INDUSTRY_TRACK_MAP[it.category] && !assignedIdentifier) {
    showSaasToast(`This ${it.category} item needs a ${INDUSTRY_TRACK_MAP[it.category].noun} before it can be added — set one in the field above, or turn this rule off in Settings → Industry Vertical.`, 5000, 'err');
    return;
  }

  // Real enforcement for "Mandatory HSN on All Items".
  if (p.mandatoryHsn && !String(it.hsn || '').trim()) {
    showSaasToast(`"${esc(it.name)}" has no HSN/SAC code. Add one in Stock Master, or turn this rule off in Settings → GST & Tax Rates.`, 5000, 'err');
    return;
  }

  const includeGst = APP_STATE.tenantProfile.gstPriceMode === 'inclusive';
  const line = TaxEngine.computeLine({ price, qty, gstRate: it.gst, includeGst });

  APP_STATE.cart.push({
    ...it, price, qty,
    taxableValue: line.taxableValue,
    gstAmount: line.gstAmount,
    totalAmount: line.totalAmount,
    // Stamp the rate used at billing time. If a budget changes slabs later,
    // this invoice still reports the rate it was actually taxed at.
    gstRateAtBilling: line.gstRateAtBilling,
    gstModeAtBilling: line.gstModeAtBilling,
    assignedIdentifier
  });
  closeModal();
  setStep(4);
  renderCart();
}


function renderCart() {
  const tbody = $id('cartTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let taxable = 0, gstTotal = 0;

  APP_STATE.cart.forEach((it, idx) => {
    taxable = r2(taxable + it.taxableValue);
    gstTotal = r2(gstTotal + it.gstAmount);

    tbody.innerHTML += `
      <tr>
        <td><strong>${esc(it.name)}</strong><br><small style="color:var(--text-muted);">${it.assignedIdentifier ? 'ID: ' + it.assignedIdentifier : 'Untracked'} • ${it.gst}% GST</small></td>
        <td>${it.qty}</td>
        <td>₹${it.price.toFixed(2)}</td>
        <td><strong>₹${it.totalAmount.toFixed(2)}</strong></td>
        <td><span style="color:var(--danger); cursor:pointer;" onclick="removeCart(${idx})">✕</span></td>
      </tr>
    `;
  });

  const preciseGrand = r2(taxable + gstTotal);
  const roundedGrand = Math.round(preciseGrand);
  setTxt('txtTaxable', `₹${taxable.toFixed(2)}`);
  setTxt('txtGst', `₹${gstTotal.toFixed(2)}`);
  setTxt('txtGrand', `₹${roundedGrand.toFixed(2)}`);

  const qrBox = $id('posUpiQrBox');
  if (qrBox && roundedGrand > 0) {
    qrBox.innerHTML = generateDynamicUpiQR(roundedGrand, `INV-${APP_STATE.invCounter}`);
  }
}

function removeCart(idx) { APP_STATE.cart.splice(idx, 1); renderCart(); }

function setTender(mode, el) {
  setStep(5);
  APP_STATE.selectedTender = mode;
  $qa('.btn-tender').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function setStep(num) {
  for (let i = 1; i <= 6; i++) {
    const chip = $id(`stepChip-${i}`);
    if (chip) {
      chip.classList.toggle('active', i === num);
      chip.classList.toggle('done', i < num);
    }
  }
}
function jumpToStep(n) {
  setStep(n);
  if (n === 1) $id('barcodeSearch')?.focus();
  if (n === 3) $id('custPhone')?.focus();
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
   CHECKOUT, OFFLINE SYNC & INVOICE PRINTER
   ========================================================================== */
// Reserves the next invoice number. Online, this comes from the server
// (next_invoice_number RPC) so two devices in the same shop can never mint
// the same number. Offline, it falls back to the local counter — a collision
// is then possible but is reconciled on the next cloud load, and a blocked
// sale at the counter is a worse outcome than a number that shifts later.
async function reserveInvoiceNumber() {
  if (navigator.onLine && APP_STATE.cloudSession && APP_STATE.tenantProfile.shopId) {
    try {
      const { data, error } = await SB.nextInvoiceNumber(APP_STATE.tenantProfile.shopId);
      if (!error && data) return data;
    } catch (e) { /* fall through to local */ }
  }
  return `INV-${APP_STATE.invCounter}`;
}

async function checkoutBill() {
  if (!APP_STATE.cart.length) return alert("Cart is empty!");
  const phone = $id('custPhone')?.value.trim() || '-';
  const name = $id('custName')?.value.trim() || 'Cash Customer';
  const gstin = $id('custGstin')?.value.trim() || '';
  const pan = $id('custPan')?.value.trim().toUpperCase() || '';
  const drugLicenseNo = $id('custDrugLicense')?.value.trim() || '';
  const address = $id('custAddress')?.value.trim() || '';
  const stateCode = $id('custState')?.value || '';

  const totals = TaxEngine.computeInvoiceTotals(APP_STATE.cart);
  const interstate = TaxEngine.isInterstate({
    customerGstin: gstin,
    customerStateCode: stateCode,
    shopStateCode: APP_STATE.tenantProfile.stateCode || ''
  });
  const placeOfSupply = TaxEngine.resolvePlaceOfSupply({
    customerGstin: gstin,
    customerStateCode: stateCode,
    shopStateCode: APP_STATE.tenantProfile.stateCode || ''
  });

  const invoice = {
    invoiceNo: await reserveInvoiceNumber(),
    idempotency_key: SyncEngine.generateIdempotencyKey(),
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toISOString(),
    customer: {
      name, phone, gstin, pan, drugLicenseNo, address,
      stateCode,
      stateName: GST_STATE_CODES[stateCode] || ''
    },
    tender: APP_STATE.selectedTender,
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    roundOff: totals.roundOff,
    total: totals.total,
    interstate,
    placeOfSupply,
    placeOfSupplyName: GST_STATE_CODES[placeOfSupply] || '',
    industry: APP_STATE.tenantProfile.assignedIndustry || 'All',
    items: JSON.parse(JSON.stringify(APP_STATE.cart))
  };

  APP_STATE.sales.push(invoice);

  // Decrement Stock & Slice used identifiers (IMEI / HUID)
  APP_STATE.cart.forEach(c => {
    const item = APP_STATE.inventory.find(i => i.id === c.id);
    if (item) {
      item.stock = Math.max(0, item.stock - c.qty);
      if (c.assignedIdentifier) {
        if (Array.isArray(item.serials)) item.serials = item.serials.filter(s => s !== c.assignedIdentifier);
        if (Array.isArray(item.huids)) item.huids = item.huids.filter(h => h !== c.assignedIdentifier);
      }
    }
  });

  // Customer Ledger & History Sync
  if (phone !== '-') {
    let cust = APP_STATE.customers.find(c => c.phone === phone);
    if (!cust) {
      cust = {
        phone,
        name,
        category: 'Retail',
        gstin,
        pan,
        drugLicenseNo,
        address,
        stateCode,
        dues: 0,
        totalOrdersVal: 0,
        orderHistory: []
      };
      APP_STATE.customers.push(cust);
    } else {
      // Keep the party record current — a customer who gives their address
      // on a later visit should have it saved, not silently discarded.
      if (address) cust.address = address;
      if (stateCode) cust.stateCode = stateCode;
      if (gstin) cust.gstin = gstin;
      if (pan) cust.pan = pan;
      if (drugLicenseNo) cust.drugLicenseNo = drugLicenseNo;
      if (name && name !== 'Cash Customer') cust.name = name;
    }
    if (APP_STATE.selectedTender === 'Khata') cust.dues += invoice.total;
    cust.totalOrdersVal = (cust.totalOrdersVal || 0) + invoice.total;
    cust.orderHistory = cust.orderHistory || [];
    cust.orderHistory.push({
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      items: invoice.items.map(i => `${esc(i.name)} (${i.assignedIdentifier || 'x' + i.qty})`).join(', '),
      total: invoice.total,
      tender: invoice.tender,
      status: APP_STATE.selectedTender === 'Khata' ? 'DUE' : 'PAID'
    });
  }

  // Cloud persistence — fire-and-forget so the counter never waits on
  // network for a completed, already-printed sale. Failures self-queue.
  syncInvoiceToCloud(invoice);

  setStep(6);
  printA4Invoice(invoice);          // populates the on-screen A4 template (always, for record/preview)
  PrinterEngine.dispatchPrint(invoice); // actually routes to thermal or window.print() per Settings

  APP_STATE.invCounter++;
  persistState();

  APP_STATE.cart = [];
  setVal('custPhone', '');
  setVal('custName', '');
  setVal('custGstin', '');
  setVal('custPan', '');
  setVal('custDrugLicense', '');
  setVal('custAddress', '');
  resetCustomerStateToShopDefault();
  updateTaxTypeHint();
  renderCart();
  renderCatalog();
  setStep(1);
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
   REPORTS & DASHBOARD CONTROLLER
   ========================================================================== */
function openReport(reportKey, presetPhone) {
  APP_STATE.currentReportKey = reportKey;
  setDisplay('reportsHubView', 'none');
  setDisplay('reportsDetailView', 'block');

  const titleMap = {
    'cust_360': 'Customer 360° Profile & Lifetime History',
    'party_outstanding': 'Party Wise Outstanding Ledger',
    'gstr1': 'GSTR-1 Sales & HSN Return',
    'serial_tracking': 'Serial Number / IMEI / HUID Device Audit',
    'stock_summary': 'Stock Summary & Valuation',
    'sales_summary': 'Sales Daybook'
  };
  setTxt('drillReportTitle', titleMap[reportKey] || 'Business Report');

  const isC360 = reportKey === 'cust_360';
  setDisplay('cust360SelectorWrap', isC360 ? 'block' : 'none');
  setDisplay('cust360HeaderStats', isC360 ? 'grid' : 'none');

  if (isC360) {
    // Search box replaced the old dropdown — deep-linking now just picks
    // a specific customer directly, and otherwise shows the highest-value
    // customer by default rather than an arbitrary first row.
    const target = (presetPhone && APP_STATE.customers.some(c => c.phone === presetPhone))
      ? APP_STATE.customers.find(c => c.phone === presetPhone)
      : [...APP_STATE.customers].sort((a, b) => (b.totalOrdersVal || 0) - (a.totalOrdersVal || 0))[0];

    if (target) {
      setVal('cust360SearchInput', target.name);
      renderCustomer360Profile(target.phone);
    } else {
      const thead = $id('drillTableHead');
      if (thead) thead.innerHTML = '';
      const tbody = $id('drillTableBody');
      if (tbody) tbody.innerHTML = `<tr><td style="text-align:center; color:var(--text-muted); padding:24px;">No customers yet — search will populate once you have some.</td></tr>`;
    }
  } else {
    renderActiveReportData();
  }
}



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

/* ==========================================================================
   DASHBOARD CARD DRILL-THROUGH
   Every KPI card is clickable and lands on a filtered invoice list that
   explains the number, with Excel/CSV export from there. A dashboard figure
   a shop owner can't click into is a number they have to trust blindly —
   this makes every headline value auditable in two taps.
   ========================================================================== */
const DASH_CARD_FILTERS = {
  all:   { label: 'All invoices',                     test: () => true },
  khata: { label: 'Credit (Khata) sales — unpaid',    test: s => s.tender === 'Khata' },
  paid:  { label: 'Paid sales (Cash / UPI / Card)',   test: s => s.tender !== 'Khata' },
  due:   { label: 'Parties with outstanding balance', test: null }  // party-level, not invoice-level
};

function drillDashboardCard(key) {
  const cfg = DASH_CARD_FILTERS[key];
  if (!cfg) return;

  switchView('reports');
  setDisplay('reportsHubView', 'none');
  setDisplay('reportsDetailView', 'block');
  setDisplay('cust360SelectorWrap', 'none');
  setDisplay('cust360HeaderStats', 'none');

  if (key === 'due') {
    // Outstanding is a property of a party, not of one invoice — send this
    // card to the ageing report rather than a filtered invoice list, which
    // would double-count a customer with several unpaid bills.
    APP_STATE.currentReportKey = 'party_outstanding';
    setTxt('drillReportTitle', 'Receivables Ageing');
    setTxt('drillFilterLabel', 'Parties with an outstanding balance, bucketed by age');
    renderActiveReportData();
    return;
  }

  APP_STATE.currentReportKey = `dash_${key}`;
  APP_STATE.dashDrillFilter = key;
  setTxt('drillReportTitle', 'Invoice Register');
  setTxt('drillFilterLabel', cfg.label);
  renderDashDrillTable(key);
}

function renderDashDrillTable(key) {
  const thead = $id('drillTableHead');
  const tbody = $id('drillTableBody');
  if (!thead || !tbody) return;

  const cfg = DASH_CARD_FILTERS[key];
  const rows = (APP_STATE.sales || []).filter(cfg.test);

  thead.innerHTML = `<tr>
    <th>Invoice</th><th>Date</th><th>Party</th><th>Phone</th><th>Mode</th>
    <th style="text-align:right;">Taxable</th>
    <th style="text-align:right;">GST</th>
    <th style="text-align:right;">Total</th>
    <th>Status</th></tr>`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:26px;">No invoices match this filter yet.</td></tr>`;
    return;
  }

  let tT = 0, tG = 0, tTot = 0;
  tbody.innerHTML = [...rows].reverse().map(s => {
    tT = TaxEngine.round2(tT + (s.taxable || 0));
    tG = TaxEngine.round2(tG + (s.gstTotal || 0));
    tTot = TaxEngine.round2(tTot + (s.total || 0));

    // A returned invoice still appears — it must, for the audit trail — but
    // is visually marked so a total that includes it isn't misread.
    let pill = 'paid', label = 'PAID';
    if (s.status === 'returned') { pill = 'overdue'; label = 'RETURNED'; }
    else if (s.status === 'partially_returned') { pill = 'pending'; label = 'PART. RETURNED'; }
    else if (s.tender === 'Khata') {
      const age = Math.floor((Date.now() - new Date(s.timestamp).getTime()) / 86400000);
      pill = age > 30 ? 'overdue' : 'pending';
      label = age > 30 ? `${age}D OVERDUE` : 'DUE';
    }

    return `<tr>
      <td><strong>${esc(s.invoiceNo)}</strong></td>
      <td>${s.date}</td>
      <td>${esc(s.customer?.name || 'Cash Customer')}</td>
      <td>${esc(s.customer?.phone || '-')}</td>
      <td>${esc(s.tender)}</td>
      <td style="text-align:right;">₹${(s.taxable || 0).toFixed(2)}</td>
      <td style="text-align:right;">₹${(s.gstTotal || 0).toFixed(2)}</td>
      <td style="text-align:right; font-weight:700;">₹${(s.total || 0).toFixed(2)}</td>
      <td><span class="pill ${pill}">${label}</span></td>
    </tr>`;
  }).join('') + `<tr style="font-weight:800; border-top:2px solid #ccc; background:#fafafa;">
      <td colspan="5">TOTAL — ${rows.length} invoice(s)</td>
      <td style="text-align:right;">₹${tT.toFixed(2)}</td>
      <td style="text-align:right;">₹${tG.toFixed(2)}</td>
      <td style="text-align:right;">₹${tTot.toFixed(2)}</td>
      <td>—</td>
    </tr>`;
}

function closeReportDetail() {
  setDisplay('reportsDetailView', 'none');
  setDisplay('reportsHubView', 'block');
}

function renderActiveReportData() {
  const thead = $id('drillTableHead');
  const tbody = $id('drillTableBody');
  if (!thead || !tbody) return;

  // Dashboard drill-throughs render their own table shape.
  if (String(APP_STATE.currentReportKey || '').startsWith('dash_')) {
    renderDashDrillTable(APP_STATE.dashDrillFilter);
    return;
  }

  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (APP_STATE.currentReportKey === 'party_outstanding') {
    // Receivables ageing. A single "Closing Balance" number tells an owner
    // nothing about collection risk — ₹50,000 due for 12 days and ₹50,000
    // due for 200 days are completely different problems. Buckets are
    // computed from the actual unpaid Khata invoice dates, not from the
    // customer record, because the record only holds a running total.
    const aged = computeReceivablesAgeing();

    thead.innerHTML = `<tr><th>Party Name</th><th>Phone</th>
      <th style="text-align:right;">0–30 d</th>
      <th style="text-align:right;">31–60 d</th>
      <th style="text-align:right;">61–90 d</th>
      <th style="text-align:right;">90+ d</th>
      <th style="text-align:right;">Total Due</th>
      <th>Oldest</th></tr>`;

    if (!aged.rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No outstanding receivables. Every party is settled.</td></tr>`;
    }

    aged.rows.forEach(r => {
      // 90+ is the bracket that actually predicts a write-off, so it gets
      // visual weight rather than sitting as one number among four.
      const risk = r.b90 > 0 ? 'color:var(--danger); font-weight:800;' : '';
      tbody.innerHTML += `<tr>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${esc(r.phone)}</td>
        <td style="text-align:right;">${r.b30 ? '₹' + r.b30.toFixed(2) : '–'}</td>
        <td style="text-align:right;">${r.b60 ? '₹' + r.b60.toFixed(2) : '–'}</td>
        <td style="text-align:right;">${r.b90 ? '₹' + r.b90.toFixed(2) : '–'}</td>
        <td style="text-align:right; ${risk}">${r.bOver ? '₹' + r.bOver.toFixed(2) : '–'}</td>
        <td style="text-align:right; font-weight:800;">₹${r.total.toFixed(2)}</td>
        <td>${r.oldestDays != null ? r.oldestDays + ' d' : '–'}</td>
      </tr>`;
    });

    if (aged.rows.length) {
      const t = aged.totals;
      tbody.innerHTML += `<tr style="font-weight:800; border-top:2px solid #ccc; background:#fafafa;">
        <td colspan="2">TOTAL RECEIVABLE</td>
        <td style="text-align:right;">₹${t.b30.toFixed(2)}</td>
        <td style="text-align:right;">₹${t.b60.toFixed(2)}</td>
        <td style="text-align:right;">₹${t.b90.toFixed(2)}</td>
        <td style="text-align:right; color:var(--danger);">₹${t.bOver.toFixed(2)}</td>
        <td style="text-align:right;">₹${t.total.toFixed(2)}</td>
        <td>–</td>
      </tr>`;
    }
  } else if (APP_STATE.currentReportKey === 'serial_tracking') {
    thead.innerHTML = `<tr><th>Product</th><th>Barcode</th><th>Identifier List (IMEI/HUID/Batch)</th><th>Category</th><th>Stock</th><th style="text-align:right;">Price</th></tr>`;
    APP_STATE.inventory.forEach(i => {
      let idList = '-';
      if (Array.isArray(i.serials) && i.serials.length) idList = i.serials.join(', ');
      else if (Array.isArray(i.huids) && i.huids.length) idList = i.huids.join(', ');
      else if (Array.isArray(i.batches) && i.batches.length) idList = i.batches.map(b => `${b.batch} (${b.expiry})`).join(', ');

      tbody.innerHTML += `<tr><td><strong>${esc(i.name)}</strong></td><td><code>${esc(i.barcode || '-')}</code></td><td><code>${esc(idList)}</code></td><td>${esc(i.category)}</td><td>${i.stock}</td><td style="text-align:right;">₹${i.price.toFixed(2)}</td></tr>`;
    });
  } else if (APP_STATE.currentReportKey === 'gstr1') {
    // HSN-wise summary across ALL invoices, split by CGST/SGST vs IGST per
    // invoice's own transaction type — mirrors what GSTR-1's HSN summary
    // table expects. This is a same-app report, not a government e-filing
    // export (no GSTN portal integration) — see notes at end of file.
    thead.innerHTML = `<tr><th>HSN/SAC</th><th>GST%</th><th style="text-align:right;">Taxable Value</th><th style="text-align:right;">CGST</th><th style="text-align:right;">SGST</th><th style="text-align:right;">IGST</th><th style="text-align:right;">Total Tax</th></tr>`;
    // Reuses TaxEngine.groupByHsn per invoice (same function the printed
    // invoice uses), then merges across invoices — guarantees the return
    // and the invoices agree to the paisa.
    const groups = {};
    APP_STATE.sales.forEach(inv => {
      TaxEngine.groupByHsn(inv.items || [], inv.interstate).forEach(g => {
        const key = `${esc(g.hsn)}|${g.gstRate}`;
        if (!groups[key]) groups[key] = { hsn: g.hsn, gst: g.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        groups[key].taxable = TaxEngine.round2(groups[key].taxable + g.taxable);
        groups[key].cgst = TaxEngine.round2(groups[key].cgst + g.cgst);
        groups[key].sgst = TaxEngine.round2(groups[key].sgst + g.sgst);
        groups[key].igst = TaxEngine.round2(groups[key].igst + g.igst);
      });
    });
    if (!Object.keys(groups).length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No sales recorded yet this period.</td></tr>`;
    }
    Object.values(groups).forEach(g => {
      const totalTax = TaxEngine.round2(g.cgst + g.sgst + g.igst);
      tbody.innerHTML += `<tr><td>${esc(g.hsn)}</td><td>${g.gst}%</td><td style="text-align:right;">₹${g.taxable.toFixed(2)}</td><td style="text-align:right;">₹${g.cgst.toFixed(2)}</td><td style="text-align:right;">₹${g.sgst.toFixed(2)}</td><td style="text-align:right;">₹${g.igst.toFixed(2)}</td><td style="text-align:right; font-weight:700;">₹${totalTax.toFixed(2)}</td></tr>`;
    });
  } else if (APP_STATE.currentReportKey === 'stock_summary') {
    const canSeeCost = APP_STATE.isOwner !== false;
    thead.innerHTML = canSeeCost
      ? `<tr><th>Product</th><th>Category</th><th style="text-align:right;">Stock Qty</th><th style="text-align:right;">Cost/Unit</th><th style="text-align:right;">Value at Cost</th><th style="text-align:right;">Value at Selling Price</th></tr>`
      : `<tr><th>Product</th><th>Category</th><th style="text-align:right;">Stock Qty</th><th style="text-align:right;">Selling Price</th><th style="text-align:right;">Value at Selling Price</th></tr>`;

    let totalCostVal = 0, totalSellVal = 0;
    APP_STATE.inventory.forEach(i => {
      const hasCost = i.cost !== null && i.cost !== undefined && !isNaN(i.cost);
      const costVal = hasCost ? TaxEngine.round2(i.cost * i.stock) : null;
      const sellVal = TaxEngine.round2((i.price || 0) * i.stock);
      if (costVal !== null) totalCostVal = TaxEngine.round2(totalCostVal + costVal);
      totalSellVal = TaxEngine.round2(totalSellVal + sellVal);

      tbody.innerHTML += canSeeCost
        ? `<tr><td><strong>${esc(i.name)}</strong></td><td>${esc(i.category)}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">${fmtCost(i.cost)}</td><td style="text-align:right;">${fmtCost(costVal)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`
        : `<tr><td><strong>${esc(i.name)}</strong></td><td>${esc(i.category)}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">₹${(i.price || 0).toFixed(2)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`;
    });

    tbody.innerHTML += canSeeCost
      ? `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL STOCK VALUATION</td><td style="text-align:right;">₹${totalCostVal.toFixed(2)}</td><td style="text-align:right;">₹${totalSellVal.toFixed(2)}</td></tr>`
      : `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL AT SELLING PRICE</td><td style="text-align:right;">₹${totalSellVal.toFixed(2)}</td></tr>`;
  } else if (APP_STATE.currentReportKey === 'sales_summary') {
    thead.innerHTML = `<tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Mode</th><th style="text-align:right;">Taxable</th><th style="text-align:right;">GST</th><th style="text-align:right;">Total</th></tr>`;
    if (!APP_STATE.sales.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No invoices recorded yet.</td></tr>`;
    }
    let dayTaxable = 0, dayGst = 0, dayTotal = 0;
    [...APP_STATE.sales].reverse().forEach(inv => {
      dayTaxable = r2(dayTaxable + (inv.taxable || 0));
      dayGst = r2(dayGst + (inv.gstTotal || 0));
      dayTotal = r2(dayTotal + (inv.total || 0));
      tbody.innerHTML += `<tr class="clickable-row" onclick="openInvoiceActionPopup('${esc(inv.invoiceNo)}')"><td><strong>${esc(inv.invoiceNo)}</strong></td><td>${inv.date}</td><td>${esc(inv.customer?.name || 'Cash Customer')}</td><td>${esc(inv.tender)}</td><td style="text-align:right;">₹${(inv.taxable || 0).toFixed(2)}</td><td style="text-align:right;">₹${(inv.gstTotal || 0).toFixed(2)}</td><td style="text-align:right; font-weight:700;">₹${(inv.total || 0).toFixed(2)}</td></tr>`;
    });
    if (APP_STATE.sales.length) {
      tbody.innerHTML += `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL</td><td style="text-align:right;">₹${dayTaxable.toFixed(2)}</td><td style="text-align:right;">₹${dayGst.toFixed(2)}</td><td style="text-align:right;">₹${dayTotal.toFixed(2)}</td></tr>`;
    }
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

function filterReportsCategory(cat, btn) {
  $qa('.rep-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const cards = $qa('.report-section-card');
  cards.forEach(c => {
    const cardCats = c.getAttribute('data-cat') || '';
    c.style.display = (cat === 'All' || cardCats.includes(cat)) ? 'flex' : 'none';
  });
}

function renderDashboard() {
  const sales = APP_STATE.sales || [];

  // "Pending" = Khata (credit) sale not yet settled. "Confirmed"/"Delivered"
  // both map to Cash/UPI/Card sales that were paid at counter — this app has
  // no separate fulfillment step, so both buckets share the same paid-sales
  // set (kept as two labels because the dashboard UI already has both slots
  // and a shop owner scanning fast benefits from seeing the same number
  // twice more than from a misleading zero).
  const pending = sales.filter(s => s.tender === 'Khata');
  const paid = sales.filter(s => s.tender !== 'Khata');
  const totalRev = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const pendingVal = pending.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidVal = paid.reduce((sum, s) => sum + (s.total || 0), 0);
  const dueVal = (APP_STATE.customers || []).reduce((sum, c) => sum + (c.dues || 0), 0);
  const dueCount = (APP_STATE.customers || []).filter(c => (c.dues || 0) > 0).length;

  setTxt('dashTotalOrders', sales.length);
  setTxt('dashTotalSalesVal', `₹${totalRev.toLocaleString('en-IN')}`);
  renderKpiDeltas(sales);
  setTxt('dashPendingOrders', pending.length);
  setTxt('dashPendingSalesVal', `₹${pendingVal.toLocaleString('en-IN')}`);
  setTxt('dashConfirmedOrders', paid.length);
  setTxt('dashConfirmedSalesVal', `₹${paidVal.toLocaleString('en-IN')}`);
  setTxt('dashShippedOrders', paid.length);
  setTxt('dashShippedSalesVal', `₹${paidVal.toLocaleString('en-IN')}`);
  setTxt('dashDueCount', dueCount);
  setTxt('dashDueSalesVal', `₹${dueVal.toLocaleString('en-IN')}`);

  // Donut legend — real percentages instead of frozen "0 (0%)"
  const total = sales.length || 1;
  const pct = n => `${n} (${Math.round((n / total) * 100)}%)`;
  setTxt('dLegPending', pct(pending.length));
  setTxt('dLegConfirmed', pct(paid.length));
  setTxt('dLegShipped', pct(paid.length));
  setTxt('dLegCancelled', pct(dueCount));
  renderDonutChart(pending.length, paid.length, dueCount);
  renderTrendChart();
  renderAlertCentre();
  renderActivityFeed();
  renderMobileInvoiceCards();

  // Recent Invoices table
  const recentBody = $id('dashRecentOrdersBody');
  if (recentBody) {
    recentBody.innerHTML = '';
    if (!sales.length) {
      recentBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No invoices yet — make your first sale from the POS tab.</td></tr>`;
    }
    [...sales].reverse().slice(0, 8).forEach(s => {
      // Overdue is distinguished from merely-unpaid: a 90-day-old khata bill
      // and yesterday's are both "DUE", but only one needs chasing today.
      let cls = 'paid', label = 'PAID';
      if (s.tender === 'Khata') {
        const ageDays = Math.floor((Date.now() - new Date(s.timestamp).getTime()) / 86400000);
        cls = ageDays > 30 ? 'overdue' : 'pending';
        label = ageDays > 30 ? `${ageDays}D OVERDUE` : 'DUE';
      }
      recentBody.innerHTML += `<tr class="clickable-row" onclick="openInvoiceActionPopup('${esc(s.invoiceNo)}')"><td><strong>${esc(s.invoiceNo)}</strong></td><td>${esc(s.customer?.name || 'Cash Customer')}</td><td>${s.date}</td><td><span class="pill ${cls}">${label}</span></td><td style="text-align:right; font-weight:700;">₹${(s.total || 0).toFixed(2)}</td></tr>`;
    });
  }

  // Top Parties by lifetime value
  const topList = $id('topCustomersList');
  if (topList) {
    const ranked = [...(APP_STATE.customers || [])].sort((a, b) => (b.totalOrdersVal || 0) - (a.totalOrdersVal || 0)).slice(0, 5);
    topList.innerHTML = ranked.length
      ? ranked.map(c => `<div class="legend-row" style="padding:6px 0;"><div><strong>${esc(c.name)}</strong><br><small style="color:var(--text-muted);">${esc(c.phone)}</small></div><strong>₹${(c.totalOrdersVal || 0).toLocaleString('en-IN')}</strong></div>`).join('')
      : `<p style="color:var(--text-muted); font-size:0.85rem;">No customer purchase history yet.</p>`;
  }
}

function renderActivityFeed() {
  const feed = $id('activityFeed');
  if (!feed) return;

  const sales = [...(APP_STATE.sales || [])].sort((a, b) => {
    const ta = new Date(a.timestamp || a.date || Date.now()).getTime();
    const tb = new Date(b.timestamp || b.date || Date.now()).getTime();
    return tb - ta;
  });
  const lowStock = getLowStockItems ? getLowStockItems() : [];

  const items = [];
  sales.slice(0, 6).forEach(s => {
    items.push({
      icon: '✅',
      text: `${esc(s.invoiceNo || 'Sale')} · ${esc(s.customer?.name || 'Cash Customer')}`,
      meta: `${s.date || new Date(s.timestamp || Date.now()).toLocaleDateString('en-IN')} · ₹${(s.total || 0).toLocaleString('en-IN')}`,
      kind: 'sale'
    });
  });

  lowStock.slice(0, 3).forEach(item => {
    items.push({
      icon: '⚠️',
      text: `${esc(item.name || 'Item')} is low on stock`,
      meta: `Stock: ${item.stock ?? 0} · reorder ${item.reorderLevel ?? 'n/a'}`,
      kind: 'alert'
    });
  });

  if (!items.length) {
    feed.innerHTML = '<div class="activity-empty">No recent activity yet.</div>';
    return;
  }

  feed.innerHTML = items.slice(0, 8).map(entry => `
    <div class="activity-item">
      <span class="activity-icon">${entry.icon}</span>
      <div class="activity-copy">
        <strong>${entry.text}</strong>
        <small>${entry.meta}</small>
      </div>
    </div>
  `).join('');
}

function renderMobileInvoiceCards() {
  const host = $id('dashRecentOrdersMobile');
  if (!host) return;

  const sales = [...(APP_STATE.sales || [])].reverse().slice(0, 5);
  if (!sales.length) {
    host.innerHTML = '<div class="invoice-card empty">No invoices yet.</div>';
    return;
  }

  host.innerHTML = sales.map(s => {
    const customer = s.customer?.name || 'Cash Customer';
    const status = s.tender === 'Khata' ? 'Due' : 'Paid';
    const klass = s.tender === 'Khata' ? 'status due' : 'status paid';
    return `
      <div class="invoice-card" onclick="openInvoiceActionPopup('${esc(s.invoiceNo)}')">
        <div class="invoice-card-head">
          <strong>${esc(s.invoiceNo || 'INV')}</strong>
          <span class="${klass}">${status}</span>
        </div>
        <div class="invoice-card-body">
          <span>${esc(customer)}</span>
          <span>${esc(s.date || new Date(s.timestamp || Date.now()).toLocaleDateString('en-IN'))}</span>
        </div>
        <div class="invoice-card-foot">
          <span>₹${(s.total || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
    `;
  }).join('');
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

// Minimal dependency-free donut chart — avoids pulling in a charting
// library just to draw four arcs; recomputed on every dashboard render.

/* ==========================================================================
   STOCK MASTER — full table render + edit-in-place
   invTableBody was never populated by any function — this screen has been
   silently dead since the table markup was written. Fixed properly: a real
   render, an edit modal reusing the same fields the New Product modal
   already validates, and every save syncs to Supabase the same way
   commitModalItem's cart-add path does.
   ========================================================================== */
function renderInventoryTable() {
  const tbody = $id('invTableBody');
  if (!tbody) return;

  const { lowStock } = getAlertThresholds();
  const canSeeCost = APP_STATE.isOwner !== false;

  if (!APP_STATE.inventory.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
      No products yet. Use "+ Add Product" or Inward Purchase to add your first item.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...APP_STATE.inventory].sort((a, b) => a.name.localeCompare(b.name)).map(it => {
    const threshold = Number.isFinite(it.lowStockLevel) ? it.lowStockLevel : lowStock;
    const isOut = it.stock <= 0, isLow = !isOut && it.stock <= threshold;
    const stockPill = isOut ? 'overdue' : (isLow ? 'pending' : 'paid');

    const ids = [
      ...(it.serials || []), ...(it.huids || []),
      ...(it.batches || []).map(b => `${b.batch}${b.expiry ? ` (exp ${b.expiry})` : ''}`)
    ];
    const idText = ids.length
      ? (ids.length <= 2 ? ids.map(esc).join(', ') : `${esc(ids[0])} +${ids.length - 1} more`)
      : '<span style="color:var(--text-faint);">untracked</span>';

    return `<tr>
      <td>
        <strong>${esc(it.name)}</strong>
        ${it.meta?.composition ? `<br><small style="color:var(--brand); font-style:italic;">${esc(it.meta.composition)}</small>` : ''}
      </td>
      <td>${esc(it.category)}</td>
      <td><code>${esc(it.barcode || it.hsn || '—')}</code></td>
      <td style="font-size:0.78rem;">${idText}</td>
      <td style="text-align:center;">${it.gst}%</td>
      <td style="text-align:right;">
        ₹${it.price.toFixed(2)}
        ${canSeeCost ? `<br><small style="color:var(--text-muted);">cost ${fmtCost(it.cost)}</small>` : ''}
      </td>
      <td style="text-align:center;"><span class="pill ${stockPill}">${it.stock}</span></td>
      <td style="text-align:center;">
        <button class="btn-pill secondary admin-only" style="padding:5px 11px; font-size:0.74rem;" onclick="openEditStockModal('${it.id}')">Edit</button>
      </td>
    </tr>`;
  }).join('');
}

function openEditStockModal(itemId) {
  const item = APP_STATE.inventory.find(i => i.id === itemId);
  if (!item) return;
  APP_STATE.editingItemId = itemId;

  setVal('editItemName', item.name);
  setVal('editItemCategory', item.category);
  setVal('editItemBarcode', item.barcode || '');
  setVal('editItemHsn', item.hsn || '');
  setVal('editItemGst', String(item.gst));
  setVal('editItemPrice', item.price);
  setVal('editItemCost', item.cost || '');
  setVal('editItemStock', item.stock);
  setVal('editItemLowStockLevel', item.lowStockLevel ?? '');
  setVal('editItemComposition', item.meta?.composition || item.composition || '');

  const costRow = $id('editItemCostRow');
  if (costRow) costRow.style.display = APP_STATE.isOwner === false ? 'none' : 'block';

  $id('editStockModal')?.classList.add('open');
}

function closeEditStockModal() {
  $id('editStockModal')?.classList.remove('open');
  APP_STATE.editingItemId = null;
}

function saveEditedStock() {
  const item = APP_STATE.inventory.find(i => i.id === APP_STATE.editingItemId);
  if (!item) return;

  const name = $id('editItemName')?.value.trim();
  if (!name) { showSaasToast('Product name is required.', 3000, 'err'); return; }

  const newStock = parseInt($id('editItemStock')?.value, 10);
  if (!Number.isFinite(newStock) || newStock < 0) {
    showSaasToast('Stock quantity must be a valid non-negative number.', 3500, 'err');
    return;
  }

  item.name = name;
  item.category = $id('editItemCategory')?.value || item.category;
  item.barcode = $id('editItemBarcode')?.value.trim() || '';
  item.hsn = $id('editItemHsn')?.value.trim() || item.hsn;
  item.gst = parseFloat($id('editItemGst')?.value) || item.gst;
  item.price = parseFloat($id('editItemPrice')?.value) || 0;
  item.stock = newStock;

  const lowLevel = $id('editItemLowStockLevel')?.value;
  item.lowStockLevel = lowLevel !== '' ? parseInt(lowLevel, 10) : undefined;

  if (APP_STATE.isOwner !== false) {
    const cost = parseFloat($id('editItemCost')?.value);
    if (Number.isFinite(cost)) item.cost = cost;
  }

  if (item.category === 'Pharmacy') {
    const composition = $id('editItemComposition')?.value.trim() || '';
    const nextMeta = /** @type {Record<string, any>} */ ({ ...(item.meta || {}) });
    if (composition) nextMeta.composition = composition;
    else delete nextMeta.composition;
    item.meta = /** @type {any} */ (nextMeta);
    item.composition = composition;
  }

  persistState();
  syncItemToCloud(item); // same cloud path every other stock write already uses
  renderInventoryTable();
  renderCatalog();
  renderAlertCentre();
  closeEditStockModal();
  showSaasToast(`${item.name} updated.`, 2500);
}

function deleteInventoryItemPrompt() {
  const item = APP_STATE.inventory.find(i => i.id === APP_STATE.editingItemId);
  if (!item) return;
  if (item.stock > 0) {
    showSaasToast(`Cannot delete "${item.name}" — it still has ${item.stock} unit(s) in stock. Set stock to 0 first.`, 5000, 'err');
    return;
  }
  if (!confirm(`Remove "${item.name}" from your catalogue? This cannot be undone from here.`)) return;

  APP_STATE.inventory = APP_STATE.inventory.filter(i => i.id !== item.id);
  persistState();
  renderInventoryTable();
  renderCatalog();
  closeEditStockModal();
  showSaasToast(`${item.name} removed.`, 2500);

  if (APP_STATE.cloudSession) {
    SB.client.from('items').delete().eq('id', item.id).then(({ error }) => {
      if (error) console.warn('Cloud delete failed:', error.message);
    });
  }
}

/* ==========================================================================
   RECEIVABLES AGEING
   Buckets unpaid Khata invoices by age. Falls back to putting a customer's
   whole balance in 0–30 only when we have no invoice history for them
   (e.g. an opening balance carried in from paper books) — better than
   dropping the amount entirely and under-reporting what's owed.
   ========================================================================== */
function computeReceivablesAgeing(asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  const DAY = 86400000;
  const byPhone = {};

  (APP_STATE.customers || []).forEach(c => {
    if ((c.dues || 0) <= 0) return;
    byPhone[c.phone] = {
      name: c.name, phone: c.phone,
      b30: 0, b60: 0, b90: 0, bOver: 0,
      total: TaxEngine.round2(c.dues), oldestDays: null,
      _allocated: 0
    };
  });

  // Newest-first: partial payments in this app reduce the running balance,
  // so the amount still outstanding is best matched against the most recent
  // credit sales, leaving genuinely old debt visible in the high brackets.
  const credit = (APP_STATE.sales || [])
    .filter(s => s.tender === 'Khata' && s.customer && byPhone[s.customer.phone])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  credit.forEach(s => {
    const row = byPhone[s.customer.phone];
    if (!row) return;
    const remaining = TaxEngine.round2(row.total - row._allocated);
    if (remaining <= 0) return;

    const amount = Math.min(s.total || 0, remaining);
    if (amount <= 0) return;

    const days = Math.max(0, Math.floor((now.getTime() - new Date(s.timestamp).getTime()) / DAY));
    if (days <= 30) row.b30 = TaxEngine.round2(row.b30 + amount);
    else if (days <= 60) row.b60 = TaxEngine.round2(row.b60 + amount);
    else if (days <= 90) row.b90 = TaxEngine.round2(row.b90 + amount);
    else row.bOver = TaxEngine.round2(row.bOver + amount);

    row._allocated = TaxEngine.round2(row._allocated + amount);
    if (row.oldestDays == null || days > row.oldestDays) row.oldestDays = days;
  });

  const rows = Object.values(byPhone);
  rows.forEach(r => {
    const unallocated = TaxEngine.round2(r.total - r._allocated);
    if (unallocated > 0.01) r.b30 = TaxEngine.round2(r.b30 + unallocated);
    delete r._allocated;
  });

  rows.sort((a, b) => (b.bOver - a.bOver) || (b.total - a.total));

  const totals = rows.reduce((t, r) => ({
    b30: TaxEngine.round2(t.b30 + r.b30),
    b60: TaxEngine.round2(t.b60 + r.b60),
    b90: TaxEngine.round2(t.b90 + r.b90),
    bOver: TaxEngine.round2(t.bOver + r.bOver),
    total: TaxEngine.round2(t.total + r.total)
  }), { b30: 0, b60: 0, b90: 0, bOver: 0, total: 0 });

  return { rows, totals };
}

/* ==========================================================================
   KPI TREND BADGES
   Compares the last 30 days against the 30 before it. A bare total tells an
   owner nothing about direction — "₹2.4L" is good or bad only relative to
   last month. Renders nothing when there's no prior period to compare
   against, rather than showing a fake +100%.
   ========================================================================== */
function renderKpiDeltas(sales) {
  const DAY = 86400000, now = Date.now();
  const inWindow = (s, from, to) => {
    const t = new Date(s.timestamp).getTime();
    return t >= now - from * DAY && t < now - to * DAY;
  };

  const curr = sales.filter(s => inWindow(s, 30, 0));
  const prev = sales.filter(s => inWindow(s, 60, 30));

  const sum = arr => arr.reduce((a, s) => a + (s.total || 0), 0);
  const paint = (elId, currVal, prevVal) => {
    const el = $id(elId);
    if (!el) return;
    if (!prevVal) { el.style.display = 'none'; return; }
    const pct = ((currVal - prevVal) / prevVal) * 100;
    const dir = pct > 0.5 ? 'up' : (pct < -0.5 ? 'down' : 'flat');
    el.style.display = 'inline-flex';
    el.className = `kpi-delta ${dir}`;
    el.innerText = `${dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→'} ${Math.abs(pct).toFixed(1)}%`;
  };

  paint('deltaRevenue', sum(curr), sum(prev));
  paint('deltaOrders', curr.length, prev.length);
}

function renderDonutChart(pending, confirmed, due) {
  const svg = $id('donutSvg');
  if (!svg) return;
  const total = pending + confirmed + due;
  if (total === 0) { svg.innerHTML = `<circle cx="70" cy="70" r="55" fill="none" stroke="#e5e7eb" stroke-width="18"/>`; return; }

  const segments = [
    { value: pending, color: '#f59e0b' },
    { value: confirmed, color: '#10b981' },
    { value: due, color: '#ef4444' },
  ];
  const r = 55, cx = 70, cy = 70, circumference = 2 * Math.PI * r;
  let offset = 0;
  svg.innerHTML = segments.map(seg => {
    const frac = seg.value / total;
    const dash = frac * circumference;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="18" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return circle;
  }).join('');
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
   ORDERS & SALES TREND CHART
   Hand-rolled SVG (no charting library) — buckets real invoices by day and
   draws revenue as an area+line with an order-count bar underlay.
   ========================================================================== */
function renderTrendChart(rangeDays) {
  const container = $id('splineChartContainer');
  if (!container) return;

  const days = rangeDays || APP_STATE.trendRangeDays || 30;
  const buckets = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: 0,
      orders: 0
    });
  }
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));

  (APP_STATE.sales || []).forEach(s => {
    // timestamp is ISO from cloud/local; fall back to parsing display date.
    let key = null;
    if (s.timestamp) key = new Date(s.timestamp).toISOString().slice(0, 10);
    if (key && byKey[key]) {
      byKey[key].revenue += (s.total || 0);
      byKey[key].orders += 1;
    }
  });

  const maxRev = Math.max(...buckets.map(b => b.revenue), 1);
  const maxOrders = Math.max(...buckets.map(b => b.orders), 1);

  const W = 640, H = 220, padL = 46, padR = 12, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = i => padL + (buckets.length === 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW);
  const y = v => padT + plotH - (v / maxRev) * plotH;

  const linePts = buckets.map((b, i) => `${x(i).toFixed(1)},${y(b.revenue).toFixed(1)}`).join(' ');
  const areaPts = `${padL},${padT + plotH} ${linePts} ${(padL + plotW).toFixed(1)},${padT + plotH}`;

  const barW = Math.max(2, (plotW / buckets.length) * 0.45);
  const bars = buckets.map((b, i) => {
    const bh = (b.orders / maxOrders) * (plotH * 0.35);
    return `<rect x="${(x(i) - barW / 2).toFixed(1)}" y="${(padT + plotH - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="#9333ea" opacity="0.18" rx="1"/>`;
  }).join('');

  // Y gridlines at 0/50/100% of max revenue
  const grid = [0, 0.5, 1].map(f => {
    const gy = padT + plotH - f * plotH;
    const val = Math.round(maxRev * f);
    return `<line x1="${padL}" y1="${gy}" x2="${padL + plotW}" y2="${gy}" stroke="#e5e7eb" stroke-width="1"/>
            <text x="${padL - 6}" y="${gy + 3}" text-anchor="end" font-size="9" fill="#8fa59c">₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}</text>`;
  }).join('');

  // Show ~6 x-axis labels regardless of range, so 30-day view stays readable
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const xLabels = buckets.map((b, i) =>
    i % labelEvery === 0
      ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#8fa59c">${b.label}</text>`
      : ''
  ).join('');

  const dots = buckets.map((b, i) =>
    b.orders > 0
      ? `<circle cx="${x(i).toFixed(1)}" cy="${y(b.revenue).toFixed(1)}" r="3" fill="#10b981"><title>${b.label}: ₹${b.revenue.toFixed(2)} · ${b.orders} order(s)</title></circle>`
      : ''
  ).join('');

  const totalRev = buckets.reduce((s, b) => s + b.revenue, 0);
  const totalOrd = buckets.reduce((s, b) => s + b.orders, 0);

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${grid}
      ${bars}
      <polygon points="${areaPts}" fill="url(#trendFill)"/>
      <polyline points="${linePts}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>
    <div style="display:flex; gap:16px; justify-content:center; font-size:0.72rem; color:var(--text-muted); margin-top:4px;">
      <span><span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;"></span> Revenue ₹${totalRev.toLocaleString('en-IN')}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#9333ea;opacity:0.4;border-radius:2px;"></span> ${totalOrd} orders</span>
    </div>`;
}

function setTrendRange(days, el) {
  const value = parseInt(days, 10) || 30;
  APP_STATE.trendRangeDays = value;
  $qa('.time-pill').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.range) === value));
  if (el && el instanceof HTMLElement) el.classList.add('active');
  renderTrendChart(value);
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

function exportCurrentReportCSV() {
  // Reads whatever is currently rendered in the drill-down table and
  // exports exactly what the user sees, so the export always matches
  // the on-screen report (including its current filter/customer selection).
  const theadRow = $q('#drillTableHead tr');
  const bodyRows = $qa('#drillTableBody tr');
  if (!theadRow || !bodyRows.length) {
    alert("No data to export in this report.");
    return;
  }

  const headers = Array.from(theadRow.children).map(th => th.innerText.trim());
  const rows = [headers];
  bodyRows.forEach(tr => {
    const cells = Array.from(tr.children).map(td => td.innerText.trim());
    if (cells.length) rows.push(cells);
  });

  downloadCSV(`${APP_STATE.currentReportKey || 'report'}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function printReportDocument() { window.print(); }

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
