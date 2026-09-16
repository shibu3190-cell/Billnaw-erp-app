/* ==========================================================================
   BILLNAW — SALES RETURNS / CREDIT NOTES ENGINE
   Extracted verbatim from app.js (Phase 4 continuation of the modernization
   migration — structural relocation only, no logic changed). Return modal
   render/quantity-clamp, return total computation (reusing the rate a line
   was billed at, never today's slab), submission (local-first, then cloud
   sync with the same offline-queue contract a sale uses), and local
   application (restock, invoice status flip, customer ledger credit).

   A return is not a deletion. Under GST the original tax invoice must stay
   on record; the reversal is a separate credit note that reduces the tax
   liability — the sale keeps its number and its data, gains a status of
   partially_returned/returned, and the credit note carries the reversed
   amounts.

   Depends on globals defined elsewhere and relies on the fact that classic
   (non-module) <script> tags share one top-level lexical scope across the
   whole page — APP_STATE, $id (dom.js), esc/showSaasToast/setTxt/
   persistState/persistMeta/isFatalSyncError/reportRpcSkipWarnings/
   renderDashboard/renderCatalog (app.js), TaxEngine (gstConfig.js), SB
   (supabaseClient.js), SyncEngine (app.js) are all resolved at call time,
   same as every other extracted engine file.

   Load order relative to app.js does not matter for that reason, but this
   loads alongside the other extracted engines (before app.js) to keep the
   convention consistent and easy to scan in index.html.
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
  persistMeta('cnCounter', APP_STATE.cnCounter);
  persistState();

  // Same offline-first contract as a sale: never block the counter on
  // network, always end up on the queue if the write doesn't land.
  ret.cloudSaleId = d.sale.cloudId || null;

  if (APP_STATE.cloudSession && navigator.onLine && ret.cloudSaleId) {
    const { data, error, errorCode } = await SB.processReturn(APP_STATE.tenantProfile.shopId, ret.cloudSaleId, ret);
    if (isFatalSyncError(error, errorCode)) {
      SyncEngine.enqueue(ret, 'return');
      showSaasToast(`Credit note ${esc(creditNoteNo)} saved locally — will sync when possible.`, 4500);
    } else {
      showSaasToast(`Credit note ${esc(creditNoteNo)} created. Stock ${restock ? 'restored' : 'not restored (damaged)'}.`, 4000);
      reportRpcSkipWarnings(data);
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
