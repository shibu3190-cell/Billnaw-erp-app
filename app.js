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
    defaultGstRate: 18,
    defaultHsn: ''
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
const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = (val !== undefined && val !== null) ? val : ''; };
const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val !== undefined && val !== null) ? val : ''; };
const setDisplay = (id, s) => { const el = document.getElementById(id); if (el) el.style.display = s; };

function persistState() {
  try {
    localStorage.setItem('bn_tenant', JSON.stringify(APP_STATE.tenantProfile));
    localStorage.setItem('bn_inv', JSON.stringify(APP_STATE.inventory));
    localStorage.setItem('bn_cust', JSON.stringify(APP_STATE.customers));
    localStorage.setItem('bn_sales', JSON.stringify(APP_STATE.sales));
    localStorage.setItem('bn_seq', APP_STATE.invCounter.toString());
    localStorage.setItem('bn_returns', JSON.stringify(APP_STATE.returns || []));
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
} catch (e) {}

/* ==========================================================================
   NETWORK EVENT LISTENERS & STATUS
   ========================================================================== */
function updateNetworkStatus() {
  const badge = document.getElementById('networkStatusBadge');
  const txt = document.getElementById('networkStatusText');
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
  const initial = (shop.trim()[0] || 'B').toUpperCase();
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
  const toast = document.getElementById('authToast');
  if (!toast) return;
  toast.innerHTML = `<span class="toast-ico">${tone === 'err' ? '!' : '\u2713'}</span><span>${message}</span>`;
  toast.className = `saas-toast ${tone === 'err' ? 'err' : 'ok'}`;
  clearTimeout(showSaasToast.timeoutId);
  showSaasToast.timeoutId = setTimeout(() => toast.classList.add('hidden'), duration);
}

// Strips spaces, dashes and stray plus signs. Indian numbers get pasted in
// a dozen formats ("+91 86175 89620", "086175-89620"); Supabase needs E.164.
function normalizePhoneNumber(rawValue) {
  return String(rawValue || '').trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

// Blurring + disabling the shell behind the overlay stops a half-loaded
// dashboard being clickable through the auth screen.
function applyAuthLockState(isLocked) {
  const overlay = document.getElementById('authOverlay');
  const appShell = document.querySelector('.app-shell');
  if (appShell) {
    appShell.style.pointerEvents = isLocked ? 'none' : 'auto';
    appShell.style.filter = isLocked ? 'blur(3px)' : 'none';
    appShell.style.opacity = isLocked ? '0.5' : '1';
  }
  if (overlay) overlay.classList.toggle('hidden', !isLocked);
}

function togglePasswordVisibility(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  if (btn) btn.innerText = show ? '🙈' : '👁';
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
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.style.display = isOwner ? '' : 'none';
  });
  document.querySelectorAll('.cost-sensitive').forEach((el) => {
    el.style.display = isOwner ? '' : 'none';
  });
  
  const badge = document.getElementById('roleBadge');
  if (badge) {
    badge.innerText = isOwner ? '👑 Owner' : '🛒 Staff';
    badge.style.background = isOwner ? 'var(--forest-panel)' : '#eef5f1';
    badge.style.color = isOwner ? 'var(--accent-gold)' : 'var(--forest-dark)';
  }
}

/* ==========================================================================
   OFFLINE-FIRST SYNC ENGINE
   ========================================================================== */
const SyncEngine = {
  queueKey: 'bn_offline_sync_queue',

  generateIdempotencyKey() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  },

  enqueue(invoice) {
    const q = JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    q.push(invoice);
    localStorage.setItem(this.queueKey, JSON.stringify(q));
  },

  async flushSyncQueue() {
    if (!navigator.onLine || !APP_STATE.cloudSession) return;
    const q = JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    if (!q.length) return;

    const shopId = APP_STATE.tenantProfile.shopId;
    const remaining = [];

    for (const invoice of q) {
      // idempotency_key has a unique constraint in the DB — a retried sync
      // of an already-saved invoice fails harmlessly with a duplicate-key
      // error rather than double-booking the sale.
      const { error } = await SB.saveSale(shopId, invoice);
      if (error && !error.includes('duplicate key')) {
        remaining.push(invoice); // keep it queued, try again next time
        console.warn('Sync retry pending for', invoice.invoiceNo, error);
      }
    }

    localStorage.setItem(this.queueKey, JSON.stringify(remaining));
    if (remaining.length === 0) {
      console.log('✅ Cloud sync complete — all queued invoices saved.');
    }
  }
};

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
  const overlay = document.getElementById('authOverlay');
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
  const el = document.getElementById(containerId);
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
  document.getElementById('segPhoneBtn')?.classList.toggle('active', isPhone);
  document.getElementById('segEmailBtn')?.classList.toggle('active', !isPhone);
  setTxt('authFormSub', isPhone
    ? "Enter your phone number and we'll send you an OTP — no password needed."
    : "Enter your email address and we'll send you an OTP — no password needed.");
}

function buildCountryList() {
  const list = document.getElementById('ccList');
  if (!list) return;
  list.innerHTML = COUNTRY_CODES.map(c =>
    `<button type="button" class="cc-item" onclick="pickCountry('${c.dial}','${c.flag}')">${c.flag} ${c.name} <span>${c.dial}</span></button>`
  ).join('');
}

function toggleCountryList() {
  const list = document.getElementById('ccList');
  if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
}

function pickCountry(dial, flag) {
  AuthFlow.dialCode = dial;
  setTxt('ccDial', dial);
  setTxt('ccFlag', flag);
  setDisplay('ccList', 'none');
}

function onPhoneInput() {
  const el = document.getElementById('loginPhone');
  if (el) el.value = el.value.replace(/\D/g, '').slice(0, 12);
  setTxt('phoneError', '');
}

/* ---------- request OTP ---------- */
async function requestOtp(channel) {
  if (AuthFlow.busy) return;
  AuthFlow.channel = channel;

  let target, errEl, btnId;
  if (channel === 'phone') {
    const digits = normalizePhoneNumber(document.getElementById('loginPhone')?.value).replace(/\D/g, '');
    errEl = 'phoneError'; btnId = 'phoneOtpBtn';
    if (digits.length < 6) { setTxt(errEl, 'Enter a valid mobile number.'); return; }
    target = AuthFlow.dialCode + digits;
  } else {
    const email = (document.getElementById('loginEmail')?.value || '').trim();
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
  document.getElementById('otp-0')?.focus();
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
  for (let i = 0; i < 6; i++) c += (document.getElementById(`otp-${i}`)?.value || '').trim();
  return c;
}

function onOtpInput(idx) {
  const box = document.getElementById(`otp-${idx}`);
  if (!box) return;
  box.value = box.value.replace(/\D/g, '').slice(0, 1);
  if (box.value && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  if (readOtpCode().length === 6) verifyOtpCode();
}

function onOtpKeydown(e, idx) {
  if (e.key === 'Backspace' && !e.target.value && idx > 0) {
    document.getElementById(`otp-${idx - 1}`)?.focus();
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
    document.getElementById('otp-0')?.focus();
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
  const shopName = document.getElementById('regShopName')?.value.trim() || '';
  const ownerName = document.getElementById('regOwnerName')?.value.trim() || '';
  const phoneDigits = (document.getElementById('regPhone')?.value || '').replace(/\D/g, '');
  const email = document.getElementById('regEmail')?.value.trim() || '';

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
  const sel = document.getElementById('regState');
  if (sel && GST_STATE_CODES[code]) {
    sel.value = code;
    setTxt('regStateHint', `Detected: ${GST_STATE_CODES[code]} — this becomes your home state for CGST/SGST vs IGST.`);
  } else {
    setTxt('regStateHint', '');
  }
}

function pickIndustry(ind, el) {
  AuthFlow.selectedIndustry = ind;
  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

async function finishOnboarding() {
  const address = document.getElementById('regAddress')?.value.trim() || '';
  const gstin = document.getElementById('regGstin')?.value.trim() || '';
  const stateCode = document.getElementById('regState')?.value || '';
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
  p.isRegistered = true;
  persistState();
  syncProfileToDOM();
}

async function hydrateCloudData(shopId) {
  const [itemsRes, custRes, salesRes] = await Promise.all([
    SB.fetchItems(shopId), SB.fetchCustomers(shopId), SB.fetchSales(shopId)
  ]);

  if (itemsRes.data && itemsRes.data.length) {
    APP_STATE.inventory = itemsRes.data.map(i => ({
      id: i.id, name: i.name, category: i.category, barcode: i.barcode,
      hsn: i.hsn, price: Number(i.price), cost: Number(i.cost), gst: Number(i.gst),
      stock: i.stock, serials: i.serials || [], huids: i.huids || [],
      batches: i.batches || [], meta: i.meta || {}
    }));
  }

  if (custRes.data) {
    APP_STATE.customers = custRes.data.map(c => ({
      phone: c.phone, name: c.name, gstin: c.gstin, address: c.address || '',
      stateCode: c.state_code || '', category: c.category,
      dues: Number(c.dues), totalOrdersVal: Number(c.total_orders_val), orderHistory: []
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
    if (maxSeen + 1 > APP_STATE.invCounter) {
      APP_STATE.invCounter = maxSeen + 1;
      localStorage.setItem('bn_seq', APP_STATE.invCounter.toString());
    localStorage.setItem('bn_returns', JSON.stringify(APP_STATE.returns || []));
    }
  }
}

function setAuthBusy(btnId, busy, label) {
  AuthFlow.busy = busy;
  const btn = document.getElementById(btnId);
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
   TENANT INDUSTRY LOCK
   ========================================================================== */
function applyIndustryLock() {
  const profile = APP_STATE.tenantProfile;
  const chipContainer = document.getElementById('sectorChipsBar');

  if (!profile.isLocked || profile.assignedIndustry === 'All') {
    if (chipContainer) chipContainer.style.display = 'flex';
    setTxt('sideSectorLabel', 'Universal ERP');
    APP_STATE.activeSector = 'All';
    return;
  }

  APP_STATE.activeSector = profile.assignedIndustry;
  if (chipContainer) chipContainer.style.display = 'none';
  setTxt('sideSectorLabel', `${profile.assignedIndustry} POS (LOCKED)`);
}

function syncProfileToDOM() {
  const p = APP_STATE.tenantProfile;
  setTxt('sideStoreName', p.shopName);
  setVal('cfgName', p.shopName);
  setVal('cfgGst', p.gstin);
  setVal('cfgPhone', p.phone);
  setVal('cfgAddress', p.address);
  setVal('cfgUpiId', p.upiId);
  setVal('cfgTerms', p.terms);
  setVal('cfgBankName', p.bankName);
  setVal('cfgBankAcc', p.bankAcc);

  setTxt('pStoreName', p.shopName);
  setTxt('pStoreAddr', p.address);
  setTxt('pGstin', p.gstin || 'Unregistered');
  setTxt('pStorePhone', p.phone);
  setTxt('pBankDisplay', `${p.bankName} • A/C: ${p.bankAcc} • IFSC: ${p.bankIfsc}`);
  setTxt('pUpiDisplay', p.upiId);
  setTxt('pTermsDisplay', p.terms);
}

function saveAllSettings() {
  const p = APP_STATE.tenantProfile;
  p.shopName = document.getElementById('cfgName')?.value.trim() || p.shopName;
  p.gstin = document.getElementById('cfgGst')?.value.trim() || '';
  p.phone = document.getElementById('cfgPhone')?.value.trim() || '';
  p.address = document.getElementById('cfgAddress')?.value.trim() || '';
  p.upiId = document.getElementById('cfgUpiId')?.value.trim() || '';
  p.terms = document.getElementById('cfgTerms')?.value.trim() || '';
  p.bankName = document.getElementById('cfgBankName')?.value.trim() || '';
  p.bankAcc = document.getElementById('cfgBankAcc')?.value.trim() || '';
  // NOTE: industry vertical is deliberately NOT touched here — it's locked
  // at onboarding and shown read-only in Settings → Industry Vertical.
  // This function used to read a #cfgIndustrySelect field that no longer
  // exists in the DOM; reading it would have silently reset assignedIndustry
  // to 'All' and isLocked to false on every save from any panel.

  persistState();
  syncProfileToDOM();
  applyIndustryLock();
  renderCatalog();
  showSaasToast('Settings saved.', 2500);

  if (APP_STATE.cloudSession && p.shopId) {
    SB.updateShopSettings(p.shopId, {
      name: p.shopName, gstin: p.gstin, phone: p.phone, address: p.address,
      upi_id: p.upiId, terms: p.terms, bank_name: p.bankName, bank_acc: p.bankAcc
    });
  }
}

/* ==========================================================================
   SETTINGS — card list home + slide-over panels
   ========================================================================== */
function openSettingsHome() {
  switchView('settings');
  closeSettingsPanel();
}

function openSettingsPanel(key) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('open'));
  const panel = document.getElementById(`panel-${key}`);
  const backdrop = document.getElementById('settingsPanelBackdrop');
  if (!panel) return;
  panel.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  document.body.classList.add('settings-panel-active');

  if (key === 'hardware') updateLivePreview();
  if (key === 'gst') loadComplianceSettingsIntoDOM();
  if (key === 'industry') loadIndustrySettingsIntoDOM();
  if (key === 'staff') loadStaffPanel();
}

function closeSettingsPanel() {
  document.querySelectorAll('.settings-panel.open').forEach(p => p.classList.remove('open'));
  const backdrop = document.getElementById('settingsPanelBackdrop');
  if (backdrop) backdrop.classList.remove('open');
  document.body.classList.remove('settings-panel-active');
}

// Escape closes whichever panel is open — same "go back" gesture as
// clicking outside, for keyboard/desktop users.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('settings-panel-active')) {
    closeSettingsPanel();
  }
});

function toggleAccordion(accId) {
  const item = document.getElementById(accId);
  if (item) item.classList.toggle('open');
}

function updateLivePreview() {
  const p = APP_STATE.tenantProfile;
  setTxt('pvShopName', document.getElementById('cfgName')?.value || p.shopName);
  setTxt('pvAddress', document.getElementById('cfgAddress')?.value || p.address);
  setTxt('pvGst', document.getElementById('cfgGst')?.value || p.gstin);
  setTxt('pvPhone', document.getElementById('cfgPhone')?.value || p.phone);
  const bank = document.getElementById('cfgBankName')?.value || p.bankName || '';
  const acc = document.getElementById('cfgBankAcc')?.value || p.bankAcc || '';
  const upi = document.getElementById('cfgUpiId')?.value || p.upiId || '';
  setTxt('pvBankInfo', bank ? `${bank} • A/C: ${acc}` : 'Add bank details above');
  setTxt('pvUpiInfo', upi ? `UPI: ${upi}` : 'Add a UPI ID to enable scan-to-pay');
}

/* ---------- GST & Compliance panel ---------- */
function loadComplianceSettingsIntoDOM() {
  const p = APP_STATE.tenantProfile;
  GstConfig.refreshAllRateSelects();
  setVal('cfgDefaultGst', p.defaultGstRate != null ? String(p.defaultGstRate) : '18');
  setVal('cfgDefaultHsn', p.defaultHsn || '');
  const hsnChk = document.getElementById('cfgMandatoryHsn');
  if (hsnChk) hsnChk.checked = !!p.mandatoryHsn;
  const roundChk = document.getElementById('cfgShowRoundOff');
  if (roundChk) roundChk.checked = p.showRoundOff !== false;
}

function saveComplianceSettings() {
  const p = APP_STATE.tenantProfile;
  p.defaultGstRate = parseFloat(document.getElementById('cfgDefaultGst')?.value) || 18;
  p.defaultHsn = document.getElementById('cfgDefaultHsn')?.value.trim() || '';
  p.mandatoryHsn = !!document.getElementById('cfgMandatoryHsn')?.checked;
  p.showRoundOff = !!document.getElementById('cfgShowRoundOff')?.checked;
  persistState();
}

/* ---------- Industry Vertical panel ---------- */
// Which item categories this app already tracks identifiers for, per
// vertical — matches the fields commitModalItem already collects, so this
// toggle enforces something that's genuinely wired up, not decorative.
const INDUSTRY_TRACK_MAP = {
  Electronics: { field: 'assignedIdentifier', noun: 'IMEI/Serial', categories: ['Electronics'] },
  Jewelry:     { field: 'assignedIdentifier', noun: 'HUID',        categories: ['Jewelry'] },
  Pharmacy:    { field: 'assignedIdentifier', noun: 'Batch No.',   categories: ['Pharmacy'] },
};

function loadIndustrySettingsIntoDOM() {
  const p = APP_STATE.tenantProfile;
  const ind = p.assignedIndustry || 'All';
  const rule = INDUSTRY_TRACK_MAP[ind];

  setTxt('industryLockName', ind === 'All' ? 'Universal Mode' : `${ind} Vertical`);
  const pill = document.getElementById('industryLockPill');
  const desc = document.getElementById('industryLockDesc');
  const toggleBlock = document.getElementById('industryToggleBlock');

  if (p.isLocked && ind !== 'All') {
    if (pill) pill.style.display = 'inline-flex';
    if (desc) setTxt('industryLockDesc', `This shop is locked to ${ind}. All bills use ${ind}-specific fields. Contact support to change vertical.`);
  } else {
    if (pill) pill.style.display = 'none';
    if (desc) setTxt('industryLockDesc', 'This shop is not locked to a specific vertical — all categories are available.');
  }

  if (rule) {
    if (toggleBlock) toggleBlock.style.display = 'block';
    setTxt('requireIdLabel', `Block checkout if a ${ind} item has no ${rule.noun} assigned`);
    const chk = document.getElementById('cfgRequireIdentifier');
    if (chk) chk.checked = !!p.requireIdentifier;
  } else if (toggleBlock) {
    toggleBlock.style.display = 'none'; // Universal/Grocery: nothing to enforce here
  }
}

function saveIndustrySettings() {
  APP_STATE.tenantProfile.requireIdentifier = !!document.getElementById('cfgRequireIdentifier')?.checked;
  persistState();
}

/* ---------- Staff & Roles panel ---------- */
async function loadStaffPanel() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Loading…</td></tr>`;

  if (!APP_STATE.cloudSession || !APP_STATE.tenantProfile.shopId) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Sign in to view staff.</td></tr>`;
    return;
  }

  const { data, error } = await SB.fetchShopStaff(APP_STATE.tenantProfile.shopId);
  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--danger);">${error}</td></tr>`;
    return;
  }

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Just you, for now.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(m => {
    const roleLabel = m.role === 'owner' ? 'Owner' : (m.role === 'cashier' ? 'Cashier' : m.role);
    const canSeeCost = m.role !== 'cashier';
    return `<tr>
      <td><strong>${m.full_name || 'Unnamed'}</strong></td>
      <td><span class="pill ${m.role === 'owner' ? 'info' : 'draft'}">${roleLabel}</span></td>
      <td>${canSeeCost ? '<span class="pill paid">Visible</span>' : '<span class="pill overdue">Hidden</span>'}</td>
    </tr>`;
  }).join('');
}

/* ==========================================================================
   CAMERA BARCODE & QR SCANNER ENGINE
   ========================================================================== */
let scannerStream = null;
let scannerInterval = null;

async function openCameraScanner() {
  const modal = document.getElementById('cameraScannerModal');
  const video = document.getElementById('scannerVideo');
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
      const input = document.getElementById('scannerManualCode');
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
  const input = document.getElementById('scannerManualCode');
  const code = (input?.value || '').trim();
  if (!code) return;
  handleScannedCode(code);
  if (input) input.value = '';
  if (!APP_STATE.scanContinuous) closeCameraScanner();
}

function closeCameraScanner() {
  const modal = document.getElementById('cameraScannerModal');
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
      const sel = document.getElementById('mSerialSelect');
      if (sel) sel.value = c;
    }, 100);
  } else {
    alert(`Scanned code "${c}" not found in stock master.`);
  }
}

/* ==========================================================================
   CUSTOMER 360° & AUTO-FILL PROFILE
   ========================================================================== */
function autoFillCustomer(query) {
  setStep(3);
  const q = query.trim().toLowerCase();
  if (q.length < 2) return;

  const match = APP_STATE.customers.find(c => c.phone.includes(q) || c.name.toLowerCase().includes(q));
  if (match) {
    setVal('custName', match.name);
    setVal('custGstin', match.gstin || '');
    setVal('custAddress', match.address || '');
    setVal('custState', match.stateCode || '');
    updateTaxTypeHint();
  }
}

function renderCustomer360Profile(custPhone) {
  const cust = APP_STATE.customers.find(c => c.phone === custPhone) || APP_STATE.customers[0];
  if (!cust) return;

  APP_STATE.c360Phone = cust.phone;

  setTxt('c360Name', cust.name);
  setTxt('c360Contact', `${cust.phone} · ${cust.gstin || 'Unregistered / B2C'}${cust.address ? ' · ' + cust.address : ''}`);
  setTxt('c360Ltv', `₹${(cust.totalOrdersVal || 0).toLocaleString('en-IN')}`);
  setTxt('c360Due', `₹${(cust.dues || 0).toLocaleString('en-IN')}`);

  const thead = document.getElementById('drillTableHead');
  const tbody = document.getElementById('drillTableBody');
  if (!thead || !tbody) return;

  // Derived from the actual sales ledger, not from a per-customer
  // orderHistory array. That array is only ever appended to on the device
  // that made the sale and is never rehydrated from Supabase — so on a
  // second device (or after a cache clear) every customer wrongly showed
  // "no prior sales". Deriving from APP_STATE.sales makes this correct
  // everywhere, and automatically reflects returns too.
  const history = (APP_STATE.sales || [])
    .filter(s => s.customer?.phone === cust.phone)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const returnsFor = inv => (APP_STATE.returns || []).filter(r => r.invoiceNo === inv);

  thead.innerHTML = `<tr>
      <th>Invoice #</th><th>Date</th>
      <th>Products / Identifiers</th>
      <th>Mode</th><th>Status</th>
      <th style="text-align:right;">Amount</th>
      <th style="text-align:center;">Action</th>
    </tr>`;

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:24px;">No purchases recorded for this party yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(s => {
    const itemText = (s.items || []).map(i =>
      `${i.name} ×${i.qty}${i.assignedIdentifier ? ` <code style="font-size:0.72rem; color:var(--text-muted);">${i.assignedIdentifier}</code>` : ''}`
    ).join('<br>');

    const rets = returnsFor(s.invoiceNo);
    let pill = 'paid', label = 'PAID';
    if (s.status === 'returned') { pill = 'overdue'; label = 'RETURNED'; }
    else if (s.status === 'partially_returned') { pill = 'pending'; label = 'PART. RETURNED'; }
    else if (s.tender === 'Khata') { pill = 'pending'; label = 'DUE'; }

    const canReturn = s.status !== 'returned';
    return `<tr>
      <td><strong>${s.invoiceNo}</strong>${rets.length ? `<br><small style="color:var(--text-muted);">${rets.map(r => r.creditNoteNo).join(', ')}</small>` : ''}</td>
      <td>${s.date}</td>
      <td style="font-size:0.82rem;">${itemText || '—'}</td>
      <td>${s.tender}</td>
      <td><span class="pill ${pill}">${label}</span></td>
      <td style="text-align:right; font-weight:800;">₹${(s.total || 0).toFixed(2)}${
        s.returnedValue ? `<br><small style="color:var(--danger); font-weight:600;">−₹${s.returnedValue.toFixed(2)} returned</small>` : ''
      }</td>
      <td style="text-align:center;">
        ${canReturn
          ? `<button class="btn-pill secondary" style="padding:6px 12px; font-size:0.74rem;" onclick="openReturnModal('${s.invoiceNo}')">Return</button>`
          : '<span style="color:var(--text-faint); font-size:0.76rem;">—</span>'}
      </td>
    </tr>`;
  }).join('');
}

/* Exports every purchase line for the selected party — one row per line
   item, not per invoice, because that's what an accountant or a warranty
   claim actually needs (which serial, on which bill, on which date). */
function exportCustomer360() {
  const cust = APP_STATE.customers.find(c => c.phone === APP_STATE.c360Phone);
  if (!cust) { showSaasToast('Select a customer first.', 3000, 'err'); return; }

  const history = (APP_STATE.sales || [])
    .filter(s => s.customer?.phone === cust.phone)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (!history.length) { showSaasToast('No purchases to export for this party.', 3000, 'err'); return; }

  const headers = ['Invoice', 'Date', 'Status', 'Item', 'HSN', 'Identifier',
                   'Qty', 'Rate', 'Taxable', 'GST %', 'GST Amt', 'Line Total', 'Mode'];
  const rows = [];
  history.forEach(s => {
    (s.items || []).forEach(i => {
      rows.push([
        s.invoiceNo, s.date, (s.status || 'active').toUpperCase(),
        i.name, i.hsn || '', i.assignedIdentifier || '',
        i.qty, i.price, i.taxableValue,
        (i.gstRateAtBilling !== undefined ? i.gstRateAtBilling : i.gst),
        i.gstAmount, i.totalAmount, s.tender
      ]);
    });
  });

  exportToExcel(
    `customer-${cust.phone}-${new Date().toISOString().slice(0, 10)}`,
    `${cust.name} — Purchase History`,
    headers, rows,
    { filter: `${cust.name} · ${cust.phone} · Due ₹${(cust.dues || 0).toFixed(2)}` }
  );
}

/* ==========================================================================
   INWARD PURCHASE & AI OCR (ONLINE RESTRICTED)
   ========================================================================== */
function openInwardPurchaseModal() {
  populateRestockPicker();
  const m = document.getElementById('inwardPurchaseModal');
  if (m) m.classList.add('open');
}
function closeInwardModal() {
  const m = document.getElementById('inwardPurchaseModal');
  if (m) m.classList.remove('open');
}

function toggleInwardMode(mode) {
  const manView = document.getElementById('inwardManualView');
  const aiView = document.getElementById('inwardAiView');
  const btnMan = document.getElementById('btnInwardManual');
  const btnAi = document.getElementById('btnInwardAi');

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
  const sel = document.getElementById('purExistingItem');
  if (!sel) return;
  const items = [...(APP_STATE.inventory || [])].sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = `<option value="">— New product / enter manually below —</option>` +
    items.map(i => `<option value="${i.id}">${i.name} — ${i.stock} in stock · HSN ${i.hsn || '—'}</option>`).join('');
}

function prefillFromExistingItem(itemId) {
  const idField = document.getElementById('purExistingItemId');
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

  const notice = document.getElementById('restockNotice');
  if (notice) {
    notice.style.display = 'block';
    notice.innerHTML = `Restocking <strong>${it.name}</strong> — currently ${it.stock} in stock. New quantity will be added to that, and any serials/batches you enter are appended to the existing pool.`;
  }
}

function saveManualPurchase() {
  const name = document.getElementById('purName')?.value.trim();
  const category = document.getElementById('purCategory')?.value || 'Electronics';
  const barcode = document.getElementById('purBarcode')?.value.trim() || '';
  const hsn = document.getElementById('purHsn')?.value.trim() || '8517';
  const gst = parseInt(document.getElementById('purGst')?.value, 10) || 18;
  const qty = parseInt(document.getElementById('purQty')?.value, 10) || 1;
  const cost = parseFloat(document.getElementById('purCost')?.value) || 0;
  const price = parseFloat(document.getElementById('purPrice')?.value) || (cost > 0 ? cost * 1.25 : 100);
  const rawIds = document.getElementById('purIdentifiers')?.value || '';
  const idArray = rawIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  if (!name || qty <= 0) return alert("Enter a valid Item Name and Quantity!");

  let targetItem;
  // Prefer the explicitly-picked product id; fall back to name match only
  // when the user typed a new product rather than selecting one.
  const pickedId = document.getElementById('purExistingItemId')?.value;
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
      meta: { imei: idArray[0] || '' }
    };
    APP_STATE.inventory.push(targetItem);
    alert(`✅ Created and added new item to stock: ${name}`);
  }

  persistState();
  syncItemToCloud(targetItem);
  closeInwardModal();
  renderCatalog();
}

async function processAiInvoice(event) {
  if (!navigator.onLine) {
    alert("Internet connection lost. Reconnect to process AI invoices.");
    return;
  }
  if (!APP_STATE.cloudSession) {
    alert("AI invoice reading requires you to be signed in to your cloud account.");
    return;
  }
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const dropzone = document.querySelector('.ai-dropzone-box h3');
  const originalLabel = dropzone ? dropzone.innerText : '';
  if (dropzone) dropzone.innerText = '⏳ Reading invoice with AI…';

  const { items, error } = await SB.parseInvoiceImage(file);

  if (dropzone) dropzone.innerText = originalLabel;

  if (error) {
    alert(`AI invoice reading failed: ${error}\nUse Manual Entry instead for this bill.`);
    return;
  }

  // Server returns: {name, hsn, gst_rate, qty, unit_cost, identifier}
  // Map to the shape the staging table/commit functions expect.
  APP_STATE.aiStagingItems = (items || []).map(it => ({
    name: it.name || 'Unknown Item',
    barcode: '',
    hsn: it.hsn || '8517',
    identifier: it.identifier || '-',
    gst: Number(it.gst_rate) || 18,
    qty: Number(it.qty) || 1,
    cost: Number(it.unit_cost) || 0,
  }));

  if (!APP_STATE.aiStagingItems.length) {
    alert("AI could not confidently read any line items from this image. Try a clearer photo, or use Manual Entry.");
    return;
  }

  renderAiStagingTable();
  setDisplay('aiStagingSection', 'block');
}

function renderAiStagingTable() {
  const tbody = document.getElementById('aiStagingBody');
  setTxt('aiStagingCount', APP_STATE.aiStagingItems.length);
  if (!tbody) return;
  tbody.innerHTML = '';

  APP_STATE.aiStagingItems.forEach((it, idx) => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${it.name}</strong></td>
        <td><code>${it.barcode || '-'}</code></td>
        <td><code>${it.identifier}</code></td>
        <td>${it.gst}%</td>
        <td>${it.qty}</td>
        <td>₹${it.cost.toFixed(2)}</td>
        <td>
          <button class="btn-pill primary" style="padding:4px 8px; font-size:0.7rem;" onclick="commitSingleAiItem(${idx})">Merge</button>
        </td>
      </tr>
    `;
  });
}

function commitSingleAiItem(idx) {
  const it = APP_STATE.aiStagingItems[idx];
  if (!it) return;

  let targetItem;
  const existing = APP_STATE.inventory.find(i => i.name.toLowerCase() === it.name.toLowerCase());
  if (existing) {
    existing.stock += it.qty;
    existing.cost = it.cost;
    if (it.identifier && it.identifier !== '-') {
      if (existing.category === 'Electronics') {
        existing.serials = Array.isArray(existing.serials) ? existing.serials : [];
        if (!existing.serials.includes(it.identifier)) existing.serials.push(it.identifier);
      } else if (existing.category === 'Jewelry') {
        existing.huids = Array.isArray(existing.huids) ? existing.huids : [];
        if (!existing.huids.includes(it.identifier)) existing.huids.push(it.identifier);
      }
    }
    targetItem = existing;
  } else {
    targetItem = {
      id: crypto.randomUUID(),
      name: it.name,
      category: it.name.includes('Gold') ? 'Jewelry' : 'Electronics',
      barcode: it.barcode || '',
      hsn: it.hsn,
      gst: it.gst,
      cost: it.cost,
      price: it.cost * 1.2,
      stock: it.qty,
      serials: it.identifier !== '-' && !it.name.includes('Gold') ? [it.identifier] : [],
      huids: it.identifier !== '-' && it.name.includes('Gold') ? [it.identifier] : [],
      batches: [],
      meta: { imei: it.identifier !== '-' ? it.identifier : '' }
    };
    APP_STATE.inventory.push(targetItem);
  }

  APP_STATE.aiStagingItems.splice(idx, 1);
  renderAiStagingTable();
  persistState();
  syncItemToCloud(targetItem);
  renderCatalog();
}

function commitAllAiItems() {
  while (APP_STATE.aiStagingItems.length > 0) {
    commitSingleAiItem(0);
  }
  closeInwardModal();
  alert("🎉 All AI Invoiced items merged into stock!");
}

/* ==========================================================================
   DYNAMIC IDENTIFIER MODAL (ELECTRONICS / PHARMA / JEWELRY)
   ========================================================================== */
function openItemModal(item) {
  APP_STATE.stagingItem = JSON.parse(JSON.stringify(item));
  const modal = document.getElementById('attrModal');
  setTxt('attrModalTitle', `${item.name} (${item.category})`);
  const body = document.getElementById('attrModalBody');
  if (!body) return;
  body.innerHTML = '';

  const serialList = Array.isArray(item.serials) ? item.serials : [];
  const huidList = Array.isArray(item.huids) ? item.huids : [];
  const batchList = Array.isArray(item.batches) ? item.batches : [];

  if (item.category === 'Electronics') {
    let serialOptionsHtml = `<option value="">-- Bill without Serial / Untracked (${Math.max(0, item.stock - serialList.length)} left) --</option>`;
    serialList.forEach(s => { serialOptionsHtml += `<option value="${s}">IMEI: ${s}</option>`; });

    body.innerHTML = `
      <div class="form-input"><label>Select Registered IMEI / Serial</label><select id="mSerialSelect">${serialOptionsHtml}</select></div>
      <div class="form-input"><label>Or Type / Scan New Serial</label><input type="text" id="mCustomSerial" placeholder="Optional manual serial"></div>
      <div class="form-input"><label>Unit Price (Excl. Tax)</label><input type="number" id="mPrice" value="${item.price}"></div>
      <div class="form-input"><label>Quantity</label><input type="number" id="mQty" value="1" min="1" max="${item.stock}"></div>
    `;
  } else if (item.category === 'Jewelry') {
    let huidOptionsHtml = `<option value="">-- Select Registered HUID --</option>`;
    huidList.forEach(h => { huidOptionsHtml += `<option value="${h}">HUID: ${h}</option>`; });

    body.innerHTML = `
      <div class="form-input"><label>Select Hallmark HUID</label><select id="mHuidSelect">${huidOptionsHtml}</select></div>
      <div class="form-input"><label>Or Type New HUID</label><input type="text" id="mCustomHuid" placeholder="e.g. HUID-A92B1"></div>
      <div class="form-input"><label>Purity / Karat</label><input type="text" id="mKarat" value="${item.meta?.karat || '22K'}"></div>
      <div class="form-input"><label>Gold Rate / gm (₹)</label><input type="number" id="mGoldRate" value="${APP_STATE.liveGoldRate}"></div>
      <div class="form-input"><label>Net Weight (Grams)</label><input type="number" step="0.001" id="mNetWt" value="${item.meta?.netWt || 5.0}"></div>
      <div class="form-input"><label>Making Charges (₹)</label><input type="number" id="mMaking" value="${item.meta?.making || 1500}"></div>
      <div class="form-input"><label>Quantity</label><input type="number" id="mQty" value="1" min="1" max="${item.stock}"></div>
    `;
  } else if (item.category === 'Pharmacy') {
    let batchOptionsHtml = `<option value="">-- Select Batch --</option>`;
    batchList.forEach(b => { batchOptionsHtml += `<option value="${b.batch}">Batch: ${b.batch} (Exp: ${b.expiry})</option>`; });

    body.innerHTML = `
      <div class="form-input"><label>Select Batch</label><select id="mBatchSelect">${batchOptionsHtml}</select></div>
      <div class="form-input"><label>Or Type Batch No</label><input type="text" id="mBatch" value="${item.meta?.batch || ''}"></div>
      <div class="form-input"><label>Expiry Date</label><input type="month" id="mExp" value="${item.meta?.expiry || ''}"></div>
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
function closeModal() { const m = document.getElementById('attrModal'); if (m) m.classList.remove('open'); }

// Rounds to 2 decimals safely — prevents floating-point drift (0.1+0.2 style
// errors) from silently accumulating across a cart with many line items.
function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function commitModalItem() {
  const it = APP_STATE.stagingItem;
  let qty = parseInt(document.getElementById('mQty')?.value, 10) || 1;
  let price = parseFloat(document.getElementById('mPrice')?.value);
  if (price === undefined || isNaN(price)) price = it.price;

  // Guard rails: a 0/negative qty or price should never reach a saved
  // invoice — it silently corrupts stock counts and customer ledgers.
  if (qty < 1) qty = 1;
  if (qty > it.stock) qty = it.stock;
  if (price < 0) price = 0;

  let assignedIdentifier = '';
  if (it.category === 'Electronics') {
    const sel = document.getElementById('mSerialSelect')?.value.trim();
    const cust = document.getElementById('mCustomSerial')?.value.trim();
    assignedIdentifier = cust || sel || '';
    it.meta.imei = assignedIdentifier;
  } else if (it.category === 'Jewelry') {
    const sel = document.getElementById('mHuidSelect')?.value.trim();
    const cust = document.getElementById('mCustomHuid')?.value.trim();
    assignedIdentifier = cust || sel || '';
    it.meta.huid = assignedIdentifier;
    const netWt = parseFloat(document.getElementById('mNetWt')?.value) || 0;
    const rate = parseFloat(document.getElementById('mGoldRate')?.value) || APP_STATE.liveGoldRate;
    const making = parseFloat(document.getElementById('mMaking')?.value) || 0;
    price = Math.max(0, (netWt * rate) + making);
  } else if (it.category === 'Pharmacy') {
    const sel = document.getElementById('mBatchSelect')?.value.trim();
    const cust = document.getElementById('mBatch')?.value.trim();
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
    showSaasToast(`"${it.name}" has no HSN/SAC code. Add one in Stock Master, or turn this rule off in Settings → GST & Tax Rates.`, 5000, 'err');
    return;
  }

  const line = TaxEngine.computeLine({ price, qty, gstRate: it.gst });

  APP_STATE.cart.push({
    ...it, price, qty,
    taxableValue: line.taxableValue,
    gstAmount: line.gstAmount,
    totalAmount: line.totalAmount,
    // Stamp the rate used at billing time. If a budget changes slabs later,
    // this invoice still reports the rate it was actually taxed at.
    gstRateAtBilling: line.gstRateAtBilling,
    assignedIdentifier
  });
  closeModal();
  setStep(4);
  renderCart();
}


function renderCart() {
  const tbody = document.getElementById('cartTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let taxable = 0, gstTotal = 0;

  APP_STATE.cart.forEach((it, idx) => {
    taxable = r2(taxable + it.taxableValue);
    gstTotal = r2(gstTotal + it.gstAmount);

    tbody.innerHTML += `
      <tr>
        <td><strong>${it.name}</strong><br><small style="color:var(--text-muted);">${it.assignedIdentifier ? 'ID: ' + it.assignedIdentifier : 'Untracked'} • ${it.gst}% GST</small></td>
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

  const qrBox = document.getElementById('posUpiQrBox');
  if (qrBox && roundedGrand > 0) {
    qrBox.innerHTML = generateDynamicUpiQR(roundedGrand, `INV-${APP_STATE.invCounter}`);
  }
}

function removeCart(idx) { APP_STATE.cart.splice(idx, 1); renderCart(); }

function setTender(mode, el) {
  setStep(5);
  APP_STATE.selectedTender = mode;
  document.querySelectorAll('.btn-tender').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function setStep(num) {
  for (let i = 1; i <= 6; i++) {
    const chip = document.getElementById(`stepChip-${i}`);
    if (chip) {
      chip.classList.toggle('active', i === num);
      chip.classList.toggle('done', i < num);
    }
  }
}
function jumpToStep(n) {
  setStep(n);
  if (n === 1) document.getElementById('barcodeSearch')?.focus();
  if (n === 3) document.getElementById('custPhone')?.focus();
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
async function syncInvoiceToCloud(invoice) {
  if (!APP_STATE.cloudSession) { SyncEngine.enqueue(invoice); return; }
  const shopId = APP_STATE.tenantProfile.shopId;

  try {
    const { error: saveErr } = await SB.saveSale(shopId, invoice);
    if (saveErr && !saveErr.includes('duplicate key')) throw new Error(saveErr);

    for (const it of invoice.items) {
      const { error: stockErr } = await SB.decrementStock(it.id, it.qty);
      if (stockErr) console.warn('Stock decrement failed for', it.name, stockErr);
    }

    if (invoice.customer.phone !== '-') {
      const existing = APP_STATE.customers.find(c => c.phone === invoice.customer.phone);
      await SB.upsertCustomer(shopId, {
        phone: invoice.customer.phone,
        name: invoice.customer.name,
        gstin: invoice.customer.gstin || null,
        dues: existing ? existing.dues : 0,
        total_orders_val: existing ? existing.totalOrdersVal : 0,
      });
    }
  } catch (err) {
    console.warn('Cloud sync failed, queued for retry:', err.message);
    SyncEngine.enqueue(invoice);
  }
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
  document.getElementById('returnModal')?.classList.add('open');
}

function closeReturnModal() {
  document.getElementById('returnModal')?.classList.remove('open');
  APP_STATE.returnDraft = null;
}

function renderReturnModal() {
  const d = APP_STATE.returnDraft;
  if (!d) return;

  setTxt('retInvoiceNo', d.sale.invoiceNo);
  setTxt('retCustomer', `${d.sale.customer?.name || 'Cash Customer'} · ${d.sale.customer?.phone || '-'}`);
  setTxt('retTaxMode', d.sale.interstate ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)');

  const body = document.getElementById('retLinesBody');
  if (!body) return;

  body.innerHTML = d.lines.map((l, idx) => {
    const disabled = l.returnableQty === 0;
    return `<tr${disabled ? ' style="opacity:.45;"' : ''}>
      <td>
        <strong>${l.name}</strong>
        ${l.assignedIdentifier ? `<br><small style="color:var(--text-muted);">${l.assignedIdentifier}</small>` : ''}
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
      const computed = TaxEngine.computeLine({ price: l.price, qty: l.returnQty, gstRate: rate });
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
  const splitEl = document.getElementById('retGstSplit');
  if (splitEl) {
    if (r.gstTotal === 0) { splitEl.innerText = ''; }
    else if (interstate) { splitEl.innerText = `IGST reversed: ₹${r.gstTotal.toFixed(2)}`; }
    else {
      const half = TaxEngine.round2(r.gstTotal / 2);
      const other = TaxEngine.round2(r.gstTotal - half);
      splitEl.innerText = `CGST ₹${half.toFixed(2)} + SGST ₹${other.toFixed(2)} reversed`;
    }
  }

  const btn = document.getElementById('retSubmitBtn');
  if (btn) btn.disabled = r.lines.length === 0;
}

async function submitReturn() {
  const d = APP_STATE.returnDraft;
  const r = computeReturnTotals();
  if (!d || !r || !r.lines.length) {
    showSaasToast('Select at least one item to return.', 3000, 'err');
    return;
  }

  const restock = !!document.getElementById('retRestock')?.checked;
  const reason = document.getElementById('retReason')?.value.trim() || '';

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

  const btn = document.getElementById('retSubmitBtn');
  if (btn) { btn.disabled = true; btn.innerText = 'Processing…'; }

  // Local state first so the counter is never blocked on network, matching
  // how a sale behaves; the cloud call self-queues on failure.
  applyReturnLocally(ret, restock);
  APP_STATE.cnCounter = (APP_STATE.cnCounter || 1) + 1;
  localStorage.setItem('bn_cn_seq', String(APP_STATE.cnCounter));
  persistState();

  if (APP_STATE.cloudSession && d.sale.cloudId) {
    const { error } = await SB.processReturn(APP_STATE.tenantProfile.shopId, d.sale.cloudId, ret);
    if (error) {
      showSaasToast(`Saved locally. Cloud sync failed: ${error}`, 5000, 'err');
    } else {
      showSaasToast(`Credit note ${creditNoteNo} created. Stock ${restock ? 'restored' : 'not restored (damaged)'}.`, 4000);
    }
  } else {
    showSaasToast(`Credit note ${creditNoteNo} created locally.`, 3500);
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
function checkoutBill() {
  if (!APP_STATE.cart.length) return alert("Cart is empty!");
  const phone = document.getElementById('custPhone')?.value.trim() || '-';
  const name = document.getElementById('custName')?.value.trim() || 'Cash Customer';
  const gstin = document.getElementById('custGstin')?.value.trim() || '';
  const address = document.getElementById('custAddress')?.value.trim() || '';
  const stateCode = document.getElementById('custState')?.value || '';

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
    invoiceNo: `INV-${APP_STATE.invCounter}`,
    idempotency_key: SyncEngine.generateIdempotencyKey(),
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toISOString(),
    customer: {
      name, phone, gstin, address,
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
      cust = { phone, name, gstin, address, stateCode, dues: 0, totalOrdersVal: 0, orderHistory: [] };
      APP_STATE.customers.push(cust);
    } else {
      // Keep the party record current — a customer who gives their address
      // on a later visit should have it saved, not silently discarded.
      if (address) cust.address = address;
      if (stateCode) cust.stateCode = stateCode;
      if (gstin) cust.gstin = gstin;
      if (name && name !== 'Cash Customer') cust.name = name;
    }
    if (APP_STATE.selectedTender === 'Khata') cust.dues += invoice.total;
    cust.totalOrdersVal = (cust.totalOrdersVal || 0) + invoice.total;
    cust.orderHistory = cust.orderHistory || [];
    cust.orderHistory.push({
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      items: invoice.items.map(i => `${i.name} (${i.assignedIdentifier || 'x' + i.qty})`).join(', '),
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
  setVal('custAddress', '');
  setVal('custState', '');
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
  const sheet = document.getElementById('printSheet') || document.querySelector('.print-sheet');
  if (sheet) {
    sheet.style.setProperty('--invoice-accent', profile.accent);
    // Jewelry gets a genuinely different frame, not just a colour swap —
    // ornate double-border and corner motifs read as "premium boutique"
    // the way a plain ruled table never does, matching how jewellers'
    // paper bills traditionally look. Pure CSS/SVG, no image asset, so it
    // still works fully offline and survives thermal/A4 print equally.
    sheet.classList.toggle('invoice-ornate', industry === 'Jewelry');
  }

  const idHeader = document.getElementById('pIdColHeader');
  if (idHeader) idHeader.innerText = profile.idLabel;

  const tagline = document.getElementById('pIndustryTagline');
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
  const addrRow = document.getElementById('pCustAddrRow');
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

  const tbody = document.getElementById('pItemsBody');
  const hsnBody = document.getElementById('pHsnBody');
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
        <td>${it.name}</td>
        <td style="text-align:center;">${it.hsn}</td>
        <td>${it.assignedIdentifier || it.meta?.batch || '-'}</td>
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

  const pQrBox = document.getElementById('pUpiQrContainer');
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
  const thead = document.getElementById('pTaxTableHead');
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
          <td>${g.hsn}</td>
          <td style="text-align:right;">${g.taxable.toFixed(2)}</td>
          <td style="text-align:center;">${g.gstRate}%</td>
          <td style="text-align:right;">${g.igst.toFixed(2)}</td>
          <td style="text-align:right;">${g.gstAmt.toFixed(2)}</td>
        </tr>`;
    } else {
      hsnBody.innerHTML += `
        <tr>
          <td>${g.hsn}</td>
          <td style="text-align:right;">${g.taxable.toFixed(2)}</td>
          <td style="text-align:center;">${(g.gstRate / 2)}%</td>
          <td style="text-align:right;">${g.cgst.toFixed(2)}</td>
          <td style="text-align:center;">${(g.gstRate / 2)}%</td>
          <td style="text-align:right;">${g.sgst.toFixed(2)}</td>
          <td style="text-align:right;">${g.gstAmt.toFixed(2)}</td>
        </tr>`;
    }
  });

  const roundOffRow = document.getElementById('pRoundOffRow');
  if (roundOffRow) {
    if (inv.roundOff && Math.abs(inv.roundOff) >= 0.01) {
      roundOffRow.style.display = 'block';
      setTxt('pRoundOff', `${inv.roundOff > 0 ? '+' : ''}₹${inv.roundOff.toFixed(2)}`);
    } else {
      roundOffRow.style.display = 'none';
    }
  }
}

/* ==========================================================================
   PRINTER HARDWARE ENGINE (BLUETOOTH ESC/POS + THERMAL)
   ========================================================================== */
const PrinterEngine = {
  device: null,
  characteristic: null,
  isBusy: false,

  SERVICES: [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
  ],

  async connectThermalPrinter() {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth is not supported. Use Chrome on Android or Desktop.");
      return false;
    }
    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.SERVICES
      });

      // A printer going out of range, running out of battery, or being
      // switched off mid-shift is normal, everyday behaviour on a shop
      // counter — without this listener, `this.characteristic` stays set
      // to a dead reference and every future sale hangs on a doomed write
      // before falling back to A4 print, making checkout feel slow/broken.
      this.device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this.setStatus('⚠️ Printer disconnected. Reconnect from Settings, or sales will fall back to A4/PDF.', true);
      });

      const server = await this.device.gatt.connect();
      const services = await server.getPrimaryServices();

      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.writeWithoutResponse || c.properties.write) {
            this.characteristic = c;
            break;
          }
        }
        if (this.characteristic) break;
      }

      if (!this.characteristic) {
        this.setStatus('⚠️ Connected, but no writable print service found on this device.', true);
        return false;
      }

      this.setStatus(`✅ Connected: ${this.device.name || 'Thermal Printer'}`, false);
      return true;
    } catch (err) {
      // User cancelling the Bluetooth picker throws too — that's not a
      // real error, just don't scare them with an alert for it.
      if (err.name !== 'NotFoundError') alert("Pairing Error: " + err.message);
      return false;
    }
  },

  setStatus(msg, isWarning) {
    const el = document.getElementById('printerStatusLine');
    if (el) {
      el.innerText = msg;
      el.style.color = isWarning ? 'var(--danger)' : 'var(--success)';
    }
  },

  // Wraps a printer write with a hard timeout — a dead-but-not-yet-noticed
  // GATT link can otherwise hang the browser's operation for many seconds,
  // during which the cashier is stuck staring at a frozen checkout screen.
  async writeChunks(bytes) {
    if (!this.characteristic) throw new Error("Printer not connected.");
    const CHUNK = 120;
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Printer write timed out')), ms)),
    ]);

    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      if (this.characteristic.properties.writeWithoutResponse) {
        await withTimeout(this.characteristic.writeValueWithoutResponse(slice), 4000);
      } else {
        await withTimeout(this.characteristic.writeValue(slice), 4000);
      }
      await new Promise(r => setTimeout(r, 20));
    }
  },

  buildEscPosPayload(inv, width = 80) {
    const cols = width === 58 ? 32 : 48;
    const enc = new TextEncoder();
    const bytes = [];
    const p = APP_STATE.tenantProfile;

    const append = arr => bytes.push(...arr);
    const text = str => append(enc.encode(str.replace(/₹/g, 'Rs.')));

    append([0x1B, 0x40]);
    append([0x1B, 0x61, 0x01]);
    append([0x1B, 0x45, 0x01]);
    text(`${p.shopName}\n`);
    append([0x1B, 0x45, 0x00]);
    text(`${p.address}\n`);
    text(`GSTIN: ${p.gstin || 'Unregistered'}\n`);
    text("-".repeat(cols) + "\n");

    append([0x1B, 0x61, 0x00]);
    text(`Bill: ${inv.invoiceNo} | Date: ${inv.date}\n`);
    text(`Cust: ${inv.customer.name} (${inv.customer.phone})\n`);
    text("-".repeat(cols) + "\n");

    inv.items.forEach(it => {
      text(`${it.name}\n`);
      const tag = it.assignedIdentifier ? `[${it.assignedIdentifier}]` : '';
      const qp = `${it.qty} x ${it.price.toFixed(2)}`;
      const tot = `Rs.${it.totalAmount.toFixed(2)}`;
      const pad = Math.max(1, cols - qp.length - tot.length);
      text(`${qp}${' '.repeat(pad)}${tot}\n`);
      if (tag) text(`  ${tag}\n`);
    });

    text("-".repeat(cols) + "\n");
    append([0x1B, 0x45, 0x01]);
    text(`GRAND TOTAL: Rs.${inv.total.toFixed(2)}\n`);
    append([0x1B, 0x45, 0x00]);
    text(`Mode: ${inv.tender.toUpperCase()}\n`);
    text("=".repeat(cols) + "\n");
    append([0x1B, 0x61, 0x01]);
    text("Thank you! Visit Again\n");

    // UPI payment line — a thermal printer can't render the QR bitmap
    // reliably across models, but the ID itself is scannable/typeable.
    if (p.upiId) {
      text("-".repeat(cols) + "\n");
      text(`Pay via UPI: ${p.upiId}\n`);
    }
    text("\n\n\n");

    // Paper cut. GS V 66 0 = partial cut (leaves a small tab so the receipt
    // doesn't drop on the floor); GS V 65 0 = full cut. Some cheap printers
    // ignore cut commands entirely and just feed — harmless either way.
    if (p.autoCut !== false) {
      append(p.cutType === 'full' ? [0x1D, 0x56, 0x41, 0x00] : [0x1D, 0x56, 0x42, 0x00]);
    }

    // Cash drawer kick: ESC p m t1 t2. Pin 2 (m=0) is the near-universal
    // default; a few drawers wire to pin 5 (m=1). Only fires for cash sales
    // — popping the till on a UPI or card payment is how tills get skimmed,
    // and it startles the cashier.
    if (p.cashDrawer && inv.tender === 'Cash') {
      append([0x1B, 0x70, p.drawerPin === '5' ? 0x01 : 0x00, 0x19, 0xFA]);
    }

    return new Uint8Array(bytes);
  },

  // Fired from Settings so a shop can confirm the drawer is wired correctly
  // without having to ring up a real sale to test it.
  async openCashDrawer() {
    if (!this.characteristic) {
      const ok = await this.connectThermalPrinter();
      if (!ok) return;
    }
    const pin = APP_STATE.tenantProfile.drawerPin === '5' ? 0x01 : 0x00;
    try {
      await this.writeChunks(new Uint8Array([0x1B, 0x70, pin, 0x19, 0xFA]));
      this.setStatus('Drawer pulse sent.', false);
    } catch (err) {
      this.setStatus(`Drawer pulse failed: ${err.message}`, true);
    }
  },

  async dispatchPrint(inv) {
    if (APP_STATE.tenantProfile.printerFormat === 'thermal') {
      if (!this.characteristic) {
        const ok = await this.connectThermalPrinter();
        if (!ok) { window.print(); return; }
      }
      try {
        const payload = this.buildEscPosPayload(inv, APP_STATE.tenantProfile.thermalWidth);
        await this.writeChunks(payload);
      } catch (err) {
        this.characteristic = null; // stale/dead — force re-pair next attempt, don't keep retrying a dead link
        this.setStatus(`⚠️ Thermal print failed (${err.message}). Printed via A4 instead.`, true);
        window.print();
      }
    } else {
      window.print();
    }
  },

  async runPrinterDiagnosticTest() {
    const demo = {
      invoiceNo: "TEST-1001",
      date: new Date().toLocaleDateString('en-IN'),
      customer: { name: "Abhijit Roy", phone: "9876543210" },
      tender: "Cash",
      total: 19298.00,
      items: [
        { name: "Motorola G84 5G", qty: 1, price: 18999.00, totalAmount: 18999.00, assignedIdentifier: "864592039481920" }
      ]
    };
    await this.dispatchPrint(demo);
  }
};

/* ==========================================================================
   REPORTS & DASHBOARD CONTROLLER
   ========================================================================== */
function openReport(reportKey) {
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
    const dd = document.getElementById('cust360Dropdown');
    if (dd) {
      dd.innerHTML = APP_STATE.customers.map(c => `<option value="${c.phone}">${c.name} (${c.phone})</option>`).join('');
      renderCustomer360Profile(dd.value);
    }
  } else {
    renderActiveReportData();
  }
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
  const thead = document.getElementById('drillTableHead');
  const tbody = document.getElementById('drillTableBody');
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
      const age = Math.floor((Date.now() - new Date(s.timestamp)) / 86400000);
      pill = age > 30 ? 'overdue' : 'pending';
      label = age > 30 ? `${age}D OVERDUE` : 'DUE';
    }

    return `<tr>
      <td><strong>${s.invoiceNo}</strong></td>
      <td>${s.date}</td>
      <td>${s.customer?.name || 'Cash Customer'}</td>
      <td>${s.customer?.phone || '-'}</td>
      <td>${s.tender}</td>
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
  const thead = document.getElementById('drillTableHead');
  const tbody = document.getElementById('drillTableBody');
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
        <td><strong>${r.name}</strong></td>
        <td>${r.phone}</td>
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

      tbody.innerHTML += `<tr><td><strong>${i.name}</strong></td><td><code>${i.barcode || '-'}</code></td><td><code>${idList}</code></td><td>${i.category}</td><td>${i.stock}</td><td style="text-align:right;">₹${i.price.toFixed(2)}</td></tr>`;
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
        const key = `${g.hsn}|${g.gstRate}`;
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
      tbody.innerHTML += `<tr><td>${g.hsn}</td><td>${g.gst}%</td><td style="text-align:right;">₹${g.taxable.toFixed(2)}</td><td style="text-align:right;">₹${g.cgst.toFixed(2)}</td><td style="text-align:right;">₹${g.sgst.toFixed(2)}</td><td style="text-align:right;">₹${g.igst.toFixed(2)}</td><td style="text-align:right; font-weight:700;">₹${totalTax.toFixed(2)}</td></tr>`;
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
        ? `<tr><td><strong>${i.name}</strong></td><td>${i.category}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">${fmtCost(i.cost)}</td><td style="text-align:right;">${fmtCost(costVal)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`
        : `<tr><td><strong>${i.name}</strong></td><td>${i.category}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">₹${(i.price || 0).toFixed(2)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`;
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
      tbody.innerHTML += `<tr><td><strong>${inv.invoiceNo}</strong></td><td>${inv.date}</td><td>${inv.customer?.name || 'Cash Customer'}</td><td>${inv.tender}</td><td style="text-align:right;">₹${(inv.taxable || 0).toFixed(2)}</td><td style="text-align:right;">₹${(inv.gstTotal || 0).toFixed(2)}</td><td style="text-align:right; font-weight:700;">₹${(inv.total || 0).toFixed(2)}</td></tr>`;
    });
    if (APP_STATE.sales.length) {
      tbody.innerHTML += `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL</td><td style="text-align:right;">₹${dayTaxable.toFixed(2)}</td><td style="text-align:right;">₹${dayGst.toFixed(2)}</td><td style="text-align:right;">₹${dayTotal.toFixed(2)}</td></tr>`;
    }
  }
}

function switchView(viewName, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mob-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
  closeSettingsPanel(); // never land on a stale open panel from a previous visit

  if (el) el.classList.add('active');
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  // Mobile nav's Settings icon has no `el` passed in from openSettingsHome()
  // (it calls switchView('settings') with no second arg) — mark it active
  // manually so the bottom bar still reflects where the user actually is.
  if (viewName === 'settings') {
    document.querySelector('.mob-nav-item[onclick*="openSettingsHome"]')?.classList.add('active');
  }

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'pos') renderCatalog();
  if (viewName === 'reports') closeReportDetail();
}

function filterReportsCategory(cat, btn) {
  document.querySelectorAll('.rep-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const cards = document.querySelectorAll('.report-section-card');
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

  // Recent Invoices table
  const recentBody = document.getElementById('dashRecentOrdersBody');
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
        const ageDays = Math.floor((Date.now() - new Date(s.timestamp)) / 86400000);
        cls = ageDays > 30 ? 'overdue' : 'pending';
        label = ageDays > 30 ? `${ageDays}D OVERDUE` : 'DUE';
      }
      recentBody.innerHTML += `<tr><td><strong>${s.invoiceNo}</strong></td><td>${s.customer?.name || 'Cash Customer'}</td><td>${s.date}</td><td><span class="pill ${cls}">${label}</span></td><td style="text-align:right; font-weight:700;">₹${(s.total || 0).toFixed(2)}</td></tr>`;
    });
  }

  // Top Parties by lifetime value
  const topList = document.getElementById('topCustomersList');
  if (topList) {
    const ranked = [...(APP_STATE.customers || [])].sort((a, b) => (b.totalOrdersVal || 0) - (a.totalOrdersVal || 0)).slice(0, 5);
    topList.innerHTML = ranked.length
      ? ranked.map(c => `<div class="legend-row" style="padding:6px 0;"><div><strong>${c.name}</strong><br><small style="color:var(--text-muted);">${c.phone}</small></div><strong>₹${(c.totalOrdersVal || 0).toLocaleString('en-IN')}</strong></div>`).join('')
      : `<p style="color:var(--text-muted); font-size:0.85rem;">No customer purchase history yet.</p>`;
  }
}

// Minimal dependency-free donut chart — avoids pulling in a charting
// library just to draw four arcs; recomputed on every dashboard render.
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
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  credit.forEach(s => {
    const row = byPhone[s.customer.phone];
    if (!row) return;
    const remaining = TaxEngine.round2(row.total - row._allocated);
    if (remaining <= 0) return;

    const amount = Math.min(s.total || 0, remaining);
    if (amount <= 0) return;

    const days = Math.max(0, Math.floor((now - new Date(s.timestamp)) / DAY));
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
    const el = document.getElementById(elId);
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
  const svg = document.getElementById('donutSvg');
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
  const custSel = document.getElementById('custState');
  if (custSel) custSel.innerHTML = `<option value="">Place of Supply (State)</option>` + opts;
}

function onCustomerStateChange() { updateTaxTypeHint(); }

function onCustomerGstinInput(val) {
  // Auto-select the state implied by the GSTIN so the cashier sees
  // immediately which tax will apply — silent misclassification here is
  // exactly the kind of error that surfaces months later at filing time.
  const code = (val || '').trim().slice(0, 2);
  const sel = document.getElementById('custState');
  if (sel && GST_STATE_CODES[code]) sel.value = code;
  updateTaxTypeHint();
}

function updateTaxTypeHint() {
  const hint = document.getElementById('taxTypeHint');
  if (!hint) return;
  const interstate = TaxEngine.isInterstate({
    customerGstin: document.getElementById('custGstin')?.value || '',
    customerStateCode: document.getElementById('custState')?.value || '',
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
  const raw = document.getElementById('cfgGstSlabs')?.value || '';
  const result = GstConfig.setSlabs(raw.split(',').map(s => s.trim()).filter(Boolean));
  const status = document.getElementById('gstSlabStatus');
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
  const fmt = document.getElementById('cfgPrinterFormat')?.value || 'a4';
  setDisplay('thermalWidthRow', fmt === 'thermal' ? 'block' : 'none');
  savePrinterSettings();
}

// Previously these controls loaded from state but nothing ever wrote back —
// a shop would set Thermal, reload, and silently be on A4 again at the next
// sale. Persisted locally immediately, and pushed to the shop row so the
// setting follows the owner to a second device.
function savePrinterSettings() {
  const p = APP_STATE.tenantProfile;
  p.printerFormat = document.getElementById('cfgPrinterFormat')?.value || 'a4';
  p.thermalWidth = parseInt(document.getElementById('cfgThermalWidth')?.value, 10) || 80;

  const cut = document.getElementById('cfgCutType')?.value || 'partial';
  p.autoCut = cut !== 'none';
  p.cutType = cut === 'none' ? 'partial' : cut;

  const drawer = document.getElementById('cfgCashDrawer')?.value || 'off';
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
  const container = document.getElementById('splineChartContainer');
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

function setTrendRange(days) {
  APP_STATE.trendRangeDays = parseInt(days, 10) || 30;
  renderTrendChart();
}

function renderCatalog() {
  const container = document.getElementById('catalogGrid');
  if (!container) return;
  container.innerHTML = '';
  const filtered = APP_STATE.inventory.filter(i => APP_STATE.activeSector === 'All' || i.category === APP_STATE.activeSector);

  filtered.forEach(it => {
    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.onclick = () => openItemModal(it);

    let tag = it.barcode ? `Barcode: ${it.barcode}` : `HSN: ${it.hsn}`;
    card.innerHTML = `
      <div>
        <div class="name">${it.name}</div>
        <div class="meta">${tag} &bull; ${it.gst}% GST</div>
      </div>
      <div class="bottom">
        <span class="price">₹${it.price.toFixed(2)}</span>
        <span class="stock-tag ${it.stock < 10 ? 'low' : ''}">${it.stock} left</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function openNewProductModal() { document.getElementById('newProdModal')?.classList.add('open'); }
function closeNewProdModal() { document.getElementById('newProdModal')?.classList.remove('open'); }

function saveNewProduct() {
  const name = document.getElementById('npName')?.value.trim();
  const category = document.getElementById('npCategory')?.value || 'Electronics';
  const barcode = document.getElementById('npBarcode')?.value.trim() || '';
  const hsn = document.getElementById('npHsn')?.value.trim() || '8517';
  const gst = parseInt(document.getElementById('npGst')?.value, 10) || 18;
  const price = parseFloat(document.getElementById('npPrice')?.value) || 0;
  const stock = parseInt(document.getElementById('npStock')?.value, 10) || 0;
  const rawIds = document.getElementById('npIdentifiers')?.value || '';
  const idArray = rawIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  if (!name) return alert("Product name is required!");

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
    meta: {}
  };
  APP_STATE.inventory.push(newItem);

  persistState();
  syncItemToCloud(newItem);
  closeNewProdModal();
  renderCatalog();
}

function filterSector(sec, el) {
  APP_STATE.activeSector = sec;
  document.querySelectorAll('.sector-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderCatalog();
}

function handleSearch(q) {
  const cards = document.querySelectorAll('.catalog-card');
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

/* ==========================================================================
   CSV EXPORT ENGINE
   ========================================================================== */
function downloadCSV(filename, rows) {
  // rows: array of arrays. Escapes quotes/commas per RFC 4180.
  const csv = rows.map(row =>
    row.map(cell => {
      const s = (cell === null || cell === undefined) ? '' : String(cell);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


/* ==========================================================================
   EXPORT ENGINE — CSV + Excel
   Excel output uses SpreadsheetML 2003 (.xls), which Excel, LibreOffice and
   Google Sheets all open natively and which supports real column widths,
   bold headers and number formatting. Deliberately NOT a .xlsx: that needs
   a ZIP writer (~100KB of extra library) for cosmetic gain, and this app is
   precached for offline use where every KB is downloaded on a shop's mobile
   data. CSV remains available for anything a user wants to re-import.
   ========================================================================== */
function escXml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function exportToExcel(filename, sheetName, headers, rows, meta = {}) {
  const isNum = v => typeof v === 'number' && isFinite(v);

  const headerCells = headers.map(h =>
    `<Cell ss:StyleID="hdr"><Data ss:Type="String">${escXml(h)}</Data></Cell>`
  ).join('');

  const bodyRows = rows.map(r => {
    const cells = r.map(v => isNum(v)
      ? `<Cell ss:StyleID="num"><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`
    ).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  // A title/context band above the table: an exported file that lands in
  // someone's inbox with no indication of which shop or date range it
  // covers is close to useless for an accountant.
  const metaRows = [
    ['Report', sheetName],
    ['Shop', APP_STATE.tenantProfile.shopName || ''],
    ['GSTIN', APP_STATE.tenantProfile.gstin || 'Unregistered'],
    ['Generated', new Date().toLocaleString('en-IN')],
    ...(meta.filter ? [['Filter', meta.filter]] : []),
    ...(meta.range ? [['Period', meta.range]] : [])
  ].map(([k, v]) =>
    `<Row><Cell ss:StyleID="metaKey"><Data ss:Type="String">${escXml(k)}</Data></Cell>` +
    `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell></Row>`
  ).join('');

  const cols = headers.map(() => `<Column ss:AutoFitWidth="1" ss:Width="120"/>`).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#6366D9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="metaKey"><Font ss:Bold="1" ss:Color="#666666"/></Style>
  <Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="${escXml(sheetName).slice(0, 31)}">
  <Table>
   ${cols}
   ${metaRows}
   <Row></Row>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Pulls whatever table is currently rendered in the drill-down and exports
// exactly that — so what the user sees on screen and what lands in Excel
// can never diverge, including any filter they applied.
function exportCurrentViewToExcel() {
  const theadRow = document.querySelector('#drillTableHead tr');
  const bodyRows = document.querySelectorAll('#drillTableBody tr');
  if (!theadRow || !bodyRows.length) {
    showSaasToast('Nothing to export in this view.', 3000, 'err');
    return;
  }

  const headers = Array.from(theadRow.children).map(th => th.innerText.trim());
  const rows = [];
  bodyRows.forEach(tr => {
    const cells = Array.from(tr.children).map(td => {
      const txt = td.innerText.trim();
      // Convert "₹1,234.50" back to a real number so Excel can sum the
      // column — a currency string exports as text and silently breaks
      // every formula an accountant tries to write against it.
      const numeric = txt.replace(/[₹,\s]/g, '');
      return (numeric !== '' && numeric !== '-' && !isNaN(numeric)) ? parseFloat(numeric) : txt;
    });
    if (cells.length) rows.push(cells);
  });

  const title = document.getElementById('drillReportTitle')?.innerText || 'Report';
  exportToExcel(
    `${(APP_STATE.currentReportKey || 'report')}-${new Date().toISOString().slice(0, 10)}`,
    title, headers, rows,
    { filter: document.getElementById('drillFilterLabel')?.innerText || '' }
  );
}

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
  const theadRow = document.querySelector('#drillTableHead tr');
  const bodyRows = document.querySelectorAll('#drillTableBody tr');
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
  const authEl = document.getElementById('authOverlay');
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
window.sendLoginOtp = sendLoginOtp;
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
window.commitSingleAiItem = commitSingleAiItem;
window.commitAllAiItems = commitAllAiItems;
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
  const banner = document.getElementById('updateBanner');
  if (banner) banner.classList.remove('hidden');
}

function dismissUpdateBanner() {
  const banner = document.getElementById('updateBanner');
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
  setLoginMethod('email');
  initAuthGate();
  updateNetworkStatus();
  renderDashboard();
  renderCatalog();
  updateTaxTypeHint();
  setTxt('pDate', new Date().toLocaleDateString('en-IN'));
});
