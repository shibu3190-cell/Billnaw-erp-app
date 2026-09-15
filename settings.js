/* ==========================================================================
   BILLNAW — SETTINGS ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Settings-panel state
   read/write, industry-lock enforcement, GST/compliance panel, industry
   vertical panel, and the staff list panel.

   Depends on globals defined elsewhere and relies on the fact that classic
   (non-module) <script> tags share one top-level lexical scope across the
   whole page — APP_STATE, setTxt/setVal, $id/$qa (dom.js), GstConfig
   (gstConfig.js), esc (app.js), persistState/renderCatalog/showSaasToast/
   switchView (app.js), SB (supabaseClient.js) are all resolved at call
   time, same as every other extracted engine file.

   Load order relative to app.js does not matter for that reason, but this
   loads alongside the other extracted engines (before app.js) to keep the
   convention consistent and easy to scan in index.html.
   ========================================================================== */

/* ==========================================================================
   TENANT INDUSTRY LOCK
   ========================================================================== */
function applyIndustryLock() {
  const profile = APP_STATE.tenantProfile;
  const chipContainer = $id('sectorChipsBar');
  const dlField = $id('custDrugLicense');
  if (dlField) dlField.style.display = profile.assignedIndustry === 'Pharmacy' ? 'block' : 'none';

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
  setVal('cfgDrugLicenseNo', p.drugLicenseNo || '');
  setVal('cfgPanNumber', p.panNumber || '');

  // Drug License only matters for a pharmacy — hidden for every other
  // vertical rather than shown as a field nobody in, say, jewellery needs.
  const dlRow = $id('cfgDrugLicenseRow');
  if (dlRow) dlRow.style.display = p.assignedIndustry === 'Pharmacy' ? 'block' : 'none';

  setTxt('pStoreName', p.shopName);
  setTxt('pStoreAddr', p.address);
  setTxt('pGstin', p.gstin || 'Unregistered');
  setTxt('pStorePhone', p.phone);
  setTxt('pBankDisplay', `${p.bankName} • A/C: ${p.bankAcc} • IFSC: ${p.bankIfsc}`);
  setTxt('pUpiDisplay', p.upiId);
  setTxt('pTermsDisplay', p.terms);

  const dlDisplay = $id('pDrugLicenseRow');
  if (dlDisplay) {
    dlDisplay.style.display = (p.assignedIndustry === 'Pharmacy' && p.drugLicenseNo) ? 'block' : 'none';
    setTxt('pDrugLicenseNo', p.drugLicenseNo || '');
  }
  const panDisplay = $id('pPanRow');
  if (panDisplay) {
    panDisplay.style.display = p.panNumber ? 'block' : 'none';
    setTxt('pPanNumber', p.panNumber || '');
  }
}

function saveAllSettings() {
  const p = APP_STATE.tenantProfile;
  p.shopName = $id('cfgName')?.value.trim() || p.shopName;
  p.gstin = $id('cfgGst')?.value.trim() || '';
  p.phone = $id('cfgPhone')?.value.trim() || '';
  p.address = $id('cfgAddress')?.value.trim() || '';
  p.upiId = $id('cfgUpiId')?.value.trim() || '';
  p.terms = $id('cfgTerms')?.value.trim() || '';
  p.bankName = $id('cfgBankName')?.value.trim() || '';
  p.bankAcc = $id('cfgBankAcc')?.value.trim() || '';
  p.drugLicenseNo = $id('cfgDrugLicenseNo')?.value.trim() || '';
  p.panNumber = $id('cfgPanNumber')?.value.trim().toUpperCase() || '';
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
      upi_id: p.upiId, terms: p.terms, bank_name: p.bankName, bank_acc: p.bankAcc,
      drug_license_no: p.drugLicenseNo || null, pan_number: p.panNumber || null
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
  $qa('.settings-panel').forEach(p => p.classList.remove('open'));
  const panel = $id(`panel-${key}`);
  const backdrop = $id('settingsPanelBackdrop');
  if (!panel) return;
  panel.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  document.body.classList.add('settings-panel-active');

  if (key === 'hardware') updateLivePreview();
  if (key === 'gst') loadComplianceSettingsIntoDOM();
  if (key === 'industry') loadIndustrySettingsIntoDOM();
  if (key === 'staff') loadStaffPanel();
  if (key === 'subscription') loadSubscriptionPanel();
}

function closeSettingsPanel() {
  $qa('.settings-panel.open').forEach(p => p.classList.remove('open'));
  const backdrop = $id('settingsPanelBackdrop');
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
  const item = $id(accId);
  if (item) item.classList.toggle('open');
}

function updateLivePreview() {
  const p = APP_STATE.tenantProfile;
  setTxt('pvShopName', $id('cfgName')?.value || p.shopName);
  setTxt('pvAddress', $id('cfgAddress')?.value || p.address);
  setTxt('pvGst', $id('cfgGst')?.value || p.gstin);
  setTxt('pvPhone', $id('cfgPhone')?.value || p.phone);
  const bank = $id('cfgBankName')?.value || p.bankName || '';
  const acc = $id('cfgBankAcc')?.value || p.bankAcc || '';
  const upi = $id('cfgUpiId')?.value || p.upiId || '';
  setTxt('pvBankInfo', bank ? `${bank} • A/C: ${acc}` : 'Add bank details above');
  setTxt('pvUpiInfo', upi ? `UPI: ${upi}` : 'Add a UPI ID to enable scan-to-pay');
}

/* ---------- GST & Compliance panel ---------- */
function loadComplianceSettingsIntoDOM() {
  const p = APP_STATE.tenantProfile;
  GstConfig.refreshAllRateSelects();
  setVal('cfgDefaultGst', p.defaultGstRate != null ? String(p.defaultGstRate) : '18');
  setVal('cfgDefaultHsn', p.defaultHsn || '');
  const hsnChk = $id('cfgMandatoryHsn');
  if (hsnChk) hsnChk.checked = !!p.mandatoryHsn;
  const roundChk = $id('cfgShowRoundOff');
  if (roundChk) roundChk.checked = p.showRoundOff !== false;
  const inc = $id('cfgGstPriceModeInclusive');
  const exc = $id('cfgGstPriceModeExclusive');
  if (inc) inc.checked = (p.gstPriceMode || 'exclusive') === 'inclusive';
  if (exc) exc.checked = (p.gstPriceMode || 'exclusive') === 'exclusive';
  setVal('cfgLowStock', String(p.lowStockThreshold ?? 5));
  setVal('cfgExpiryDays', String(p.expiryWarnDays ?? 30));
}

function saveComplianceSettings() {
  const p = APP_STATE.tenantProfile;
  p.defaultGstRate = parseFloat($id('cfgDefaultGst')?.value) || 18;
  p.defaultHsn = $id('cfgDefaultHsn')?.value.trim() || '';
  p.mandatoryHsn = !!$id('cfgMandatoryHsn')?.checked;
  p.showRoundOff = !!$id('cfgShowRoundOff')?.checked;
  p.gstPriceMode = $id('cfgGstPriceModeInclusive')?.checked ? 'inclusive' : 'exclusive';
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
  const pill = $id('industryLockPill');
  const desc = $id('industryLockDesc');
  const toggleBlock = $id('industryToggleBlock');

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
    const chk = $id('cfgRequireIdentifier');
    if (chk) chk.checked = !!p.requireIdentifier;
  } else if (toggleBlock) {
    toggleBlock.style.display = 'none'; // Universal/Grocery: nothing to enforce here
  }
}

function saveIndustrySettings() {
  APP_STATE.tenantProfile.requireIdentifier = !!$id('cfgRequireIdentifier')?.checked;
  persistState();
}

/* ---------- Staff & Roles panel ---------- */
async function loadStaffPanel() {
  const tbody = $id('staffTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Loading…</td></tr>`;

  if (!APP_STATE.cloudSession || !APP_STATE.tenantProfile.shopId) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Sign in to view staff.</td></tr>`;
    return;
  }

  const { data, error } = await SB.fetchShopStaff(APP_STATE.tenantProfile.shopId);
  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--danger);">${esc(error)}</td></tr>`;
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
      <td><strong>${esc(m.full_name || 'Unnamed')}</strong></td>
      <td><span class="pill ${m.role === 'owner' ? 'info' : 'draft'}">${roleLabel}</span></td>
      <td>${canSeeCost ? '<span class="pill paid">Visible</span>' : '<span class="pill overdue">Hidden</span>'}</td>
    </tr>`;
  }).join('');
}

window.applyIndustryLock = applyIndustryLock;
window.syncProfileToDOM = syncProfileToDOM;
window.saveAllSettings = saveAllSettings;
window.openSettingsHome = openSettingsHome;
window.openSettingsPanel = openSettingsPanel;
window.closeSettingsPanel = closeSettingsPanel;
window.toggleAccordion = toggleAccordion;
window.updateLivePreview = updateLivePreview;
window.loadComplianceSettingsIntoDOM = loadComplianceSettingsIntoDOM;
window.saveComplianceSettings = saveComplianceSettings;
window.INDUSTRY_TRACK_MAP = INDUSTRY_TRACK_MAP;
window.loadIndustrySettingsIntoDOM = loadIndustrySettingsIntoDOM;
window.saveIndustrySettings = saveIndustrySettings;
window.loadStaffPanel = loadStaffPanel;
