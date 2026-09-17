/* ==========================================================================
   BILLNAW — PWA UPDATE FLOW & APP BOOTSTRAP
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). This is the LAST
   remaining functional code from the original app.js monolith: the PWA
   update-banner flow (detects a waiting service worker, only activates it
   once the user taps "Update Now" — see comment below) and, critically,
   the window.addEventListener('DOMContentLoaded', ...) block that is the
   actual application bootstrap — it's what calls initAuthGate() and every
   other startup routine.

   This is the highest-stakes structural-only extraction in the whole
   Phase 4 migration in one specific sense: it is not a feature that can
   fail in isolation like checkoutBill() or submitReturn() — if this file
   fails to load or this listener never fires, NOTHING in the app starts.
   Given that, this got the same explicit-approval-worthy scrutiny as the
   checkout/auth extractions:

   - The top-level `if ('serviceWorker' in navigator) {...}` block and the
     `window.addEventListener('DOMContentLoaded', ...)` block are both
     genuinely safe regardless of where this script loads relative to
     app.js, for two different reasons: the service-worker block only
     references showUpdateBanner/waitingWorker/refreshingPage, all defined
     in this same file; and DOMContentLoaded, by definition, only fires
     after every <script> tag on the page (including app.js, loaded last)
     has finished executing its own top-level code — so every function the
     bootstrap callback calls (populateStateDropdowns, initAuthGate,
     renderDashboard, renderCatalog, etc., scattered across a dozen
     extracted files plus app.js itself) is guaranteed to already exist by
     the time this callback actually runs, exactly the same guarantee that
     already made inline onclick="..." handlers and auth.js's
     initAuthGate() work correctly throughout this migration.
   - Verified with a real headless-browser run that DOMContentLoaded fires
     and the bootstrap sequence executes correctly after this file was
     physically moved (see the commit message for what was checked).

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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
