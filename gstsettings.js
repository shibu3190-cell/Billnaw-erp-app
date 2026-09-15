/* ==========================================================================
   BILLNAW — CUSTOMER PARTY ENTRY, GST & PRINTER SETTINGS
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). POS customer-entry state
   fields (place-of-supply dropdown, live CGST/SGST-vs-IGST tax-type hint —
   uses TaxEngine.isInterstate/resolvePlaceOfSupply from gstConfig.js), and
   the GST-slab / printer-hardware panels under Settings.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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

window.populateStateDropdowns = populateStateDropdowns;
window.resetCustomerStateToShopDefault = resetCustomerStateToShopDefault;
window.onCustomerStateChange = onCustomerStateChange;
window.onCustomerGstinInput = onCustomerGstinInput;
window.updateTaxTypeHint = updateTaxTypeHint;
window.saveGstSlabs = saveGstSlabs;
window.onPrinterFormatChange = onPrinterFormatChange;
window.savePrinterSettings = savePrinterSettings;
window.loadPrinterAndGstSettingsIntoDOM = loadPrinterAndGstSettingsIntoDOM;
