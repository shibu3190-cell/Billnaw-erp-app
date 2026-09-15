/* ==========================================================================
   BILLNAW — INWARD PURCHASE, VENDOR & AI OCR INTAKE ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Vendor-name division
   lookup, the Inward Purchase modal (manual entry + AI-assisted entry
   toggle), manual purchase save, purchase-bill recording, and the AI
   invoice OCR review/edit/commit flow (staging table, per-row edits,
   discard, commit-to-inventory).

   This is the highest-stakes slice extracted so far in Phase 4: it calls
   the stock-decrement and purchase RPCs (create_purchase_atomic via
   SB.savePurchase, decrement/increment paths in syncItemToCloud) that
   AUDIT_REPORT.md and SECURITY_REPORT.md both treat as financially
   sensitive. Nothing about those RPC contracts changes here — this file
   still calls exactly the same SB.* methods with exactly the same
   arguments as the code did before the cut. Only the physical location
   of the calling code moved.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

/* ==========================================================================
   INWARD PURCHASE & AI OCR (ONLINE RESTRICTED)
   ========================================================================== */
// Populates the Division datalist for whatever vendor name the owner has
// typed so far — matched against known vendors client-side first (instant,
// no network wait while typing), falling back to a cloud lookup only if
// the name matches a vendor we don't have cached locally yet.
let purVendorLookupTimer = null;
function onPurVendorInput(value) {
  clearTimeout(purVendorLookupTimer);
  const datalist = $id('purDivisionOptions');
  if (!datalist) return;

  const name = value.trim().toLowerCase();
  if (!name) { datalist.innerHTML = ''; return; }

  const localMatch = (APP_STATE.vendors || []).find(v => v.name.toLowerCase() === name);
  if (localMatch) { populateDivisionDatalist(localMatch.id); return; }

  // Debounced cloud lookup — this fires while the owner is still typing,
  // so a lookup per keystroke would be wasteful and would race itself.
  purVendorLookupTimer = setTimeout(async () => {
    if (!APP_STATE.cloudSession) return;
    const { data } = await SB.client.from('vendors')
      .select('id').eq('shop_id', APP_STATE.tenantProfile.shopId)
      .ilike('name', value.trim()).maybeSingle();
    if (data?.id) populateDivisionDatalist(data.id);
  }, 400);
}

async function populateDivisionDatalist(vendorId) {
  const datalist = $id('purDivisionOptions');
  if (!datalist) return;
  const { data } = await SB.fetchVendorDivisions(APP_STATE.tenantProfile.shopId, vendorId);
  datalist.innerHTML = (data || []).map(d => `<option value="${esc(d.name)}"></option>`).join('');
}

function openInwardPurchaseModal() {
  populateRestockPicker();
  const m = $id('inwardPurchaseModal');
  if (m) m.classList.add('open');
}
function closeInwardModal() {
  const m = $id('inwardPurchaseModal');
  if (m) m.classList.remove('open');
}

function toggleInwardMode(mode) {
  const manView = $id('inwardManualView');
  const aiView = $id('inwardAiView');
  const btnMan = $id('btnInwardManual');
  const btnAi = $id('btnInwardAi');

  if (mode === 'manual') {
    if (manView) manView.style.display = 'block';
    if (aiView) aiView.style.display = 'none';
    if (btnMan) btnMan.classList.add('active');
    if (btnAi) btnAi.classList.remove('active');
  } else {
    if (!navigator.onLine) {
      alert("⚠️ AI Invoice Ingestion requires an active internet connection.\nPlease connect or use Manual Entry.");
      return;
    }
    if (manView) manView.style.display = 'none';
    if (aiView) aiView.style.display = 'block';
    if (btnMan) btnMan.classList.remove('active');
    if (btnAi) btnAi.classList.add('active');
  }
}

// Maps a local inventory item to Supabase's items table shape and upserts.
// Client-generated ids must be real UUIDs (not Date.now() strings) to match
// the uuid primary key — see the id generation fix below.
async function syncItemToCloud(item) {
  if (!APP_STATE.cloudSession) return;
  const shopId = APP_STATE.tenantProfile.shopId;
  const { error } = await SB.saveItem({
    id: item.id,
    shop_id: shopId,
    name: item.name,
    category: item.category,
    barcode: item.barcode || null,
    hsn: item.hsn,
    gst: item.gst,
    price: item.price,
    cost: item.cost,
    stock: item.stock,
    serials: item.serials || [],
    huids: item.huids || [],
    batches: item.batches || [],
    meta: item.meta || {},
  });
  if (error) console.warn('Item cloud sync failed for', item.name, error);
}


/* ==========================================================================
   QUICK RESTOCK
   Repeat purchases of a product already in stock were matched by comparing
   the typed name string — a trailing space or "Motorola G84" vs
   "Motorola G84 5G" silently created a duplicate SKU with its own stock
   count and serial pool. Selecting the real product by id removes that
   whole class of error.
   ========================================================================== */
function populateRestockPicker() {
  const sel = $id('purExistingItem');
  if (!sel) return;
  const items = [...(APP_STATE.inventory || [])].sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = `<option value="">— New product / enter manually below —</option>` +
    items.map(i => `<option value="${i.id}">${esc(i.name)} — ${i.stock} in stock · HSN ${esc(i.hsn || '—')}</option>`).join('');
}

function prefillFromExistingItem(itemId) {
  const idField = $id('purExistingItemId');
  if (!itemId) {
    if (idField) idField.value = '';
    ['purName', 'purBarcode', 'purHsn', 'purIdentifiers'].forEach(f => setVal(f, ''));
    setDisplay('restockNotice', 'none');
    return;
  }

  const it = APP_STATE.inventory.find(i => i.id === itemId);
  if (!it) return;

  if (idField) idField.value = it.id;
  setVal('purName', it.name);
  setVal('purBarcode', it.barcode || '');
  setVal('purHsn', it.hsn || '');
  setVal('purGst', String(it.gst));
  setVal('purCategory', it.category);
  setVal('purCost', it.cost || '');
  setVal('purPrice', it.price || '');
  setVal('purIdentifiers', ''); // new units bring new serials — never reuse the old list

  const notice = $id('restockNotice');
  if (notice) {
    notice.style.display = 'block';
    notice.innerHTML = `Restocking <strong>${esc(it.name)}</strong> — currently ${it.stock} in stock. New quantity will be added to that, and any serials/batches you enter are appended to the existing pool.`;
  }
}

function saveManualPurchase() {
  const name = $id('purName')?.value.trim();
  const category = $id('purCategory')?.value || 'Electronics';
  const barcode = $id('purBarcode')?.value.trim() || '';
  const hsn = $id('purHsn')?.value.trim() || '8517';
  const gst = parseInt($id('purGst')?.value, 10) || 18;
  const qty = parseInt($id('purQty')?.value, 10) || 1;
  const cost = parseFloat($id('purCost')?.value) || 0;
  const price = parseFloat($id('purPrice')?.value) || (cost > 0 ? cost * 1.25 : 100);
  const rawIds = $id('purIdentifiers')?.value || '';
  const idArray = rawIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  if (!name || qty <= 0) return alert("Enter a valid Item Name and Quantity!");

  let targetItem;
  // Prefer the explicitly-picked product id; fall back to name match only
  // when the user typed a new product rather than selecting one.
  const pickedId = $id('purExistingItemId')?.value;
  const existing = pickedId
    ? APP_STATE.inventory.find(i => i.id === pickedId)
    : APP_STATE.inventory.find(i => i.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    existing.stock += qty;
    if (cost > 0) existing.cost = cost;
    if (price > 0) existing.price = price;
    if (barcode) existing.barcode = barcode;

    if (category === 'Electronics') {
      existing.serials = Array.isArray(existing.serials) ? existing.serials : [];
      idArray.forEach(id => { if (!existing.serials.includes(id)) existing.serials.push(id); });
    } else if (category === 'Jewelry') {
      existing.huids = Array.isArray(existing.huids) ? existing.huids : [];
      idArray.forEach(id => { if (!existing.huids.includes(id)) existing.huids.push(id); });
    }
    targetItem = existing;
    alert(`✅ Incremented stock for existing item: ${name} (+${qty} units)`);
  } else {
    const metaByCategory = {
      Electronics: { imei: idArray[0] || '', warranty: '' },
      Jewelry: { karat: '22K', netWt: 0, grossWt: 0, making: 0 },
      Pharmacy: { batch: idArray[0] || '', expiry: '2027-12' },
      Grocery: { pack: '' }
    };

    targetItem = {
      id: crypto.randomUUID(),
      name,
      category,
      barcode,
      hsn,
      gst,
      cost,
      price,
      stock: qty,
      serials: category === 'Electronics' ? idArray : [],
      huids: category === 'Jewelry' ? idArray : [],
      batches: category === 'Pharmacy' && idArray.length ? [{ batch: idArray[0], expiry: '2027-12', stock: qty }] : [],
      meta: metaByCategory[category] || { pack: '' }
    };
    APP_STATE.inventory.push(targetItem);
    alert(`✅ Created and added new item to stock: ${name}`);
  }

  persistState();
  syncItemToCloud(targetItem);

  // Record the supplier bill itself, not just the stock movement (P1 #4).
  recordPurchaseBill({
    vendor: {
      name: $id('purVendor')?.value.trim() || '',
      gstin: '', phone: '', stateCode: ''
    },
    billNo: $id('purBillNo')?.value.trim() || '',
    divisionName: $id('purDivision')?.value.trim() || '',
    items: [{
      id: targetItem.id, name: targetItem.name, hsn: targetItem.hsn,
      gst: targetItem.gst, qty, cost, price,
      identifier: idArray[0] || '', expiry: ''
    }],
    source: 'manual'
  });

  closeInwardModal();
  renderCatalog();
}

/* ==========================================================================
   PURCHASE BILL RECORDING  (P1 #4)
   The stock movement was already handled locally; this persists the vendor
   bill behind it so cost history, payables and GSTR-2 data survive a cache
   clear or a move to another device.
   ========================================================================== */
function recordPurchaseBill({ vendor, billNo, divisionName = '', items, source = 'manual' }) {
  // Was a top-level `APP_STATE.purchases = APP_STATE.purchases || [];` before
  // this file was extracted from app.js — safe there because it ran after
  // APP_STATE's own top-level declaration in the same script. This file
  // loads before app.js defines APP_STATE, so the same guard moved inside
  // the one function that needs it; the assignment is idempotent, so
  // running it per-call instead of once-at-load is behaviorally identical.
  APP_STATE.purchases = APP_STATE.purchases || [];
  const lines = (items || []).filter(i => i.qty > 0);
  if (!lines.length) return;

  // Purchase GST uses the same engine as sales so input tax and output tax
  // are computed identically — a mismatch between the two is exactly what
  // makes a GSTR-3B reconciliation fail.
  const includeGst = APP_STATE.tenantProfile.gstPriceMode === 'inclusive';
  const priced = lines.map(l => ({
    ...l,
    ...TaxEngine.computeLine({ price: l.cost, qty: l.qty, gstRate: l.gst, includeGst })
  }));
  const totals = TaxEngine.computeInvoiceTotals(priced);

  const purchase = {
    idempotency_key: SyncEngine.generateIdempotencyKey(),
    vendor: vendor || {},
    billNo: billNo || '',
    // Division is scoped server-side to its vendor (same name under two
    // different companies must not collide) — see create_purchase_atomic.
    divisionName: divisionName || '',
    billDate: new Date().toISOString().slice(0, 10),
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toISOString(),
    taxable: totals.taxable,
    gstTotal: totals.gstTotal,
    roundOff: totals.roundOff,
    total: totals.total,
    interstate: TaxEngine.isInterstate({
      customerGstin: vendor?.gstin || '',
      customerStateCode: vendor?.stateCode || '',
      shopStateCode: APP_STATE.tenantProfile.stateCode || ''
    }),
    paymentStatus: 'unpaid',
    amountPaid: 0,
    source,
    items: priced
  };

  APP_STATE.purchases.push(purchase);
  persistState();

  if (APP_STATE.cloudSession && navigator.onLine) {
    SB.savePurchase(APP_STATE.tenantProfile.shopId, purchase).then(({ data, error, errorCode }) => {
      if (isFatalSyncError(error, errorCode)) SyncEngine.enqueue(purchase, 'purchase');
      else reportRpcSkipWarnings(data);
      updateSyncIndicator();
      APP_STATE.vendorsLoaded = false; // force a refetch so the new/updated division shows up next time Khata → Vendors opens
    });
  } else {
    SyncEngine.enqueue(purchase, 'purchase');
  }
}

/* ==========================================================================
   AI PURCHASE INGESTION — client side
   The Edge Function returns a validated, reconciled bill (header + grouped
   items + derived totals + warnings). This screen's job is to make a human
   confirm it before anything touches stock, because an OCR mistake written
   into inventory is far more expensive to unwind than one caught here.
   ========================================================================== */
async function processAiInvoice(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!navigator.onLine) {
    showSaasToast('AI reading needs an internet connection. Use Manual Entry for now.', 4000, 'err');
    event.target.value = '';
    return;
  }
  if (!APP_STATE.cloudSession) {
    showSaasToast('Sign in to your cloud account to use AI invoice reading.', 4000, 'err');
    event.target.value = '';
    return;
  }

  setDisplay('aiProgressBox', 'block');
  setTxt('aiProgressText', 'Uploading and reading the bill…');
  setDisplay('aiStagingSection', 'none');

  const { bill, error } = await SB.parseInvoiceImage(file);

  setDisplay('aiProgressBox', 'none');
  event.target.value = ''; // allow re-uploading the same file after a fix

  if (error) {
    showSaasToast(`AI reading failed: ${error}`, 6000, 'err');
    return;
  }

  const items = bill?.bill_items || [];
  if (!items.length) {
    showSaasToast('No line items could be read. Try a flatter, better-lit photo — or use Manual Entry.', 6000, 'err');
    return;
  }

  APP_STATE.aiBill = bill;

  // Flatten to the staging shape, keeping every tracking identifier.
  APP_STATE.aiStagingItems = items.map(it => {
    const tm = it.tracking_metadata || {};
    return {
      name: it.product_name,
      hsn: it.hsn_sac || '',
      gst: Number(it.gst_percentage) || 0,
      qty: Number(it.quantity) || 0,
      cost: Number(it.unit_rate) || 0,
      lineTotal: Number(it.line_total_inclusive) || 0,
      serials: Array.isArray(tm.serial_or_imei) ? tm.serial_or_imei : [],
      batch: tm.batch_number || '',
      expiry: tm.expiry_date || '',
      huid: tm.hudi_or_other_id || '',
      // Resolved against existing stock so the reviewer can see at a glance
      // whether this is a restock or a brand-new SKU.
      matchedId: matchInventoryItem(it.product_name)?.id || null
    };
  });

  renderAiBillHeader(bill);
  renderAiStagingTable();
  setDisplay('aiStagingSection', 'block');
}

// Fuzzy-matches an extracted product name to existing stock. Exact match
// first, then a normalised compare — OCR routinely returns
// "Samsung  Galaxy A55" for an item saved as "Samsung Galaxy A55", and a
// strict compare would create a duplicate SKU with its own serial pool.
function matchInventoryItem(name) {
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(name);
  if (!target) return null;
  const inv = APP_STATE.inventory || [];
  return inv.find(i => norm(i.name) === target)
      || inv.find(i => norm(i.name).includes(target) || target.includes(norm(i.name)))
      || null;
}

function renderAiBillHeader(bill) {
  const h = bill.bill_header || {};
  const sum = bill.bill_summary || {};
  const meta = bill.extraction_meta || {};

  setTxt('aiVendorName', h.vendor_name || 'Not detected');
  setTxt('aiInvoiceNo', h.invoice_number || 'Not detected');
  setTxt('aiInvoiceDate', h.invoice_date || 'Not detected');
  setTxt('aiSupplierGstin', h.supplier_gstin || 'Not detected');
  setTxt('aiBillTotal', `₹${(sum.grand_total || 0).toFixed(2)}`);

  // Confidence is shown prominently rather than buried: a "low" badge is the
  // signal to check this bill against the paper before merging.
  const badge = $id('aiConfidenceBadge');
  if (badge) {
    const c = meta.confidence || 'medium';
    badge.className = `pill ${c === 'high' ? 'paid' : c === 'medium' ? 'pending' : 'overdue'}`;
    badge.innerText = `${c.toUpperCase()} CONFIDENCE`;
  }

  const warnBox = $id('aiWarningsBox');
  if (warnBox) {
    const warnings = meta.warnings || [];
    if (!warnings.length) {
      warnBox.style.display = 'none';
    } else {
      warnBox.style.display = 'block';
      warnBox.innerHTML = `<strong>${warnings.length} thing(s) to check:</strong><ul>` +
        warnings.map(w => `<li>${esc(w)}</li>`).join('') + `</ul>`;
    }
  }

  // Show the model's own total next to the derived one when they disagree —
  // the reviewer needs to see both numbers to decide which is right.
  const cmp = $id('aiTotalCompare');
  if (cmp) {
    const printed = sum.printed_grand_total;
    if (printed && Math.abs(printed - (sum.grand_total || 0)) > 1) {
      cmp.style.display = 'block';
      cmp.innerHTML = `Bill shows <strong>₹${printed.toFixed(2)}</strong>, line items add to <strong>₹${(sum.grand_total || 0).toFixed(2)}</strong>. Verify against the paper before merging.`;
    } else {
      cmp.style.display = 'none';
    }
  }
}

function renderAiStagingTable() {
  const tbody = $id('aiStagingBody');
  setTxt('aiStagingCount', APP_STATE.aiStagingItems.length);
  if (!tbody) return;

  tbody.innerHTML = APP_STATE.aiStagingItems.map((it, idx) => {
    const ids = [
      ...it.serials,
      it.batch ? `Batch ${it.batch}` : '',
      it.expiry ? `Exp ${it.expiry}` : '',
      it.huid ? `HUID ${it.huid}` : ''
    ].filter(Boolean);

    const serialWarn = it.serials.length > 0 && it.serials.length !== it.qty;

    return `<tr>
      <td>
        <strong>${esc(it.name)}</strong>
        ${it.matchedId
          ? '<br><span class="pill info" style="margin-top:3px;">Restock</span>'
          : '<br><span class="pill draft" style="margin-top:3px;">New product</span>'}
      </td>
      <td><code>${esc(it.hsn || '—')}</code></td>
      <td style="max-width:200px; font-size:0.74rem;">
        ${ids.length ? ids.map(v => `<code>${esc(v)}</code>`).join('<br>') : '<span style="color:var(--text-faint);">none</span>'}
        ${serialWarn ? `<br><span style="color:var(--danger); font-size:0.7rem;">${it.serials.length} ID(s) for ${it.qty} unit(s)</span>` : ''}
      </td>
      <td style="text-align:center;">${it.gst}%</td>
      <td style="text-align:center;">
        <input type="number" min="0" value="${it.qty}" style="width:58px; padding:5px; text-align:center; border:1px solid var(--border); border-radius:7px;"
               oninput="editAiStagingField(${idx}, 'qty', this.value)">
      </td>
      <td style="text-align:right;">
        <input type="number" min="0" step="0.01" value="${it.cost}" style="width:84px; padding:5px; text-align:right; border:1px solid var(--border); border-radius:7px;"
               oninput="editAiStagingField(${idx}, 'cost', this.value)">
      </td>
      <td style="text-align:center;">
        <button class="btn-pill secondary" style="padding:4px 9px; font-size:0.7rem;" onclick="discardAiStagingItem(${idx})">Drop</button>
      </td>
    </tr>`;
  }).join('');
}

// Every extracted value stays editable. OCR is a first draft, not an
// authority — the shop owner looking at the paper bill is.
function editAiStagingField(idx, field, value) {
  const it = APP_STATE.aiStagingItems[idx];
  if (!it) return;
  const n = parseFloat(value);
  it[field] = isFinite(n) && n >= 0 ? n : 0;
}

function discardAiStagingItem(idx) {
  APP_STATE.aiStagingItems.splice(idx, 1);
  renderAiStagingTable();
  if (!APP_STATE.aiStagingItems.length) setDisplay('aiStagingSection', 'none');
}

/* Commits the whole reviewed bill: stock in, purchase recorded, vendor
   payables updated — one confirmation, one atomic server call. */
function commitAiBill() {
  const staged = APP_STATE.aiStagingItems || [];
  if (!staged.length) { showSaasToast('Nothing to merge.', 3000, 'err'); return; }

  const zeroQty = staged.filter(i => i.qty <= 0);
  if (zeroQty.length) {
    showSaasToast(`${zeroQty.length} line(s) have quantity 0 — set a quantity or drop them first.`, 5000, 'err');
    return;
  }

  const header = APP_STATE.aiBill?.bill_header || {};
  const purchaseLines = [];

  staged.forEach(st => {
    let target = st.matchedId ? APP_STATE.inventory.find(i => i.id === st.matchedId) : null;

    if (target) {
      target.stock += st.qty;
      if (st.cost > 0) target.cost = st.cost;
      if (st.hsn) target.hsn = st.hsn;
    } else {
      // Category is inferred from which identifier type the bill carried —
      // a batch+expiry is a pharmacy line, a HUID is jewellery, a 15-digit
      // IMEI is electronics. Better than defaulting everything to one.
      const category =
        st.huid ? 'Jewelry'
        : (st.batch || st.expiry) ? 'Pharmacy'
        : st.serials.some(s => /^\d{15}$/.test(s)) ? 'Electronics'
        : (APP_STATE.tenantProfile.assignedIndustry !== 'All'
            ? APP_STATE.tenantProfile.assignedIndustry : 'Grocery');

      const initialMeta =
        category === 'Electronics' ? { imei: '', warranty: '' }
        : category === 'Jewelry' ? { karat: '22K', netWt: 0, grossWt: 0, making: 0 }
        : category === 'Pharmacy' ? { batch: st.batch || '', expiry: st.expiry || '' }
        : { pack: '' };

      target = {
        id: crypto.randomUUID(),
        name: st.name, category, barcode: '',
        hsn: st.hsn || APP_STATE.tenantProfile.defaultHsn || '',
        gst: st.gst, cost: st.cost,
        price: st.cost > 0 ? TaxEngine.round2(st.cost * 1.2) : 0,
        stock: st.qty,
        serials: [], huids: [], batches: [],
        meta: /** @type {any} */ (initialMeta)
      };
      APP_STATE.inventory.push(target);
    }

    // Attach identifiers to the right pool for the item's category.
    if (st.serials.length) {
      if (target.category === 'Jewelry') {
        target.huids = target.huids || [];
        st.serials.forEach(v => { if (!target.huids.includes(v)) target.huids.push(v); });
      } else {
        target.serials = target.serials || [];
        st.serials.forEach(v => { if (!target.serials.includes(v)) target.serials.push(v); });
      }
    }
    if (st.huid && !(target.huids || []).includes(st.huid)) {
      target.huids = target.huids || [];
      target.huids.push(st.huid);
    }
    if (st.batch) {
      target.batches = target.batches || [];
      target.batches.push({ batch: st.batch, expiry: st.expiry || '', stock: st.qty });
    }

    syncItemToCloud(target);

    purchaseLines.push({
      id: target.id, name: target.name, hsn: target.hsn, gst: st.gst,
      qty: st.qty, cost: st.cost, price: target.price,
      identifier: st.serials[0] || st.batch || st.huid || '',
      expiry: st.expiry || ''
    });
  });

  recordPurchaseBill({
    vendor: {
      name: header.vendor_name || 'Unknown Supplier',
      gstin: header.supplier_gstin || '',
      stateCode: (header.supplier_gstin || '').slice(0, 2)
    },
    billNo: header.invoice_number || '',
    items: purchaseLines,
    source: 'ai_ocr'
  });

  persistState();
  APP_STATE.aiStagingItems = [];
  APP_STATE.aiBill = null;
  setDisplay('aiStagingSection', 'none');
  closeInwardModal();
  renderCatalog();
  renderAlertCentre();
  showSaasToast(`${purchaseLines.length} item(s) merged into stock and the supplier bill recorded.`, 4500);
}

/* commitSingleAiItem / commitAllAiItems removed — superseded by
   commitAiBill(), which merges the whole reviewed bill atomically and
   records the supplier invoice behind it. */

window.onPurVendorInput = onPurVendorInput;
window.populateDivisionDatalist = populateDivisionDatalist;
window.openInwardPurchaseModal = openInwardPurchaseModal;
window.closeInwardModal = closeInwardModal;
window.toggleInwardMode = toggleInwardMode;
window.syncItemToCloud = syncItemToCloud;
window.populateRestockPicker = populateRestockPicker;
window.prefillFromExistingItem = prefillFromExistingItem;
window.saveManualPurchase = saveManualPurchase;
window.recordPurchaseBill = recordPurchaseBill;
window.processAiInvoice = processAiInvoice;
window.matchInventoryItem = matchInventoryItem;
window.renderAiBillHeader = renderAiBillHeader;
window.renderAiStagingTable = renderAiStagingTable;
window.editAiStagingField = editAiStagingField;
window.discardAiStagingItem = discardAiStagingItem;
window.commitAiBill = commitAiBill;
