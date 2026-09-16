/* ==========================================================================
   BILLNAW — AUTHENTICATION ENGINE
   Extracted verbatim from app.js (Phase 4 continuation of the modernization
   migration — structural relocation only, no logic changed). OTP-only
   sign-in/registration flow: auth overlay lock state, password-field
   visibility toggle, phone-number normalization, the AuthFlow state object
   and COUNTRY_CODES table, the auth gate boot check, step navigation
   (request/OTP/register/profile), channel + country-code selection, OTP
   send/resend/verify with the resend countdown timer, Google OAuth
   sign-in, registration submission and industry/GSTIN handling for
   onboarding, shop-record hydration into APP_STATE after
   login/registration, and sign-out/lock.

   There is no PIN: a 4-digit code stored in localStorage was readable and
   editable by anyone with devtools, so it protected nothing while creating
   the impression that it did. The Supabase session is the sole access
   boundary; RLS decides what it can read.

   Deliberately excludes several functions/blocks that sit physically among
   these in app.js but aren't auth-flow UI, each checked individually:
     - esc/escJs/fmtCost (generic HTML/string-escaping helpers used
       everywhere in the app, not auth-specific) and applyRoleSecurity
       (role-based UI visibility) sit interleaved just above the auth
       section header in app.js but are NOT part of this extraction.
       applyRoleSecurity in particular is pinned to app.js by
       tests/permissions-parity.js, which reads it directly out of
       app.js's source text (`fs.readFileSync(... 'app.js')` +
       `indexOf('function applyRoleSecurity(role) {')`) to eval and test
       the live function against a typed TS port — moving it would break
       that harness, not just this extraction's own parity test.
     - The whole "OFFLINE-FIRST SYNC ENGINE" block (isFatalSyncError,
       reportRpcSkipWarnings, SyncEngine, updateSyncIndicator,
       updateLastSyncedLabel, refreshFromCloud) sits between
       togglePasswordVisibility and the "AUTHENTICATION — OTP ONLY" banner
       in app.js. It is sync/queue infrastructure used by POS/checkout and
       purchases/returns as much as by auth — left in app.js.
     - hydrateCloudData(shopId) is physically interleaved inside the auth
       block (between hydrateTenantFromShop and setAuthBusy) and IS called
       from initAuthGate(), but it is NOT auth-flow UI — it's the
       data-pull-from-cloud routine (items/customers/sales/purchases/
       returns) plus invoice-counter repair logic, and it is also called
       from refreshFromCloud() in the offline-sync block above (outside
       the auth region), making it a cross-cutting data-integrity function
       rather than something that exists purely to drive the login/OTP/
       registration UI. Left in app.js; auth.js calls it by name exactly
       as every other extracted engine calls into app.js globals.

   Depends on globals defined elsewhere and relies on the fact that classic
   (non-module) <script> tags share one top-level lexical scope across the
   whole page — APP_STATE, $id/$q/$qa (dom.js), esc/setTxt/setDisplay/
   setVal/showSaasToast/persistState/applyRoleSecurity/hydrateCloudData/
   renderDashboard/renderCatalog (app.js), applyIndustryLock (settings.js),
   loadPrinterAndGstSettingsIntoDOM/syncProfileToDOM/applyShopLogo/
   resetCustomerStateToShopDefault (settings.js/customers.js),
   populateStateDropdowns (customers.js), GST_STATE_CODES (gstConfig.js),
   SyncEngine (app.js), SB (supabaseClient.js) are all resolved at call
   time, same as every other extracted engine file.

   Cross-cutting call sites to note (checked via grep across the whole
   file, not assumed):
     - applyAuthLockState() and lockPOS() are called from outside this
       file: lockPOS() is wired to the "Lock POS" button in index.html
       (`onclick="lockPOS()"`), and applyAuthLockState is additionally
       exposed as `window.applyAuthLockState` near the end of app.js.
       Both keep working unchanged — classic global scope means any
       script can call any other script's top-level function regardless
       of which file defines it, as long as auth.js loads before it's
       first invoked (it does; see index.html script order).
     - normalizePhoneNumber() was checked across the whole file and is
       only ever called from requestOtp() inside this same auth block, so
       it moved here rather than staying behind as a cross-file helper.

   Load order relative to app.js does not matter for the reason above, but
   this loads alongside the other extracted engines (before app.js, after
   supabaseClient.js since the auth flow calls SB.*) to keep the
   convention consistent and easy to scan in index.html.
   ========================================================================== */

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
   AUTHENTICATION — OTP ONLY
   The Supabase session is the sole access boundary; RLS decides what it
   can read. There is no PIN: a 4-digit code stored in localStorage was
   readable and editable by anyone with devtools, so it protected nothing
   while creating the impression that it did.
   ========================================================================== */
// cloudSession/cloudProfile defaults moved to initAppStateDefaults()
// (near persistState(), called from bootApp() after the IndexedDB load
// resolves) — this used to be top-level script code that ran before the
// (then-synchronous) storage load, now it would run BEFORE an async load
// resolves and silently wipe a value the load just set. See that
// function for every relocated default and why each one is here.

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
