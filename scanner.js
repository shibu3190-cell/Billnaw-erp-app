/* ==========================================================================
   BILLNAW — CAMERA BARCODE & QR SCANNER ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Opens the device camera,
   uses the Shape Detection API (BarcodeDetector) when available to read
   barcodes/QR codes from the live video feed, plus manual code entry and
   beep feedback. No financial or inventory-mutating logic — purely an
   input method that ends by populating the same fields a manual barcode
   scan or search would.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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

window.openCameraScanner = openCameraScanner;
window.beepScanFeedback = beepScanFeedback;
window.toggleScanContinuous = toggleScanContinuous;
window.submitManualScan = submitManualScan;
window.closeCameraScanner = closeCameraScanner;
window.handleScannedCode = handleScannedCode;
