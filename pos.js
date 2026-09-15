/* ==========================================================================
   BILLNAW — POS / CART ENGINE (part 1: item modal + cart, not checkout)
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). The per-item attribute
   modal (serial/IMEI/HUID/batch capture per industry), committing a
   configured item into the cart with its computed line tax, cart render/
   remove, tender selection, and step navigation between POS screens.

   This is the first of two POS slices, deliberately split: this one adds
   items to and manages the in-memory cart, but never calls a save/commit
   RPC — nothing here can create, modify, or delete a financial record.
   checkoutBill() itself (the function that actually calls the
   create_invoice_atomic RPC and commits a sale) is the single highest-
   stakes function left in app.js and is being extracted separately, on
   its own, with correspondingly heavier verification — not bundled in
   here just because it's textually adjacent.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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

window.openItemModal = openItemModal;
window.closeModal = closeModal;
window.r2 = r2;
window.commitModalItem = commitModalItem;
window.renderCart = renderCart;
window.removeCart = removeCart;
window.setTender = setTender;
window.setStep = setStep;
window.jumpToStep = jumpToStep;
