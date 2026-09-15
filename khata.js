/* ==========================================================================
   BILLNAW — KHATA (PARTY LEDGER) & VENDOR ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). The Khata credit-ledger
   view (customers owe the shop; vendors are owed by the shop — settling
   one never touches the other), vendor profile edit, settlement recording,
   WhatsApp reminder, Khata Excel export, and the pharmacy same-molecule
   alternative-suggestion UI glue (showAlternativesFor/selectAlternative —
   contiguous with this section in the original file; the underlying
   findAlternatives() matching logic itself lives in src/services/alerts).

   The default Khata view-state fields (vendors, khataTab, khataSearch,
   khataFilter) used to be set via top-level `APP_STATE.vendors =
   APP_STATE.vendors || []; APP_STATE.khataTab = 'customers'; ...`
   statements right above this section in app.js — the same load-order
   hazard caught in the purchases.js/auth.js extractions, since this file
   loads before app.js defines APP_STATE. Unlike those two cases, moving
   khataTab's reset into a function was NOT safe here: khataTab must
   persist across Khata-view navigations (renderKhataView() runs every
   time the user opens the tab), so resetting it there would silently
   discard the user's active tab choice on every revisit. Fixed instead by
   folding these four fields directly into the APP_STATE object literal in
   app.js, which preserves the exact same one-time-at-load initialization
   with no load-order dependency at all.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

/* ==========================================================================
   KHATA — PARTY LEDGER (Customers + Vendors)
   Two distinct debt directions: customers owe the shop (receivable),
   vendors are owed BY the shop (payable). Settling one never touches the
   other's balance. Vendors already existed in Supabase (migration 0007)
   but were never fetched into APP_STATE — invisible data until this.
   ========================================================================== */
function setKhataTab(tab) {
  APP_STATE.khataTab = tab;
  $id('khataTabCustomers')?.classList.toggle('active', tab === 'customers');
  $id('khataTabVendors')?.classList.toggle('active', tab === 'vendors');
  renderKhataView();
}

async function renderKhataView() {
  if (APP_STATE.khataTab === 'vendors' && !APP_STATE.vendorsLoaded && APP_STATE.cloudSession) {
    const { data } = await SB.fetchVendors(APP_STATE.tenantProfile.shopId);
    APP_STATE.vendors = (data || []).map(v => ({
      id: v.id, name: v.name, phone: v.phone || '', gstin: v.gstin || '',
      pan: v.pan || '', drugLicenseNo: v.drug_license_no || '',
      address: v.address || '', payables: Number(v.payables) || 0,
      isStarred: !!v.is_starred
    }));
    APP_STATE.vendorsLoaded = true;
  }

  const isVendorTab = APP_STATE.khataTab === 'vendors';
  let list = isVendorTab ? APP_STATE.vendors : APP_STATE.customers;
  const grid = $id('khataGrid');
  const summaryRow = $id('khataSummaryRow');
  if (!grid) return;

  const balanceOf = p => isVendorTab ? (p.payables || 0) : (p.dues || 0);

  const q = (APP_STATE.khataSearch || '').trim().toLowerCase();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.phone || '').includes(q));

  if (APP_STATE.khataFilter === 'starred') list = list.filter(p => p.isStarred);
  else if (APP_STATE.khataFilter === 'frequent') list = list.filter(p => p.isFrequent || p.isStarred);
  else if (APP_STATE.khataFilter === 'due') list = list.filter(p => balanceOf(p) > 0.005);

  const owingAll = (isVendorTab ? APP_STATE.vendors : APP_STATE.customers).filter(p => balanceOf(p) > 0.005);
  const totalOwed = TaxEngine.round2(owingAll.reduce((s, p) => s + balanceOf(p), 0));

  if (summaryRow) {
    summaryRow.innerHTML = `
      <div class="khata-stat">
        <span class="khata-stat-label">${isVendorTab ? 'You owe suppliers' : 'Customers owe you'}</span>
        <strong class="khata-stat-value ${isVendorTab ? 'danger' : 'ok'}">₹${totalOwed.toLocaleString('en-IN')}</strong>
      </div>
      <div class="khata-stat">
        <span class="khata-stat-label">Parties with a balance</span>
        <strong class="khata-stat-value">${owingAll.length}</strong>
      </div>`;
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="es-ico">${isVendorTab ? '🚚' : '👥'}</div>
      <h4>No ${isVendorTab ? 'vendors' : 'customers'} match</h4>
      <p>${q || APP_STATE.khataFilter !== 'all' ? 'Try clearing the search or filter.' : (isVendorTab ? 'Vendors appear here after your first Inward Purchase.' : 'Customers appear here after their first sale.')}</p>
    </div>`;
    return;
  }

  grid.innerHTML = [...list].sort((a, b) => balanceOf(b) - balanceOf(a)).map(p => {
    const balance = balanceOf(p);
    const settled = balance <= 0.005;
    const isFrequent = !isVendorTab && p.isFrequent;
    return `<div class="khata-card ${settled ? 'settled' : (isVendorTab ? 'payable' : 'receivable')}">
      <div class="khata-card-top">
        <div>
          <strong>${p.isStarred ? '⭐ ' : ''}${esc(p.name)}</strong>
          ${isFrequent ? '<span class="pill info" style="margin-left:6px;">Frequent</span>' : ''}
          <p class="khata-card-phone">${esc(p.phone || 'No phone on file')}</p>
        </div>
        <span class="khata-balance ${settled ? 'zero' : (isVendorTab ? 'payable' : 'receivable')}">
          ${settled ? 'Settled' : `₹${balance.toLocaleString('en-IN')}`}
        </span>
      </div>
      <div class="khata-card-actions">
        ${!isVendorTab ? `<button class="btn-pill secondary" style="flex:1;" onclick="switchView('reports'); openReport('cust_360', '${esc(p.phone)}');">View 360</button>` : `<button class="btn-pill secondary" style="flex:1;" onclick="openVendorEditModal('${esc(p.id)}')">Details</button>`}
        ${!settled ? `<button class="btn-pill primary" style="flex:1;" onclick="openSettlementModal('${isVendorTab ? 'vendor' : 'customer'}', '${esc(p.id || p.phone)}')">Settle</button>` : ''}
        ${!isVendorTab && !settled && p.phone ? `<button class="btn-pill ghost" onclick="sendWhatsAppReminder('${esc(p.phone)}')" title="Send WhatsApp reminder">💬</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function handleKhataSearch(value) {
  APP_STATE.khataSearch = value;
  renderKhataView();
}

function setKhataFilter(filter, el) {
  APP_STATE.khataFilter = filter;
  $qa('.khata-filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderKhataView();
}

function openSettlementModal(kind, id) {
  const party = kind === 'vendor'
    ? APP_STATE.vendors.find(v => v.id === id)
    : APP_STATE.customers.find(c => c.phone === id);
  if (!party) return;

  APP_STATE.settlementTarget = { kind, id };
  setTxt('settlementModalTitle', kind === 'vendor' ? 'Pay Supplier' : 'Record Payment');
  setTxt('settlementPartyName', party.name);
  setTxt('settlementAmountLabel', kind === 'vendor' ? 'Amount Paid' : 'Amount Received');
  const balance = kind === 'vendor' ? party.payables : party.dues;
  setTxt('settlementCurrentDue', `₹${(balance || 0).toFixed(2)}`);
  setVal('settlementAmount', (balance || 0).toFixed(2));
  $id('settlementModal')?.classList.add('open');
}

function closeSettlementModal() {
  $id('settlementModal')?.classList.remove('open');
  APP_STATE.settlementTarget = null;
}

async function submitSettlement() {
  const target = APP_STATE.settlementTarget;
  if (!target) return;

  const amount = parseFloat($id('settlementAmount')?.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showSaasToast('Enter a valid settlement amount.', 3000, 'err');
    return;
  }
  const mode = $id('settlementMode')?.value || 'Cash';

  if (target.kind === 'vendor') {
    const v = APP_STATE.vendors.find(x => x.id === target.id);
    if (!v) return;
    v.payables = Math.max(0, TaxEngine.round2(v.payables - amount));
    if (APP_STATE.cloudSession) {
      SB.client.from('vendors').update({ payables: v.payables }).eq('id', v.id)
        .then(({ error }) => { if (error) console.warn('Vendor settlement sync failed:', error.message); });
    }
    showSaasToast(`₹${amount.toFixed(2)} paid to ${v.name} via ${mode}.`, 3000);
  } else {
    const c = APP_STATE.customers.find(x => x.phone === target.id);
    if (!c) return;
    c.dues = Math.max(0, TaxEngine.round2(c.dues - amount));
    persistState();
    if (APP_STATE.cloudSession && c.id) {
      SB.upsertCustomer(APP_STATE.tenantProfile.shopId, {
        phone: c.phone, name: c.name, gstin: c.gstin || null,
        dues: c.dues, total_orders_val: c.totalOrdersVal || 0
      }).then(({ error }) => { if (error) console.warn('Customer settlement sync failed:', error.message); });
    }
    showSaasToast(`₹${amount.toFixed(2)} recorded from ${c.name} via ${mode}.`, 3000);
  }

  closeSettlementModal();
  renderKhataView();
  renderDashboard();
}

async function openVendorEditModal(vendorId) {
  const v = APP_STATE.vendors.find(x => x.id === vendorId);
  if (!v) return;
  APP_STATE.editingVendorId = vendorId;

  setVal('vendEditName', v.name);
  setVal('vendEditPhone', v.phone || '');
  setVal('vendEditAddress', v.address || '');
  setVal('vendEditGstin', v.gstin || '');
  setVal('vendEditPan', v.pan || '');
  setVal('vendEditDrugLicense', v.drugLicenseNo || '');
  setTxt('vendEditPayables', `₹${(v.payables || 0).toFixed(2)}`);

  const divList = $id('vendDivisionsList');
  if (divList) {
    divList.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem;">Loading divisions…</span>`;
    const { data } = await SB.fetchVendorDivisions(APP_STATE.tenantProfile.shopId, vendorId);
    divList.innerHTML = (data || []).length
      ? data.map(d => `<span class="pill info">${esc(d.name)}</span>`).join(' ')
      : `<span style="color:var(--text-muted); font-size:0.8rem;">No divisions recorded yet — add one during Inward Purchase.</span>`;
  }

  $id('vendorEditModal')?.classList.add('open');
}

function closeVendorEditModal() {
  $id('vendorEditModal')?.classList.remove('open');
  APP_STATE.editingVendorId = null;
}

function saveVendorEdit() {
  const v = APP_STATE.vendors.find(x => x.id === APP_STATE.editingVendorId);
  if (!v) return;

  v.name = $id('vendEditName')?.value.trim() || v.name;
  v.phone = $id('vendEditPhone')?.value.trim() || '';
  v.address = $id('vendEditAddress')?.value.trim() || '';
  v.gstin = $id('vendEditGstin')?.value.trim() || '';
  v.pan = $id('vendEditPan')?.value.trim().toUpperCase() || '';
  v.drugLicenseNo = $id('vendEditDrugLicense')?.value.trim() || '';

  if (APP_STATE.cloudSession) {
    SB.updateVendorDetails(v.id, {
      name: v.name, phone: v.phone || null, address: v.address || null,
      gstin: v.gstin || null, pan: v.pan || null, drug_license_no: v.drugLicenseNo || null
    }).then(({ error }) => { if (error) showSaasToast(`Sync failed: ${error}`, 3500, 'err'); });
  }

  closeVendorEditModal();
  renderKhataView();
  showSaasToast('Vendor details updated.', 2500);
}

function toggleVendorStar() {
  const v = APP_STATE.vendors.find(x => x.id === APP_STATE.editingVendorId);
  if (!v) return;
  v.isStarred = !v.isStarred;
  if (APP_STATE.cloudSession) SB.setVendorStar(v.id, v.isStarred);
  renderKhataView();
}

function sendWhatsAppReminder(phone) {
  const cust = APP_STATE.customers.find(c => c.phone === phone);
  if (!cust) return;

  const shopName = APP_STATE.tenantProfile.shopName || 'us';
  const message = `Hello ${cust.name}, this is a friendly reminder from ${shopName}. ` +
    `Your outstanding balance is ₹${(cust.dues || 0).toFixed(2)}. ` +
    `Please settle at your convenience. Thank you!`;

  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;

  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
}

function exportKhataToExcel() {
  const isVendorTab = APP_STATE.khataTab === 'vendors';
  const list = isVendorTab ? APP_STATE.vendors : APP_STATE.customers;
  if (!list.length) { showSaasToast('Nothing to export.', 2500, 'err'); return; }

  const headers = isVendorTab
    ? ['Vendor', 'Phone', 'GSTIN', 'PAN', 'Drug License', 'Payable (₹)']
    : ['Customer', 'Phone', 'GSTIN', 'PAN', 'Drug License', 'Due (₹)', 'Lifetime Value (₹)'];

  const rows = list.map(p => isVendorTab
    ? [p.name, p.phone, p.gstin || '', p.pan || '', p.drugLicenseNo || '', p.payables || 0]
    : [p.name, p.phone, p.gstin || '', p.pan || '', p.drugLicenseNo || '', p.dues || 0, p.totalOrdersVal || 0]);

  exportToExcel(
    `khata-${isVendorTab ? 'vendors' : 'customers'}-${new Date().toISOString().slice(0, 10)}`,
    isVendorTab ? 'Vendor Payables' : 'Customer Receivables',
    headers, rows
  );
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

window.setKhataTab = setKhataTab;
window.renderKhataView = renderKhataView;
window.handleKhataSearch = handleKhataSearch;
window.setKhataFilter = setKhataFilter;
window.openSettlementModal = openSettlementModal;
window.closeSettlementModal = closeSettlementModal;
window.submitSettlement = submitSettlement;
window.openVendorEditModal = openVendorEditModal;
window.closeVendorEditModal = closeVendorEditModal;
window.saveVendorEdit = saveVendorEdit;
window.toggleVendorStar = toggleVendorStar;
window.sendWhatsAppReminder = sendWhatsAppReminder;
window.exportKhataToExcel = exportKhataToExcel;
window.showAlternativesFor = showAlternativesFor;
window.selectAlternative = selectAlternative;
