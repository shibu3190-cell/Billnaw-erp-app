/* ==========================================================================
   BILLNAW — CUSTOMERS (360° PROFILE) ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Customer auto-fill on the
   POS phone field, the Customer 360° search/profile/export view, star
   (favourite) toggling, profile edit, and archive/delete.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

/* ==========================================================================
   CUSTOMER 360° & AUTO-FILL PROFILE
   ========================================================================== */
function autoFillCustomer(query) {
  setStep(3);
  const q = query.trim().toLowerCase();
  if (q.length < 2) return;

  const match = APP_STATE.customers.find(c => c.phone.includes(q) || c.name.toLowerCase().includes(q));
  if (match) {
    setVal('custName', match.name);
    setVal('custGstin', match.gstin || '');
    setVal('custPan', match.pan || '');
    setVal('custDrugLicense', match.drugLicenseNo || '');
    setVal('custAddress', match.address || '');
    // Only override the shop-default state if this customer actually has
    // one on file — an empty saved value should fall back to the default,
    // not blank it out.
    if (match.stateCode) setVal('custState', match.stateCode);
    else resetCustomerStateToShopDefault();
    updateTaxTypeHint();
  }
}

/* ==========================================================================
   CUSTOMER 360 — SEARCH, STAR, EDIT, ARCHIVE/DELETE
   ========================================================================== */
function handleCust360Search(query) {
  const results = $id('cust360SearchResults');
  if (!results) return;

  const q = query.trim().toLowerCase();
  if (!q) { results.style.display = 'none'; return; }

  const matches = APP_STATE.customers
    .filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
    .slice(0, 8);

  if (!matches.length) {
    results.innerHTML = `<div class="cc-item" style="cursor:default;">No matches</div>`;
    results.style.display = 'block';
    return;
  }

  results.innerHTML = matches.map(c => `
    <button type="button" class="cc-item" onclick="selectCust360Result('${esc(c.phone)}', '${escJs(c.name)}')">
      ${c.isStarred ? '⭐ ' : ''}${esc(c.name)} <span>${esc(c.phone)}</span>
    </button>`).join('');
  results.style.display = 'block';
}

function selectCust360Result(phone, name) {
  setVal('cust360SearchInput', name);
  setDisplay('cust360SearchResults', 'none');
  renderCustomer360Profile(phone);
}

function toggleCurrentCustomerStar() {
  const cust = APP_STATE.customers.find(c => c.phone === APP_STATE.c360Phone);
  if (!cust) return;
  cust.isStarred = !cust.isStarred;
  updateStarButton(cust);
  if (cust.id && APP_STATE.cloudSession) {
    SB.setCustomerStar(cust.id, cust.isStarred).then(({ error }) => {
      if (error) showSaasToast(`Star sync failed: ${error}`, 3500, 'err');
    });
  }
}

function updateStarButton(cust) {
  const btn = $id('c360StarBtn');
  if (btn) btn.innerHTML = cust.isStarred ? '⭐ Starred customer' : '☆ Star this customer';
}

function openCustEditModal(custOverride = null) {
  const cust = custOverride || APP_STATE.customers.find(c => c.phone === APP_STATE.c360Phone);
  if (!cust) { showSaasToast('Select a customer first.', 2500, 'err'); return; }

  if (APP_STATE.c360Phone !== cust.phone) APP_STATE.c360Phone = cust.phone;

  setVal('custEditName', cust.name);
  setVal('custEditPhone', cust.phone);
  setVal('custEditAddress', cust.address || '');
  setVal('custEditGstin', cust.gstin || '');
  setVal('custEditPan', cust.pan || '');
  setVal('custEditDrugLicense', cust.drugLicenseNo || '');

  const dlRow = $id('custEditDlRow');
  if (dlRow) dlRow.style.display = APP_STATE.tenantProfile.assignedIndustry === 'Pharmacy' ? 'block' : 'none';

  $id('custEditModal')?.classList.add('open');
}

function closeCustEditModal() { $id('custEditModal')?.classList.remove('open'); }

function saveCustEdit() {
  const cust = APP_STATE.customers.find(c => c.phone === APP_STATE.c360Phone);
  if (!cust) return;

  const name = $id('custEditName')?.value.trim();
  if (!name) { showSaasToast('Name is required.', 2500, 'err'); return; }

  cust.name = name;
  cust.address = $id('custEditAddress')?.value.trim() || '';
  cust.gstin = $id('custEditGstin')?.value.trim() || '';
  cust.pan = $id('custEditPan')?.value.trim().toUpperCase() || '';
  cust.drugLicenseNo = $id('custEditDrugLicense')?.value.trim() || '';
  // Phone is the client-side key everywhere (cart, sales, dropdowns) —
  // changing it here would silently disconnect this profile from its own
  // history, so it's shown for reference but not editable from this panel.

  persistState();
  renderCustomer360Profile(cust.phone);
  closeCustEditModal();
  showSaasToast('Profile updated.', 2500);

  if (cust.id && APP_STATE.cloudSession) {
    SB.updateCustomerDetails(cust.id, {
      name: cust.name, address: cust.address, gstin: cust.gstin || null,
      pan: cust.pan || null, drug_license_no: cust.drugLicenseNo || null
    }).then(({ error }) => { if (error) showSaasToast(`Sync failed: ${error}`, 3500, 'err'); });
  }
}

// Archive is the default, reversible action. True deletion is only offered
// — and only succeeds — when the server confirms zero sales history, so a
// customer with even one past order can never be permanently erased from
// this screen.
async function archiveCurrentCustomer() {
  const cust = APP_STATE.customers.find(c => c.phone === APP_STATE.c360Phone);
  if (!cust) { showSaasToast('Select a customer first.', 2500, 'err'); return; }

  const hasHistory = (cust.totalOrdersVal || 0) > 0 || (cust.ordersLast90d || 0) > 0;

  if (hasHistory) {
    if (!confirm(`${cust.name} has order history and cannot be permanently deleted — GST records must stay intact. Archive them instead? They'll disappear from every list but their invoices are untouched.`)) return;
    APP_STATE.customers = APP_STATE.customers.filter(c => c.phone !== cust.phone);
    persistState();
    closeReportDetail();
    showSaasToast(`${cust.name} archived.`, 3000);
    if (cust.id && APP_STATE.cloudSession) {
      SB.archiveCustomer(cust.id, true).then(({ error }) => {
        if (error) showSaasToast(`Archive sync failed: ${error}`, 3500, 'err');
      });
    }
    return;
  }

  if (!confirm(`Permanently delete ${cust.name}? They have no order history, so this cannot be undone from within the app.`)) return;

  if (cust.id && APP_STATE.cloudSession) {
    const { error } = await SB.deleteCustomerIfUnused(APP_STATE.tenantProfile.shopId, cust.id);
    if (error) { showSaasToast(error, 5000, 'err'); return; } // server is the real guard, e.g. a sale synced from another device since this one loaded
  }

  APP_STATE.customers = APP_STATE.customers.filter(c => c.phone !== cust.phone);
  persistState();
  closeReportDetail();
  showSaasToast(`${cust.name} deleted.`, 2500);
}

function renderCustomer360Profile(custPhone) {
  const cust = APP_STATE.customers.find(c => c.phone === custPhone) || APP_STATE.customers[0];
  if (!cust) return;

  APP_STATE.c360Phone = cust.phone;

  setTxt('c360Name', cust.name);
  setTxt('c360Contact', [
    cust.phone,
    cust.gstin || 'Unregistered / B2C',
    cust.pan ? `PAN ${cust.pan}` : '',
    cust.address || ''
  ].filter(Boolean).join(' · '));
  updateStarButton(cust);
  setTxt('c360Ltv', `₹${(cust.totalOrdersVal || 0).toLocaleString('en-IN')}`);
  setTxt('c360Due', `₹${(cust.dues || 0).toLocaleString('en-IN')}`);

  const thead = $id('drillTableHead');
  const tbody = $id('drillTableBody');
  if (!thead || !tbody) return;

  // Derived from the actual sales ledger, not from a per-customer
  // orderHistory array. That array is only ever appended to on the device
  // that made the sale and is never rehydrated from Supabase — so on a
  // second device (or after a cache clear) every customer wrongly showed
  // "no prior sales". Deriving from APP_STATE.sales makes this correct
  // everywhere, and automatically reflects returns too.
  const history = (APP_STATE.sales || [])
    .filter(s => s.customer?.phone === cust.phone)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const returnsFor = inv => (APP_STATE.returns || []).filter(r => r.invoiceNo === inv);

  thead.innerHTML = `<tr>
      <th>Invoice #</th><th>Date</th>
      <th>Products / Identifiers</th>
      <th>Mode</th><th>Status</th>
      <th style="text-align:right;">Amount</th>
      <th style="text-align:center;">Action</th>
    </tr>`;

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:24px;">No purchases recorded for this party yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(s => {
    const itemText = (s.items || []).map(i =>
      `${esc(i.name)} ×${i.qty}${i.assignedIdentifier ? ` <code style="font-size:0.72rem; color:var(--text-muted);">${esc(i.assignedIdentifier)}</code>` : ''}`
    ).join('<br>');

    const rets = returnsFor(s.invoiceNo);
    let pill = 'paid', label = 'PAID';
    if (s.status === 'returned') { pill = 'overdue'; label = 'RETURNED'; }
    else if (s.status === 'partially_returned') { pill = 'pending'; label = 'PART. RETURNED'; }
    else if (s.tender === 'Khata') { pill = 'pending'; label = 'DUE'; }

    const canReturn = s.status !== 'returned';
    return `<tr>
      <td><strong>${esc(s.invoiceNo)}</strong>${rets.length ? `<br><small style="color:var(--text-muted);">${rets.map(r => r.creditNoteNo).join(', ')}</small>` : ''}</td>
      <td>${s.date}</td>
      <td style="font-size:0.82rem;">${itemText || '—'}</td>
      <td>${esc(s.tender)}</td>
      <td><span class="pill ${pill}">${label}</span></td>
      <td style="text-align:right; font-weight:800;">₹${(s.total || 0).toFixed(2)}${
        s.returnedValue ? `<br><small style="color:var(--danger); font-weight:600;">−₹${s.returnedValue.toFixed(2)} returned</small>` : ''
      }</td>
      <td style="text-align:center;">
        ${canReturn
          ? `<button class="btn-pill secondary" style="padding:6px 12px; font-size:0.74rem;" onclick="openReturnModal('${esc(s.invoiceNo)}')">Return</button>`
          : '<span style="color:var(--text-faint); font-size:0.76rem;">—</span>'}
      </td>
    </tr>`;
  }).join('');
}

/* Exports every purchase line for the selected party — one row per line
   item, not per invoice, because that's what an accountant or a warranty
   claim actually needs (which serial, on which bill, on which date). */
function exportCustomer360() {
  const cust = APP_STATE.customers.find(c => c.phone === APP_STATE.c360Phone);
  if (!cust) { showSaasToast('Select a customer first.', 3000, 'err'); return; }

  const history = (APP_STATE.sales || [])
    .filter(s => s.customer?.phone === cust.phone)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!history.length) { showSaasToast('No purchases to export for this party.', 3000, 'err'); return; }

  const headers = ['Invoice', 'Date', 'Status', 'Item', 'HSN', 'Identifier',
                   'Qty', 'Rate', 'Taxable', 'GST %', 'GST Amt', 'Line Total', 'Mode'];
  const rows = [];
  history.forEach(s => {
    (s.items || []).forEach(i => {
      rows.push([
        s.invoiceNo, s.date, (s.status || 'active').toUpperCase(),
        i.name, i.hsn || '', i.assignedIdentifier || '',
        i.qty, i.price, i.taxableValue,
        (i.gstRateAtBilling !== undefined ? i.gstRateAtBilling : i.gst),
        i.gstAmount, i.totalAmount, s.tender
      ]);
    });
  });

  exportToExcel(
    `customer-${cust.phone}-${new Date().toISOString().slice(0, 10)}`,
    `${cust.name} — Purchase History`,
    headers, rows,
    { filter: `${cust.name} · ${cust.phone} · Due ₹${(cust.dues || 0).toFixed(2)}` }
  );
}

window.autoFillCustomer = autoFillCustomer;
window.handleCust360Search = handleCust360Search;
window.selectCust360Result = selectCust360Result;
window.toggleCurrentCustomerStar = toggleCurrentCustomerStar;
window.updateStarButton = updateStarButton;
window.openCustEditModal = openCustEditModal;
window.closeCustEditModal = closeCustEditModal;
window.saveCustEdit = saveCustEdit;
window.archiveCurrentCustomer = archiveCurrentCustomer;
window.renderCustomer360Profile = renderCustomer360Profile;
window.exportCustomer360 = exportCustomer360;
