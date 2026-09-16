/* ==========================================================================
   BILLNAW — POS / CHECKOUT ENGINE
   Extracted verbatim from app.js (Phase 4, final increment of the
   modernization migration — structural relocation only, no logic changed).
   This is the last remaining piece of the app.js breakup described in
   docs/MIGRATION_PLAN.md.

   Covers the counter-facing POS flow end to end: the UPI QR code renderer,
   the camera/barcode scanner engine, the item-attribute modal (serial/HUID
   /batch capture per industry), the cart (render/commit/remove/tender/step
   navigation), out-of-stock alternative suggestions, the post-checkout
   invoice-action popup (download/print/edit-contact/cancel-via-return),
   checkout itself (reserveInvoiceNumber, checkoutBill, syncInvoiceToCloud),
   and invoice printing (industry theming, the A4 template renderer, the
   HSN-wise tax breakup table).

   Explicit stop condition from MIGRATION_PLAN.md: "any extraction that
   would require changing how AuthFlow, SyncEngine, or the checkout/invoice
   RPC call sequence work is NOT a Phase 4 change." Nothing here changes
   any of those three things:
     - SyncEngine (the offline queue) stays in app.js untouched. This file
       calls SyncEngine.enqueue()/generateIdempotencyKey() etc. exactly as
       app.js did — safe purely because classic <script> tags share one
       global scope, so which file DECLARES a symbol doesn't affect which
       files can CALL it, regardless of <script> load order (only
       top-level code that runs immediately at parse time would care about
       ordering, and this file has none — every top-level statement below
       is a function/const declaration).
     - AuthFlow (now in auth.js) is never referenced here.
     - checkoutBill()'s and syncInvoiceToCloud()'s internals — the exact
       sequence of reserveInvoiceNumber() -> build invoice -> push to
       APP_STATE.sales -> decrement stock -> update customer ledger ->
       syncInvoiceToCloud() (fire-and-forget) -> print -> reset cart — are
       copied byte-for-byte. SB.saveSale() still does invoice-insert +
       stock-decrement + customer-ledger-upsert atomically server-side via
       create_invoice_atomic; nothing here calls decrementStock/
       upsertCustomer separately, matching the fix already landed in
       app.js history.

   Cross-file dependencies (all safe under shared classic-script global
   scope, same pattern as every prior Phase 4 extraction):
     - APP_STATE, SyncEngine, isFatalSyncError, reportRpcSkipWarnings,
       persistState, persistMeta, updateSyncIndicator — app.js (core infra,
       explicitly NOT extracted per the stop condition above).
     - $id/$q/$qa, setTxt/setVal/setDisplay — dom.js / app.js.
     - esc/escJs/fmtCost, showSaasToast — app.js (generic helpers, used
       everywhere, not POS-specific, so left in app.js).
     - SB (Supabase client) — supabaseClient.js.
     - TaxEngine — gst engine module (loaded before this file).
     - GST_STATE_CODES, INDUSTRY_TRACK_MAP — reference data modules.
     - findAlternatives, getExpiryAlerts, getLowStockItems,
       getAlertThresholds — alertEngine.js.
     - PrinterEngine.dispatchPrint — printerEngine.js.
     - exportToExcel — exportEngine.js (not used directly by POS, but
       r2()/setStep()/updateTaxTypeHint() below are called from
       customers.js and reports.js too — fine for the same reason as
       every other cross-file call in this app).
     - renderDashboard, renderCatalog, renderAlertCentre, switchView,
       resetCustomerStateToShopDefault, updateTaxTypeHint — app.js/
       reports.js/inventory.js/customers.js (called after checkout to
       refresh other screens; none of their internals were touched).
     - openReturnModal — returns.js (iapOpenCancel hands off to the
       existing return flow rather than inventing a cancellation path).
     - qrcode() — vendor/qrcode.js (vendored QR generator library).

   r2() (2-decimal rounding helper) moves here because every remaining
   call site after all prior extractions is POS cart rendering
   (renderCart/commitModalItem in this file) plus reports.js's day-total
   accumulation (reports.js calls the global r2, unaffected by which file
   declares it, per the cross-file note above).

   setStep()/jumpToStep() move here as the POS checkout wizard-step
   helpers; customers.js's autoFillCustomer() calls the global setStep(3)
   to jump the wizard forward after auto-filling a known customer, which
   keeps working unchanged for the same shared-global-scope reason.

   Nothing was left behind as "would require touching protected core
   infra" — every candidate function in this extraction's scope moved
   cleanly with zero changes to SyncEngine, AuthFlow, or the checkout RPC
   sequence.
   ========================================================================== */

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
        <td><strong>${esc(it.name)}</strong><br><small style="color:var(--text-muted);">${it.assignedIdentifier ? 'ID: ' + esc(it.assignedIdentifier) : 'Untracked'} • ${it.gst}% GST</small></td>
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
    const { data, error, errorCode } = await SB.saveSale(shopId, invoice);

    // A duplicate idempotency_key means this exact sale is already committed
    // (a retry landed twice). That's success, not failure — re-queuing it
    // would loop forever.
    if (isFatalSyncError(error, errorCode)) throw new Error(error);

    // Keep the server-assigned row id so returns can be raised against this
    // invoice without a round-trip to look it up.
    if (data && data.sale_id) {
      invoice.cloudId = data.sale_id;
      const local = APP_STATE.sales.find(s => s.idempotency_key === invoice.idempotency_key);
      if (local) local.cloudId = data.sale_id;
      persistState();
    }
    reportRpcSkipWarnings(data);
    updateSyncIndicator();
  } catch (err) {
    console.warn('Cloud sync failed, queued for retry:', err.message);
    SyncEngine.enqueue(invoice);
    updateSyncIndicator();
  }
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
