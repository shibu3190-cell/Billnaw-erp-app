/* ==========================================================================
   BILLNAW — CHECKOUT ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). reserveInvoiceNumber() and
   checkoutBill() — the function that turns the in-memory cart into a real
   sale: computes final tax totals, reserves an invoice number, pushes the
   invoice into APP_STATE.sales, decrements local stock, updates/creates
   the customer ledger record, fires syncInvoiceToCloud() (which routes to
   the create_invoice_atomic RPC — see supabaseClient.js/migration 0003),
   triggers printing, and resets the POS screen for the next sale.

   This is the single highest-stakes extraction in the whole Phase 4
   migration: it is the actual money-moving code path AUDIT_REPORT.md and
   MIGRATION_PLAN.md both call out as requiring the heaviest scrutiny.
   Nothing about the financial logic itself changed here — every
   TaxEngine call, every APP_STATE mutation, every RPC call is byte-for-
   byte identical to what shipped before this extraction. Verified line
   by line against the original before and after the cut (not just
   diffed mechanically like the smaller slices), specifically checked
   for the load-order bug class caught in purchases.js/auth.js (no
   top-level statements exist in this block — confirmed by grep before
   cutting), and given its own dedicated file rather than being folded
   into pos.js, so a future contributor sees immediately that this is
   the financial-transaction boundary, not just more POS UI glue.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

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
    const { data, error } = await SB.saveSale(shopId, invoice);

    // A duplicate idempotency_key means this exact sale is already committed
    // (a retry landed twice). That's success, not failure — re-queuing it
    // would loop forever.
    if (isFatalSyncError(error)) throw new Error(error);

    // Keep the server-assigned row id so returns can be raised against this
    // invoice without a round-trip to look it up.
    if (data && data.sale_id) {
      invoice.cloudId = data.sale_id;
      const local = APP_STATE.sales.find(s => s.idempotency_key === invoice.idempotency_key);
      if (local) local.cloudId = data.sale_id;
      persistState();
    }
    updateSyncIndicator();
  } catch (err) {
    console.warn('Cloud sync failed, queued for retry:', err.message);
    SyncEngine.enqueue(invoice);
    updateSyncIndicator();
  }
}

window.reserveInvoiceNumber = reserveInvoiceNumber;
window.checkoutBill = checkoutBill;
window.syncInvoiceToCloud = syncInvoiceToCloud;
