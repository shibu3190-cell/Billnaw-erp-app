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
    ownerPin: '',
    staffPin: '',
    isRegistered: false,
    bankName: 'State Bank of India',
    bankAcc: '38472910481',
    bankIfsc: 'SBIN0001234',
    upiId: 'ombetar@sbi',
    terms: '1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. All disputes subject to local jurisdiction.',
    printerFormat: 'a4',
    thermalWidth: 80
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
  } catch (e) {}
}

try {
  const tp = localStorage.getItem('bn_tenant'); if (tp) APP_STATE.tenantProfile = { ...APP_STATE.tenantProfile, ...JSON.parse(tp) };
  const inv = localStorage.getItem('bn_inv'); if (inv) APP_STATE.inventory = JSON.parse(inv);
  const cst = localStorage.getItem('bn_cust'); if (cst) APP_STATE.customers = JSON.parse(cst);
  const sls = localStorage.getItem('bn_sales'); if (sls) APP_STATE.sales = JSON.parse(sls);
  const seq = localStorage.getItem('bn_seq'); if (seq) APP_STATE.invCounter = parseInt(seq, 10);
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
function generateDynamicUpiQR(amount, invoiceNo) {
  const upiId = APP_STATE.tenantProfile.upiId || 'ombetar@sbi';
  const shop = APP_STATE.tenantProfile.shopName || 'Billnaw POS';
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shop)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`;
  
  const hash = Math.abs(Array.from(upiUrl).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0));
  const size = 25;
  let rects = '';
  
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isFinder = (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
      const isFinderBorder = isFinder && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      const isPattern = ((r * c + hash) % 3 === 0) || isFinderBorder;
      if (isPattern) {
        rects += `<rect x="${c * 4}" y="${r * 4}" width="4" height="4" fill="#000"/>`;
      }
    }
  }

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="background:#fff; padding:4px;">${rects}</svg>`;
}

/* ==========================================================================
   SECURITY & ROLE-BASED ACCESS CONTROL (RBAC)
   ========================================================================== */
function applyRoleSecurity(role) {
  const isOwner = role === 'Owner' || role === 'owner';
  document.querySelectorAll('.admin-only').forEach((el) => {
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
   AUTHENTICATION & ONBOARDING GATE
   ========================================================================== */

// Set once we have a real, RLS-backed Supabase session — everything that
// touches shop data checks this rather than the old `isRegistered` flag,
// which only ever meant "local device has seen a signup form."
APP_STATE.cloudSession = null;
APP_STATE.cloudProfile = null;

async function initAuthGate() {
  const overlay = document.getElementById('authOverlay');
  const { session, profile, shop, error: accountError } = await SB.getSessionAndProfile();

  if (session && !profile) {
    // Signed in, but onboarding is not complete yet. Allow the app to open so the
    // user can create their workspace/profile without being blocked by a missing row.
    APP_STATE.cloudSession = session;
    APP_STATE.cloudProfile = null;
    toggleAuthMode('register');
    showQuickPinBlock(false);
    setTxt('regError', 'Your account is active. Finish setup by creating your Billnaw profile.');
    applyAuthLockState(false);
    renderDashboard();
    renderCatalog();
    if (overlay) overlay.classList.remove('hidden');
    return;
  }

  if (session && profile && shop) {
    if (shop.status !== 'active') {
      setTxt('loginError', `This shop account is ${shop.status}. Contact support.`);
      await SB.signOut();
      APP_STATE.cloudSession = null;
      APP_STATE.cloudProfile = null;
      toggleAuthMode('login');
      showQuickPinBlock(false);
      applyAuthLockState(true);
      return;
    }

    APP_STATE.cloudSession = session;
    APP_STATE.cloudProfile = profile;
    hydrateTenantFromShop(shop);
    await hydrateCloudData(shop.id);

    toggleAuthMode('login');
    if (APP_STATE.tenantProfile.ownerPin) {
      showQuickPinBlock(true);
      applyAuthLockState(true);
    } else {
      showQuickPinBlock(false);
      applyAuthLockState(false);
      applyRoleSecurity(APP_STATE.currentUser.role);
      applyIndustryLock();
      renderDashboard();
      renderCatalog();
    }
  } else {
    APP_STATE.cloudSession = null;
    APP_STATE.cloudProfile = null;
    toggleAuthMode('login');
    showQuickPinBlock(false);
    applyAuthLockState(true);
  }
  syncProfileToDOM();
}

function showQuickPinBlock(show) {
  setDisplay('authEmailLoginBlock', show ? 'none' : 'block');
  setDisplay('quickPinBlock', show ? 'block' : 'none');
}

function applyAuthLockState(isLocked) {
  const overlay = document.getElementById('authOverlay');
  const appShell = document.querySelector('.app-shell');

  if (appShell) {
    appShell.style.pointerEvents = isLocked ? 'none' : 'auto';
    appShell.style.filter = isLocked ? 'blur(2px)' : 'none';
    appShell.style.opacity = isLocked ? '0.55' : '1';
  }

  if (overlay) {
    if (isLocked) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }
}

function hydrateTenantFromShop(shop) {
  const p = APP_STATE.tenantProfile;
  p.shopName = shop.name;
  p.gstin = shop.gstin || '';
  p.stateCode = shop.state_code || '';
  p.phone = shop.phone;
  p.address = shop.address;
  p.assignedIndustry = shop.industry || 'All';
  p.isLocked = shop.is_locked;
  p.bankName = shop.bank_name || p.bankName;
  p.bankAcc = shop.bank_acc || p.bankAcc;
  p.bankIfsc = shop.bank_ifsc || p.bankIfsc;
  p.upiId = shop.upi_id || p.upiId;
  p.terms = shop.terms || p.terms;
  p.printerFormat = shop.printer_format || p.printerFormat;
  p.thermalWidth = shop.thermal_width || p.thermalWidth;
  p.isRegistered = true;
  p.shopId = shop.id;
}

async function hydrateCloudData(shopId) {
  const [{ data: items }, { data: customers }, { data: sales }] = await Promise.all([
    SB.fetchItems(shopId),
    SB.fetchCustomers(shopId),
    SB.fetchSales(shopId),
  ]);
  if (items && items.length) {
    APP_STATE.inventory = items.map(i => ({
      id: i.id, name: i.name, category: i.category, barcode: i.barcode,
      hsn: i.hsn, price: Number(i.price), cost: Number(i.cost), gst: Number(i.gst),
      stock: i.stock, serials: i.serials || [], huids: i.huids || [], batches: i.batches || [], meta: i.meta || {},
    }));
  }
  if (customers) {
    APP_STATE.customers = customers.map(c => ({
      phone: c.phone, name: c.name, gstin: c.gstin, category: c.category,
      dues: Number(c.dues), totalOrdersVal: Number(c.total_orders_val), orderHistory: [],
    }));
  }
  if (sales) {
    APP_STATE.sales = sales.map(s => ({
      invoiceNo: s.invoice_no, idempotency_key: s.idempotency_key, date: new Date(s.created_at).toLocaleDateString('en-IN'),
      timestamp: s.created_at, customer: s.customer_snapshot, tender: s.tender,
      taxable: Number(s.taxable), gstTotal: Number(s.gst_total), roundOff: Number(s.round_off),
      total: Number(s.total), interstate: s.interstate, items: s.items,
    }));

    // CRITICAL: invoice numbers must never collide with what's already in
    // the cloud (unique per shop). A fresh device/browser, a cleared cache,
    // or a reinstall would otherwise restart the local counter from its
    // default and generate an invoice number that already exists — the
    // cloud insert then fails as a "duplicate key" and (correctly, for an
    // actual duplicate) is never retried, silently discarding a genuinely
    // new sale. Reconciling against the cloud's own numbers on every load
    // closes that gap regardless of what happened to local storage.
    let maxSeen = 0;
    APP_STATE.sales.forEach(s => {
      const n = parseInt(String(s.invoiceNo).replace(/[^\d]/g, ''), 10);
      if (!isNaN(n) && n > maxSeen) maxSeen = n;
    });
    if (maxSeen + 1 > APP_STATE.invCounter) {
      APP_STATE.invCounter = maxSeen + 1;
      localStorage.setItem('bn_seq', APP_STATE.invCounter.toString());
    }
  }
}

function toggleAuthMode(mode) {
  const loginView = document.getElementById('authLoginView');
  const regView = document.getElementById('authRegisterView');
  const tabLogin = document.getElementById('tabLoginBtn');
  const tabReg = document.getElementById('tabRegisterBtn');

  if (mode === 'login') {
    if (loginView) loginView.style.display = 'block';
    if (regView) regView.style.display = 'none';
    if (tabLogin) tabLogin.classList.add('active');
    if (tabReg) tabReg.classList.remove('active');
    setTxt('authModalHeader', APP_STATE.cloudSession ? "Unlock your workspace" : "Sign in to Billnaw");
    setTxt('authModalSub', APP_STATE.cloudSession ? "Enter your workspace PIN to continue." : "Run your business with clarity.");
  } else {
    if (loginView) loginView.style.display = 'none';
    if (regView) regView.style.display = 'block';
    if (tabLogin) tabLogin.classList.remove('active');
    if (tabReg) tabReg.classList.add('active');
    setTxt('authModalHeader', "Create your workspace");
    setTxt('authModalSub', "Start with the essentials. Add details later.");
  }
}

/* ==========================================================================
   OTP FLOW (email + phone), shared by signup verification and OTP login
   ========================================================================== */
const OtpFlow = {
  channel: null,      // 'email' | 'phone'
  target: null,       // the address/number
  purpose: null,      // 'signup' | 'login'
  pendingShop: null,  // shop details captured at registration, created after verify
  cooldownTimer: null,
  sending: false,
  lastRequestAt: 0,
  minRequestGapMs: 30000
};

const AuthFlowState = {
  step: 'IDENTIFY',
  email: '',
  phone: '',
  timer: 30,
};

function setLoginMethod(method) {
  const isEmail = method === 'email';
  AuthFlowState.step = 'IDENTIFY';
  setDisplay('loginEmailPane', isEmail ? 'block' : 'none');
  setDisplay('loginPhonePane', isEmail ? 'none' : 'block');
  document.getElementById('lmEmailBtn')?.classList.toggle('active', isEmail);
  document.getElementById('lmPhoneBtn')?.classList.toggle('active', !isEmail);
  if (!isEmail) {
    setTxt('loginPhoneError', 'Phone sign-in is coming soon — please continue with Email.');
  }
}

function showSaasToast(message, duration = 4000) {
  const toast = document.getElementById('authToast');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.remove('hidden');
  clearTimeout(showSaasToast.timeoutId);
  showSaasToast.timeoutId = setTimeout(() => toast.classList.add('hidden'), duration);
}

function handlePhoneAuthPlaceholder() {
  const input = document.getElementById('loginPhone');
  if (input) input.value = normalizePhoneNumber(input.value);
  showSaasToast('Phone sign-in is coming soon — please continue with Email.', 3200);
}

function handleGoogleSignIn() {
  showSaasToast('Google sign-in is ready for the next auth prompt.', 3000);
}

function completeOnboarding() {
  const name = document.getElementById('onboardingName')?.value.trim() || 'Billnaw User';
  const email = document.getElementById('onboardingEmail')?.value.trim() ||'';
  const role = document.getElementById('onboardingRole')?.value || 'Founder / Owner';
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.classList.add('hidden');
  APP_STATE.tenantProfile.shopName = name;
  APP_STATE.currentUser.role = role.includes('Owner') || role.includes('Founder') ? 'Owner' : 'Cashier';
  if (email) {
    APP_STATE.tenantProfile.phone = APP_STATE.tenantProfile.phone || '0000000000';
  }
  setTxt('sideStoreName', name);
  showSaasToast('Profile confirmed — welcome to Billnaw.', 3200);
  applyRoleSecurity(APP_STATE.currentUser.role);
  applyIndustryLock();
  renderDashboard();
  renderCatalog();
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input || !button) return;
  const isVisible = input.type === 'text';
  input.type = isVisible ? 'password' : 'text';
  button.classList.toggle('is-visible', !isVisible);
  button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
  button.title = isVisible ? 'Show password' : 'Hide password';
}

function normalizePhoneNumber(rawValue) {
  return String(rawValue || '').trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function clearAuthError(elementId) {
  if (elementId) setTxt(elementId, '');
}

function showOtpScreen(channel, target, purpose) {
  OtpFlow.channel = channel;
  OtpFlow.target = target;
  OtpFlow.purpose = purpose;
  setDisplay('authEmailLoginBlock', 'none');
  setDisplay('authRegisterView', 'none');
  setDisplay('otpVerifyBlock', 'block');
  setTxt('otpTargetLabel', target.includes('@') ? target.replace(/(^.).*(@.*$)/, '$1***$2') : target);
  setTxt('otpError', '');
  clearOtpBoxes();
  document.getElementById('otp-0')?.focus();
  showSaasToast('OTP Sent - OTP sent via Email. Please check your inbox.', 4000);
  startOtpCooldown();
}

function cancelOtpFlow() {
  setDisplay('otpVerifyBlock', 'none');
  if (OtpFlow.purpose === 'signup') {
    setDisplay('authRegisterView', 'block');
  } else {
    setDisplay('authEmailLoginBlock', 'block');
  }
  OtpFlow.purpose = null;
}

function clearOtpBoxes() {
  for (let i = 0; i < 6; i++) setVal(`otp-${i}`, '');
}

function readOtpCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += (document.getElementById(`otp-${i}`)?.value || '').trim();
  return code;
}

function onOtpInput(idx) {
  const box = document.getElementById(`otp-${idx}`);
  if (!box) return;
  // Strip non-digits — phone keyboards and autofill can insert stray chars.
  box.value = box.value.replace(/\D/g, '').slice(0, 1);
  if (box.value && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  if (readOtpCode().length === 6) verifyOtpCode(); // auto-submit when complete
}

function onOtpKeydown(e, idx) {
  if (e.key === 'Backspace' && !e.target.value && idx > 0) {
    document.getElementById(`otp-${idx - 1}`)?.focus();
  }
  // Support pasting the whole code into any box.
  if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
    setTimeout(() => {
      const pasted = (e.target.value || '').replace(/\D/g, '');
      if (pasted.length >= 6) {
        for (let i = 0; i < 6; i++) setVal(`otp-${i}`, pasted[i]);
        verifyOtpCode();
      }
    }, 10);
  }
}

function startOtpCooldown() {
  const btn = document.getElementById('otpResendBtn');
  const timerLbl = document.getElementById('otpTimerLabel');
  if (!btn) return;
  let secs = 30;
  btn.disabled = true;
  btn.innerText = `Resend OTP`;
  if (timerLbl) timerLbl.innerText = `Resend OTP in 00:${String(secs).padStart(2, '0')}`;
  clearInterval(OtpFlow.cooldownTimer);
  OtpFlow.cooldownTimer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(OtpFlow.cooldownTimer);
      btn.disabled = false;
      if (timerLbl) timerLbl.innerText = 'Didn\'t receive OTP? Resend via Email';
      btn.innerText = 'Resend via Email';
    } else {
      if (timerLbl) timerLbl.innerText = `Resend OTP in 00:${String(secs).padStart(2, '0')}`;
    }
  }, 1000);
}

async function sendLoginOtp(channel) {
  const now = Date.now();
  if (OtpFlow.sending) return;
  if (now - OtpFlow.lastRequestAt < OtpFlow.minRequestGapMs) {
    const message = 'Too many OTP requests. Please wait about 30 seconds before retrying.';
    if (channel === 'email') setTxt('loginError', message);
    else setTxt('loginPhoneError', message);
    return;
  }

  OtpFlow.sending = true;
  OtpFlow.lastRequestAt = now;
  try {
    if (channel === 'email') {
      const email = document.getElementById('loginEmail')?.value.trim();
      if (!email) { setTxt('loginError', 'Enter your email first.'); return; }
      setTxt('loginError', 'Sending code…');
      const { error } = await SB.sendEmailOtp(email, false);
      if (error) { setTxt('loginError', error); return; }
      setTxt('loginError', '');
      showOtpScreen('email', email, 'login');
    } else {
      const phone = normalizePhoneNumber(document.getElementById('loginPhone')?.value);
      const phoneInput = document.getElementById('loginPhone');
      if (phoneInput) phoneInput.value = phone;
      if (!phone || !/^\+?\d{8,15}$/.test(phone)) {
        setTxt('loginPhoneError', 'Enter number with country code, e.g. +919876543210');
        return;
      }
      setTxt('loginPhoneError', 'Sending OTP…');
      const { error } = await SB.sendPhoneOtp(phone, false);
      if (error) { setTxt('loginPhoneError', error); return; }
      setTxt('loginPhoneError', '');
      showOtpScreen('phone', phone, 'login');
    }
  } finally {
    OtpFlow.sending = false;
  }
}

async function resendOtp() {
  const btn = document.getElementById('otpResendBtn');
  const now = Date.now();
  if (OtpFlow.sending || btn?.disabled) return;
  if (now - OtpFlow.lastRequestAt < OtpFlow.minRequestGapMs) {
    setTxt('otpError', 'Too many OTP requests. Please wait about 30 seconds before retrying.');
    return;
  }
  OtpFlow.sending = true;
  OtpFlow.lastRequestAt = now;
  if (btn) btn.disabled = true;
  const allowCreate = OtpFlow.purpose === 'signup';
  const { error } = OtpFlow.channel === 'email'
    ? await SB.sendEmailOtp(OtpFlow.target, allowCreate)
    : await SB.sendPhoneOtp(OtpFlow.target, allowCreate);
  setTxt('otpError', error || 'New code sent.');
  startOtpCooldown();
  OtpFlow.sending = false;
}

async function verifyOtpCode() {
  const code = readOtpCode();
  if (code.length !== 6) { setTxt('otpError', 'Enter all 6 digits.'); return; }

  setTxt('otpError', 'Verifying…');
  const { error } = OtpFlow.channel === 'email'
    ? await SB.verifyEmailOtp(OtpFlow.target, code)
    : await SB.verifyPhoneOtp(OtpFlow.target, code);

  if (error) {
    setTxt('otpError', error);
    clearOtpBoxes();
    document.getElementById('otp-0')?.focus();
    return;
  }

  // Signup path: once the OTP verifies, the user is created and authenticated.
  // Create the workspace row now so the user can continue into the app.
  if (OtpFlow.purpose === 'signup' && OtpFlow.pendingShop) {
    const { error: shopErr } = await SB.createShopForCurrentUser(OtpFlow.pendingShop);
    if (shopErr) { setTxt('otpError', shopErr); return; }
    persistState();
    OtpFlow.pendingShop = null;
    OtpFlow.signupPassword = null;
  }

  setTxt('otpError', '');
  setDisplay('otpVerifyBlock', 'none');
  if (OtpFlow.purpose === 'signup') {
    const modal = document.getElementById('onboardingModal');
    if (modal) modal.classList.remove('hidden');
    const emailField = document.getElementById('onboardingEmail');
    if (emailField) emailField.value = OtpFlow.target || '';
    const nameField = document.getElementById('onboardingName');
    if (nameField && !nameField.value) {
      const shopName = document.getElementById('regShopName')?.value || '';
      nameField.value = shopName;
    }
    await initAuthGate();
  } else {
    await initAuthGate();
  }
}

async function signInWithEmail() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { setTxt('loginError', 'Enter email and password.'); return; }

  setTxt('loginError', 'Signing in…');
  try {
    const { error } = await SB.signIn(email, password);
    if (error) { setTxt('loginError', error); return; }
  } catch (error) {
    setTxt('loginError', 'Unable to reach Supabase. Check your internet connection and try again.');
    return;
  }

  setTxt('loginError', '');
  await initAuthGate(); // re-run: session now exists, will hydrate + show PIN block
}

async function fullSignOut() {
  await SB.signOut();
  APP_STATE.cloudSession = null;
  APP_STATE.cloudProfile = null;
  applyAuthLockState(true);
  toggleAuthMode('login');
  showQuickPinBlock(false);
}

async function registerNewBusiness() {
  const name = document.getElementById('regShopName')?.value.trim() || '';
  const phoneInput = document.getElementById('regPhone');
  const phone = normalizePhoneNumber(phoneInput?.value || '');
  if (phoneInput) phoneInput.value = phone;
  const email = document.getElementById('regEmail')?.value.trim() || '';
  const accPassword = document.getElementById('regAccPassword')?.value || '';

  if (!name) return setTxt('regError', 'Business name is required.');
  if (!phone || !/^\+?\d{8,15}$/.test(phone)) return setTxt('regError', 'Use a valid mobile number with country code, e.g. +919876543210.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return setTxt('regError', 'Enter a valid email address.');
  if (accPassword.length < 6) return setTxt('regError', 'Password must be at least 6 characters.');

  setTxt('regError', 'Sending verification code…');

  const pendingShop = { shopName: name, phone, address: 'To be updated', gstin: '', industry: 'All' };
  const { error: otpErr } = await SB.sendEmailOtp(email, true);
  if (otpErr) {
    setTxt('regError', otpErr);
    return;
  }

  OtpFlow.pendingShop = pendingShop;
  OtpFlow.signupPassword = accPassword;
  setTxt('regError', '');
  showOtpScreen('email', email, 'signup');

  const onboardingModal = document.getElementById('onboardingModal');
  if (onboardingModal) {
    onboardingModal.classList.remove('hidden');
    const emailField = document.getElementById('onboardingEmail');
    if (emailField) emailField.value = email;
    const nameField = document.getElementById('onboardingName');
    if (nameField) nameField.value = name;
  }
}

let pinBuffer = "";
function setAuthRole(role, el) {
  APP_STATE.currentUser.role = role;
  document.querySelectorAll('.role-chip').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  clearPin();
}
function pressPin(n) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += n;
  renderPinDots();
  if (pinBuffer.length === 4) verifyPin();
}
function clearPin() { pinBuffer = ""; renderPinDots(); setTxt('authError', ""); }
function backspacePin() { pinBuffer = pinBuffer.slice(0, -1); renderPinDots(); }
function renderPinDots() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`pdot-${i}`);
    if (el) el.classList.toggle('fill', i < pinBuffer.length);
  }
}
function verifyPin() {
  const p = APP_STATE.tenantProfile;
  const targetPin = APP_STATE.currentUser.role === 'Owner' ? (p.ownerPin || '1234') : (p.staffPin || '0000');

  if (pinBuffer === targetPin) {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.classList.add('hidden');
    applyRoleSecurity(APP_STATE.currentUser.role);
    applyIndustryLock();
    renderDashboard();
    renderCatalog();
    clearPin();
  } else {
    setTxt('authError', "Incorrect PIN. Please re-enter.");
    clearPin();
  }
}
function lockPOS() { 
  if (!APP_STATE.tenantProfile.ownerPin) return;
  applyAuthLockState(true);
  toggleAuthMode('login');
  showQuickPinBlock(true);
}

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
  setVal('cfgIndustrySelect', p.assignedIndustry);
  setVal('cfgUpiId', p.upiId);
  setVal('cfgTerms', p.terms);
  setVal('cfgOwnerPin', p.ownerPin);
  setVal('cfgStaffPin', p.staffPin);

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
  p.assignedIndustry = document.getElementById('cfgIndustrySelect')?.value || 'All';
  p.isLocked = (p.assignedIndustry !== 'All');

  const op = document.getElementById('cfgOwnerPin')?.value.trim();
  if (op && op.length === 4) p.ownerPin = op;
  const sp = document.getElementById('cfgStaffPin')?.value.trim();
  if (sp && sp.length === 4) p.staffPin = sp;

  persistState();
  syncProfileToDOM();
  applyIndustryLock();
  renderCatalog();
  alert("✅ Settings saved successfully!");
}

function switchSettingsTab(tabName) {
  document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
  
  const targetTab = document.getElementById(`stab-${tabName}`);
  const targetPane = document.getElementById(`setpane-${tabName}`);
  if (targetTab) targetTab.classList.add('active');
  if (targetPane) targetPane.classList.add('active');
  
  if (tabName === 'invoice') updateLivePreview();
}

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

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a'] });
      scannerInterval = setInterval(async () => {
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const scannedCode = barcodes[0].rawValue;
              handleScannedCode(scannedCode);
              closeCameraScanner();
            }
          } catch (e) {}
        }
      }, 250);
    }
  } catch (err) {
    alert("Camera access failed: " + err.message);
    closeCameraScanner();
  }
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

  setTxt('c360Name', cust.name);
  setTxt('c360Contact', `Ph: ${cust.phone} | GSTIN: ${cust.gstin || 'Unregistered'}`);
  setTxt('c360Ltv', `₹${(cust.totalOrdersVal || 0).toLocaleString('en-IN')}`);
  setTxt('c360Due', `₹${(cust.dues || 0).toLocaleString('en-IN')}`);

  const thead = document.getElementById('drillTableHead');
  const tbody = document.getElementById('drillTableBody');
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>Invoice #</th>
      <th>Date</th>
      <th>Products / Line Items</th>
      <th>Mode</th>
      <th>Status</th>
      <th style="text-align:right;">Amount</th>
    </tr>
  `;
  tbody.innerHTML = '';

  const history = cust.orderHistory || [];
  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No prior sales or replacement records found.</td></tr>`;
    return;
  }

  history.forEach(ord => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${ord.invoiceNo}</strong></td>
        <td>${ord.date}</td>
        <td>${ord.items}</td>
        <td>${ord.tender}</td>
        <td><span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:4px; ${ord.status === 'DUE' ? 'background:#fee2e2; color:var(--danger);' : 'background:#dcfce7; color:var(--success);'}">${ord.status}</span></td>
        <td style="text-align:right; font-weight:800;">₹${ord.total.toFixed(2)}</td>
      </tr>
    `;
  });
}

/* ==========================================================================
   INWARD PURCHASE & AI OCR (ONLINE RESTRICTED)
   ========================================================================== */
function openInwardPurchaseModal() {
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
  const existing = APP_STATE.inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
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
  if (sheet) sheet.style.setProperty('--invoice-accent', profile.accent);

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
    text("Thank you! Visit Again\n\n\n");
    append([0x1D, 0x56, 0x42, 0x00]);

    return new Uint8Array(bytes);
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

function closeReportDetail() {
  setDisplay('reportsDetailView', 'none');
  setDisplay('reportsHubView', 'block');
}

function renderActiveReportData() {
  const thead = document.getElementById('drillTableHead');
  const tbody = document.getElementById('drillTableBody');
  if (!thead || !tbody) return;
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (APP_STATE.currentReportKey === 'party_outstanding') {
    thead.innerHTML = `<tr><th>Party Name</th><th>Category</th><th>Phone</th><th style="text-align:right;">Closing Balance</th></tr>`;
    APP_STATE.customers.forEach(c => {
      tbody.innerHTML += `<tr><td><strong>${c.name}</strong></td><td>${c.category || 'Retail'}</td><td>${c.phone}</td><td style="text-align:right; font-weight:700;">₹${c.dues.toFixed(2)}</td></tr>`;
    });
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
    thead.innerHTML = `<tr><th>Product</th><th>Category</th><th style="text-align:right;">Stock Qty</th><th style="text-align:right;">Cost/Unit</th><th style="text-align:right;">Value at Cost</th><th style="text-align:right;">Value at Selling Price</th></tr>`;
    let totalCostVal = 0, totalSellVal = 0;
    APP_STATE.inventory.forEach(i => {
      const costVal = r2((i.cost || 0) * i.stock);
      const sellVal = r2((i.price || 0) * i.stock);
      totalCostVal = r2(totalCostVal + costVal);
      totalSellVal = r2(totalSellVal + sellVal);
      tbody.innerHTML += `<tr><td><strong>${i.name}</strong></td><td>${i.category}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">₹${(i.cost || 0).toFixed(2)}</td><td style="text-align:right;">₹${costVal.toFixed(2)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`;
    });
    tbody.innerHTML += `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL STOCK VALUATION</td><td style="text-align:right;">₹${totalCostVal.toFixed(2)}</td><td style="text-align:right;">₹${totalSellVal.toFixed(2)}</td></tr>`;
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
  
  if (el) el.classList.add('active');
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

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
      const status = s.tender === 'Khata' ? 'DUE' : 'PAID';
      const badgeColor = status === 'DUE' ? 'background:#fee2e2; color:var(--danger);' : 'background:#dcfce7; color:var(--success);';
      recentBody.innerHTML += `<tr><td><strong>${s.invoiceNo}</strong></td><td>${s.customer?.name || 'Cash Customer'}</td><td>${s.date}</td><td><span style="font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:4px; ${badgeColor}">${status}</span></td><td style="text-align:right; font-weight:700;">₹${(s.total || 0).toFixed(2)}</td></tr>`;
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
}

function loadPrinterAndGstSettingsIntoDOM() {
  const p = APP_STATE.tenantProfile;
  setVal('cfgPrinterFormat', p.printerFormat || 'a4');
  setVal('cfgThermalWidth', String(p.thermalWidth || 80));
  setVal('cfgGstSlabs', GstConfig.getSlabs().join(', '));
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
window.pressPin = pressPin;
window.clearPin = clearPin;
window.backspacePin = backspacePin;
window.setAuthRole = setAuthRole;
window.toggleAuthMode = toggleAuthMode;
window.registerNewBusiness = registerNewBusiness;
window.signInWithEmail = signInWithEmail;
window.setLoginMethod = setLoginMethod;
window.sendLoginOtp = sendLoginOtp;
window.verifyOtpCode = verifyOtpCode;
window.resendOtp = resendOtp;
window.cancelOtpFlow = cancelOtpFlow;
window.onOtpInput = onOtpInput;
window.onOtpKeydown = onOtpKeydown;
window.onCustomerStateChange = onCustomerStateChange;
window.onCustomerGstinInput = onCustomerGstinInput;
window.updateTaxTypeHint = updateTaxTypeHint;
window.saveGstSlabs = saveGstSlabs;
window.onPrinterFormatChange = onPrinterFormatChange;
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
window.switchSettingsTab = switchSettingsTab;
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
  applyAuthLockState(true);
  initAuthGate();
  updateNetworkStatus();
  if (APP_STATE.cloudSession && APP_STATE.cloudProfile) {
    renderDashboard();
    renderCatalog();
  }
  updateTaxTypeHint();
  setTxt('pDate', new Date().toLocaleDateString('en-IN'));
});
