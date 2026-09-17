/* ==========================================================================
   BILLNAW — BARCODE HARDWARE INTERCEPTOR & MOBILE SEARCH EXPANSION
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Two small, unrelated,
   self-contained pieces bundled together because both are tiny and each
   sat physically wedged between large blocks of legacy
   `window.foo = foo` re-exposure statements in app.js (a pre-existing
   "GLOBAL SCOPE ATTACHMENT" section that predates this migration —
   left exactly where it is; those lines are functionally inert wherever
   they live, since they just re-assign window.foo to whatever `foo`
   already resolves to via the shared script scope, so moving or not
   moving them changes nothing observable, and auditing which of the many
   entries are now redundant duplicates of an extracted file's own
   window exposure is a separate cleanup task, not this one):

   1. Hardware Barcode Interceptor — captures rapid keypress input from a
      USB/Bluetooth barcode-scanner "keyboard wedge" device (real
      keyboards can't type fast enough to trigger the buffer/timeout
      pattern here) and routes a completed scan to handleScannedCode()
      (scanner.js).
   2. expandMobileSearch() — expands the collapsed global search box on
      narrow viewports; a no-op on desktop widths.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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

function expandMobileSearch(e) {
  const box = $id('globalSearchBox');
  if (!box || box.classList.contains('expanded')) return;
  if (window.innerWidth > 640) return; // desktop is always expanded, nothing to do
  box.classList.add('expanded');
  $id('globalSearchInput')?.focus();
}

window.expandMobileSearch = expandMobileSearch;
