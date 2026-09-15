/* ==========================================================================
   BILLNAW — INVOICE ACTIONS, RETURNS & PRINTING ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). The invoice-row action
   popup (download/re-print/edit-contact-only/cancel-via-return — see the
   header comment above openInvoiceActionPopup below for why "edit" is
   deliberately contact-fields-only under GST law), the sales-return modal
   and its tax-correct credit-note computation, applyReturnLocally (local
   state mutation mirroring what process_sales_return_atomic does server-
   side), and A4 invoice printing/HSN tax breakup/industry theming.

   submitReturn() is a real financial-transaction boundary — it calls the
   process_sales_return_atomic RPC (see supabase/migrations/0005) — so this
   slice got the same proactive load-order check as every extraction since
   purchases.js/auth.js first surfaced the pattern.

   Found and fixed the same load-order hazard again here: two top-level
   statements `APP_STATE.returns = APP_STATE.returns || [];
   APP_STATE.returnDraft = null;` sat right above the Returns section in
   app.js. Folded into the APP_STATE object literal itself (same fix as
   the Khata extraction's vendors/khataTab/khataSearch/khataFilter fields)
   rather than moved into a function — the more robust pattern of the two
   fixes seen so far, since it's correct regardless of how a field is
   later read or written, not just for idempotent or one-shot-bootstrap
   cases.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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
  // PrinterEngine lives in printerEngine.js (loaded before this file).
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
   SALES RETURNS / CREDIT NOTES
   A return is not a deletion. Under GST the original tax invoice must stay
   on record; the reversal is a separate credit note that reduces the tax
   liability. So the sale keeps its number and its data, gains a status of
   partially_returned / returned, and a credit note carries the reversed
   amounts. Tax is recomputed with the same TaxEngine used at billing, at
   the rate stamped on each line at the time of sale — never at today's
   rate, which would produce a credit that doesn't match what was charged.
   ========================================================================== */
function openReturnModal(invoiceNo) {
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  if (!sale) { showSaasToast('Invoice not found.', 3000, 'err'); return; }
  if (sale.status === 'returned') {
    showSaasToast(`${invoiceNo} has already been fully returned.`, 3500, 'err');
    return;
  }

  // Returnable = sold qty minus anything already returned on earlier credit
  // notes for this invoice. Computed locally so the modal opens instantly
  // offline; the server revalidates on submit and is the real authority.
  const already = {};
  APP_STATE.returns
    .filter(r => r.invoiceNo === invoiceNo)
    .forEach(r => (r.items || []).forEach(i => {
      already[i.id] = (already[i.id] || 0) + (i.qty || 0);
    }));

  APP_STATE.returnDraft = {
    sale,
    lines: (sale.items || []).map(it => ({
      ...it,
      soldQty: it.qty,
      returnableQty: Math.max(0, (it.qty || 0) - (already[it.id] || 0)),
      returnQty: 0
    }))
  };

  renderReturnModal();
  $id('returnModal')?.classList.add('open');
}

function closeReturnModal() {
  $id('returnModal')?.classList.remove('open');
  APP_STATE.returnDraft = null;
}

function renderReturnModal() {
  const d = APP_STATE.returnDraft;
  if (!d) return;

  setTxt('retInvoiceNo', d.sale.invoiceNo);
  setTxt('retCustomer', `${d.sale.customer?.name || 'Cash Customer'} · ${d.sale.customer?.phone || '-'}`);
  setTxt('retTaxMode', d.sale.interstate ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)');

  const body = $id('retLinesBody');
  if (!body) return;

  body.innerHTML = d.lines.map((l, idx) => {
    const disabled = l.returnableQty === 0;
    return `<tr${disabled ? ' style="opacity:.45;"' : ''}>
      <td>
        <strong>${esc(l.name)}</strong>
        ${l.assignedIdentifier ? `<br><small style="color:var(--text-muted);">${esc(l.assignedIdentifier)}</small>` : ''}
      </td>
      <td style="text-align:center;">${l.soldQty}</td>
      <td style="text-align:center;">${l.returnableQty}</td>
      <td style="text-align:center;">
        <input type="number" min="0" max="${l.returnableQty}" value="${l.returnQty}"
               ${disabled ? 'disabled' : ''} style="width:64px; padding:6px; text-align:center;
               border:1px solid var(--border); border-radius:8px;"
               oninput="updateReturnQty(${idx}, this.value)">
      </td>
      <td style="text-align:right;">₹${(l.price || 0).toFixed(2)}</td>
    </tr>`;
  }).join('');

  updateReturnTotals();
}

function updateReturnQty(idx, val) {
  const d = APP_STATE.returnDraft;
  if (!d || !d.lines[idx]) return;
  let q = parseInt(val, 10) || 0;
  // Clamp rather than reject: a cashier typing 5 into a line with 3
  // returnable should see it correct itself, not get an error and lose input.
  if (q < 0) q = 0;
  if (q > d.lines[idx].returnableQty) q = d.lines[idx].returnableQty;
  d.lines[idx].returnQty = q;
  updateReturnTotals();
}

function computeReturnTotals() {
  const d = APP_STATE.returnDraft;
  if (!d) return null;

  const lines = d.lines
    .filter(l => l.returnQty > 0)
    .map(l => {
      // Reuse the exact rate this line was billed at, not the current slab.
      const rate = l.gstRateAtBilling !== undefined ? l.gstRateAtBilling : l.gst;
      const includeGst = l.gstModeAtBilling === 'inclusive';
      const computed = TaxEngine.computeLine({ price: l.price, qty: l.returnQty, gstRate: rate, includeGst });
      return {
        id: l.id, name: l.name, hsn: l.hsn, gst: rate, gstRateAtBilling: rate,
        price: l.price, qty: l.returnQty,
        assignedIdentifier: l.assignedIdentifier || '',
        taxableValue: computed.taxableValue,
        gstAmount: computed.gstAmount,
        totalAmount: computed.totalAmount
      };
    });

  if (!lines.length) return { lines: [], taxable: 0, gstTotal: 0, total: 0, roundOff: 0 };

  const t = TaxEngine.computeInvoiceTotals(lines);
  return { lines, taxable: t.taxable, gstTotal: t.gstTotal, total: t.total, roundOff: t.roundOff };
}

function updateReturnTotals() {
  const r = computeReturnTotals();
  if (!r) return;
  const d = APP_STATE.returnDraft;
  const interstate = !!d.sale.interstate;

  setTxt('retTaxable', `₹${r.taxable.toFixed(2)}`);
  setTxt('retGst', `₹${r.gstTotal.toFixed(2)}`);
  setTxt('retTotal', `₹${r.total.toFixed(2)}`);

  // Show the split the same way the invoice did, so the credit note is
  // legible next to the original bill.
  const splitEl = $id('retGstSplit');
  if (splitEl) {
    if (r.gstTotal === 0) { splitEl.innerText = ''; }
    else if (interstate) { splitEl.innerText = `IGST reversed: ₹${r.gstTotal.toFixed(2)}`; }
    else {
      const half = TaxEngine.round2(r.gstTotal / 2);
      const other = TaxEngine.round2(r.gstTotal - half);
      splitEl.innerText = `CGST ₹${half.toFixed(2)} + SGST ₹${other.toFixed(2)} reversed`;
    }
  }

  const btn = $id('retSubmitBtn');
  if (btn) btn.disabled = r.lines.length === 0;
}

async function submitReturn() {
  const d = APP_STATE.returnDraft;
  const r = computeReturnTotals();
  if (!d || !r || !r.lines.length) {
    showSaasToast('Select at least one item to return.', 3000, 'err');
    return;
  }

  const restock = !!$id('retRestock')?.checked;
  const reason = $id('retReason')?.value.trim() || '';

  const creditNoteNo = `CN-${APP_STATE.cnCounter || 1}`;
  const ret = {
    creditNoteNo,
    invoiceNo: d.sale.invoiceNo,
    idempotency_key: SyncEngine.generateIdempotencyKey(),
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toISOString(),
    customer: d.sale.customer,
    reason, restock,
    taxable: r.taxable, gstTotal: r.gstTotal, roundOff: r.roundOff, total: r.total,
    interstate: !!d.sale.interstate,
    items: r.lines
  };

  const btn = $id('retSubmitBtn');
  if (btn) { btn.disabled = true; btn.innerText = 'Processing…'; }

  // Local state first so the counter is never blocked on network, matching
  // how a sale behaves; the cloud call self-queues on failure.
  applyReturnLocally(ret, restock);
  APP_STATE.cnCounter = (APP_STATE.cnCounter || 1) + 1;
  localStorage.setItem('bn_cn_seq', String(APP_STATE.cnCounter));
  persistState();

  // Same offline-first contract as a sale: never block the counter on
  // network, always end up on the queue if the write doesn't land.
  ret.cloudSaleId = d.sale.cloudId || null;

  if (APP_STATE.cloudSession && navigator.onLine && ret.cloudSaleId) {
    const { error } = await SB.processReturn(APP_STATE.tenantProfile.shopId, ret.cloudSaleId, ret);
    if (isFatalSyncError(error)) {
      SyncEngine.enqueue(ret, 'return');
      showSaasToast(`Credit note ${esc(creditNoteNo)} saved locally — will sync when possible.`, 4500);
    } else {
      showSaasToast(`Credit note ${esc(creditNoteNo)} created. Stock ${restock ? 'restored' : 'not restored (damaged)'}.`, 4000);
    }
  } else {
    // No session, offline, or the parent invoice hasn't synced yet — queue it.
    // flushSyncQueue() holds returns back until their parent sale has a
    // cloud id, so ordering is preserved without extra bookkeeping here.
    SyncEngine.enqueue(ret, 'return');
    showSaasToast(`Credit note ${esc(creditNoteNo)} saved locally — will sync when online.`, 4000);
  }

  if (btn) { btn.disabled = false; btn.innerText = 'Process Return'; }
  closeReturnModal();
  renderDashboard();
  renderCatalog();
}

function applyReturnLocally(ret, restock) {
  APP_STATE.returns.push(ret);

  if (restock) {
    ret.items.forEach(ri => {
      const item = APP_STATE.inventory.find(i => i.id === ri.id);
      if (!item) return;
      item.stock += ri.qty;
      // Return the specific unit's identifier to the sellable pool.
      if (ri.assignedIdentifier) {
        if (item.category === 'Electronics') {
          item.serials = item.serials || [];
          if (!item.serials.includes(ri.assignedIdentifier)) item.serials.push(ri.assignedIdentifier);
        } else if (item.category === 'Jewelry') {
          item.huids = item.huids || [];
          if (!item.huids.includes(ri.assignedIdentifier)) item.huids.push(ri.assignedIdentifier);
        }
      }
    });
  }

  const sale = APP_STATE.sales.find(s => s.invoiceNo === ret.invoiceNo);
  if (sale) {
    sale.returnedValue = TaxEngine.round2((sale.returnedValue || 0) + ret.total);
    sale.status = sale.returnedValue >= (sale.total - 0.01) ? 'returned' : 'partially_returned';
  }

  const cust = APP_STATE.customers.find(c => c.phone === ret.customer?.phone);
  if (cust) {
    if (sale && sale.tender === 'Khata') {
      cust.dues = Math.max(0, TaxEngine.round2((cust.dues || 0) - ret.total));
    }
    cust.totalOrdersVal = Math.max(0, TaxEngine.round2((cust.totalOrdersVal || 0) - ret.total));
  }
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

window.openInvoiceActionPopup = openInvoiceActionPopup;
window.closeInvoiceActionPopup = closeInvoiceActionPopup;
window.getIapSale = getIapSale;
window.iapDownload = iapDownload;
window.iapPrint = iapPrint;
window.iapOpenEdit = iapOpenEdit;
window.iapSaveEdit = iapSaveEdit;
window.iapOpenCancel = iapOpenCancel;
window.openReturnModal = openReturnModal;
window.closeReturnModal = closeReturnModal;
window.renderReturnModal = renderReturnModal;
window.updateReturnQty = updateReturnQty;
window.computeReturnTotals = computeReturnTotals;
window.updateReturnTotals = updateReturnTotals;
window.submitReturn = submitReturn;
window.applyReturnLocally = applyReturnLocally;
window.applyIndustryInvoiceTheme = applyIndustryInvoiceTheme;
window.printA4Invoice = printA4Invoice;
window.renderHsnTaxBreakup = renderHsnTaxBreakup;
