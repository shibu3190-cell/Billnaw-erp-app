/* ==========================================================================
   BILLNAW — AUTHENTICATION ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). OTP (phone/email) + Google
   OAuth login/registration flow, session gate/bootstrap, cloud-data
   hydration on sign-in, and sign-out. This is the highest-stakes slice
   extracted so far: it is the code that establishes and tears down the
   Supabase session AUDIT_REPORT.md/SECURITY_REPORT.md both describe as
   the app's sole access boundary (RLS is what actually decides what a
   session can read/write — this file does not change that boundary in
   any way, only where the code that drives it physically lives).

   The verification process for the Purchases slice (3df016a) caught a
   real bug: a top-level `APP_STATE.foo = ...` statement, safe in the
   original app.js only because it ran after APP_STATE's own top-level
   declaration in the same script, threw when moved into a file that
   loads before app.js. This file had exactly that pattern too --
   `APP_STATE.cloudSession = null; APP_STATE.cloudProfile = null;` sat at
   top level right after this section's original header comment. Fixed
   the same way: moved inside initAuthGate(), the actual auth-bootstrap
   entry point, which already ran before anything reads those fields (see
   the comment at the top of initAuthGate() below for the full reasoning,
   including why every existing read of these fields -- always a falsy
   check, never a strict `=== null` -- made this safe either way).

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

/* ==========================================================================
   AUTHENTICATION — OTP ONLY
   The Supabase session is the sole access boundary; RLS decides what it
   can read. There is no PIN: a 4-digit code stored in localStorage was
   readable and editable by anyone with devtools, so it protected nothing
   while creating the impression that it did.
   ========================================================================== */
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
  // Was two top-level `APP_STATE.cloudSession = null; APP_STATE.cloudProfile
  // = null;` statements right after AuthFlow's own section header before
  // this file was extracted from app.js — safe there because they ran
  // after APP_STATE's own top-level declaration in the same script. This
  // file loads before app.js defines APP_STATE, so the same reset moved
  // here, the actual auth-bootstrap entry point, which is called before
  // anything reads these fields (every existing read is a falsy check —
  // `!APP_STATE.cloudSession` / `APP_STATE.cloudSession &&` — never a
  // strict `=== null`, so `undefined` behaves identically to `null` in
  // the brief window before this runs regardless).
  APP_STATE.cloudSession = null;
  APP_STATE.cloudProfile = null;

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

window.initAuthGate = initAuthGate;
window.enterApp = enterApp;
window.showStep = showStep;
window.showRequestStep = showRequestStep;
window.showRegisterStep = showRegisterStep;
window.renderWizardDots = renderWizardDots;
window.setLoginMethod = setLoginMethod;
window.buildCountryList = buildCountryList;
window.toggleCountryList = toggleCountryList;
window.pickCountry = pickCountry;
window.onPhoneInput = onPhoneInput;
window.requestOtp = requestOtp;
window.openOtpStep = openOtpStep;
window.maskTarget = maskTarget;
window.startResendTimer = startResendTimer;
window.editOtpTarget = editOtpTarget;
window.resendOtp = resendOtp;
window.clearOtpBoxes = clearOtpBoxes;
window.readOtpCode = readOtpCode;
window.onOtpInput = onOtpInput;
window.onOtpKeydown = onOtpKeydown;
window.onOtpPaste = onOtpPaste;
window.verifyOtpCode = verifyOtpCode;
window.signInWithGoogle = signInWithGoogle;
window.submitRegistration = submitRegistration;
window.onRegGstinInput = onRegGstinInput;
window.pickIndustry = pickIndustry;
window.finishOnboarding = finishOnboarding;
window.hydrateTenantFromShop = hydrateTenantFromShop;
window.hydrateCloudData = hydrateCloudData;
window.setAuthBusy = setAuthBusy;
window.fullSignOut = fullSignOut;
window.lockPOS = lockPOS;
