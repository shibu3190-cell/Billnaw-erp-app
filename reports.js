/* ==========================================================================
   BILLNAW — REPORTS & DASHBOARD ENGINE
   Extracted verbatim from app.js (Phase 4 continuation of the modernization
   migration — structural relocation only, no logic changed). Report
   drill-down (party outstanding/GSTR-1/serial tracking/stock summary/sales
   daybook), dashboard KPIs/donut/activity feed/mobile invoice cards,
   receivables ageing, the revenue trend chart, and report CSV export/print.

   Deliberately excludes several functions that sit physically among these
   in app.js but aren't reports: loadSubscriptionPanel/currentPlanUnlocksAll
   (billing/subscription), switchView (core view-navigation infra, called
   from everywhere including outside reports), openSearchModal/
   closeSearchModal/handleSearchModalInput (global command-palette search),
   toggleSidebarDrawer/closeSidebarDrawer (nav chrome), populateStateDropdowns
   and neighbours (customer/party entry form), filterSector/handleSearch/
   handleGlobalSearch (catalogue search, already kept in app.js during the
   inventory extraction), and exportData (generic khata-ledger CSV export,
   not report-specific). Each was checked individually, not assumed.

   Depends on globals defined elsewhere and relies on the fact that classic
   (non-module) <script> tags share one top-level lexical scope across the
   whole page — APP_STATE, $id/$q/$qa (dom.js), esc/fmtCost/r2/setTxt/
   setDisplay/renderAlertCentre/renderCatalog/renderKhataView/
   openInvoiceActionPopup/switchView/closeSettingsPanel (app.js),
   renderCustomer360Profile (customers.js), TaxEngine/GST_STATE_CODES
   (gstConfig.js), getLowStockItems (alertEngine.js), downloadCSV
   (exportEngine.js) are all resolved at call time, same as every other
   extracted engine file.

   Load order relative to app.js does not matter for that reason, but this
   loads alongside the other extracted engines (before app.js) to keep the
   convention consistent and easy to scan in index.html.
   ========================================================================== */

/* ==========================================================================
   REPORTS & DASHBOARD CONTROLLER
   ========================================================================== */
function openReport(reportKey, presetPhone) {
  APP_STATE.currentReportKey = reportKey;
  setDisplay('reportsHubView', 'none');
  setDisplay('reportsDetailView', 'block');

  const titleMap = {
    'cust_360': 'Customer 360° Profile & Lifetime History',
    'party_outstanding': 'Party Wise Outstanding Ledger',
    'gstr1': 'GSTR-1 Sales & HSN Return',
    'serial_tracking': 'Serial Number / IMEI / HUID Device Audit',
    'stock_summary': 'Stock Summary & Valuation',
    'sales_summary': 'Sales Daybook'
  };
  setTxt('drillReportTitle', titleMap[reportKey] || 'Business Report');

  const isC360 = reportKey === 'cust_360';
  setDisplay('cust360SelectorWrap', isC360 ? 'block' : 'none');
  setDisplay('cust360HeaderStats', isC360 ? 'grid' : 'none');

  if (isC360) {
    // Search box replaced the old dropdown — deep-linking now just picks
    // a specific customer directly, and otherwise shows the highest-value
    // customer by default rather than an arbitrary first row.
    const target = (presetPhone && APP_STATE.customers.some(c => c.phone === presetPhone))
      ? APP_STATE.customers.find(c => c.phone === presetPhone)
      : [...APP_STATE.customers].sort((a, b) => (b.totalOrdersVal || 0) - (a.totalOrdersVal || 0))[0];

    if (target) {
      setVal('cust360SearchInput', target.name);
      renderCustomer360Profile(target.phone);
    } else {
      const thead = $id('drillTableHead');
      if (thead) thead.innerHTML = '';
      const tbody = $id('drillTableBody');
      if (tbody) tbody.innerHTML = `<tr><td style="text-align:center; color:var(--text-muted); padding:24px;">No customers yet — search will populate once you have some.</td></tr>`;
    }
  } else {
    renderActiveReportData();
  }
}

/* ==========================================================================
   DASHBOARD CARD DRILL-THROUGH
   Every KPI card is clickable and lands on a filtered invoice list that
   explains the number, with Excel/CSV export from there. A dashboard figure
   a shop owner can't click into is a number they have to trust blindly —
   this makes every headline value auditable in two taps.
   ========================================================================== */
const DASH_CARD_FILTERS = {
  all:   { label: 'All invoices',                     test: () => true },
  khata: { label: 'Credit (Khata) sales — unpaid',    test: s => s.tender === 'Khata' },
  paid:  { label: 'Paid sales (Cash / UPI / Card)',   test: s => s.tender !== 'Khata' },
  due:   { label: 'Parties with outstanding balance', test: null }  // party-level, not invoice-level
};

function drillDashboardCard(key) {
  const cfg = DASH_CARD_FILTERS[key];
  if (!cfg) return;

  switchView('reports');
  setDisplay('reportsHubView', 'none');
  setDisplay('reportsDetailView', 'block');
  setDisplay('cust360SelectorWrap', 'none');
  setDisplay('cust360HeaderStats', 'none');

  if (key === 'due') {
    // Outstanding is a property of a party, not of one invoice — send this
    // card to the ageing report rather than a filtered invoice list, which
    // would double-count a customer with several unpaid bills.
    APP_STATE.currentReportKey = 'party_outstanding';
    setTxt('drillReportTitle', 'Receivables Ageing');
    setTxt('drillFilterLabel', 'Parties with an outstanding balance, bucketed by age');
    renderActiveReportData();
    return;
  }

  APP_STATE.currentReportKey = `dash_${key}`;
  APP_STATE.dashDrillFilter = key;
  setTxt('drillReportTitle', 'Invoice Register');
  setTxt('drillFilterLabel', cfg.label);
  renderDashDrillTable(key);
}

function renderDashDrillTable(key) {
  const thead = $id('drillTableHead');
  const tbody = $id('drillTableBody');
  if (!thead || !tbody) return;

  const cfg = DASH_CARD_FILTERS[key];
  const rows = (APP_STATE.sales || []).filter(cfg.test);

  thead.innerHTML = `<tr>
    <th>Invoice</th><th>Date</th><th>Party</th><th>Phone</th><th>Mode</th>
    <th style="text-align:right;">Taxable</th>
    <th style="text-align:right;">GST</th>
    <th style="text-align:right;">Total</th>
    <th>Status</th></tr>`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:26px;">No invoices match this filter yet.</td></tr>`;
    return;
  }

  let tT = 0, tG = 0, tTot = 0;
  tbody.innerHTML = [...rows].reverse().map(s => {
    tT = TaxEngine.round2(tT + (s.taxable || 0));
    tG = TaxEngine.round2(tG + (s.gstTotal || 0));
    tTot = TaxEngine.round2(tTot + (s.total || 0));

    // A returned invoice still appears — it must, for the audit trail — but
    // is visually marked so a total that includes it isn't misread.
    let pill = 'paid', label = 'PAID';
    if (s.status === 'returned') { pill = 'overdue'; label = 'RETURNED'; }
    else if (s.status === 'partially_returned') { pill = 'pending'; label = 'PART. RETURNED'; }
    else if (s.tender === 'Khata') {
      const age = Math.floor((Date.now() - new Date(s.timestamp).getTime()) / 86400000);
      pill = age > 30 ? 'overdue' : 'pending';
      label = age > 30 ? `${age}D OVERDUE` : 'DUE';
    }

    return `<tr>
      <td><strong>${esc(s.invoiceNo)}</strong></td>
      <td>${s.date}</td>
      <td>${esc(s.customer?.name || 'Cash Customer')}</td>
      <td>${esc(s.customer?.phone || '-')}</td>
      <td>${esc(s.tender)}</td>
      <td style="text-align:right;">₹${(s.taxable || 0).toFixed(2)}</td>
      <td style="text-align:right;">₹${(s.gstTotal || 0).toFixed(2)}</td>
      <td style="text-align:right; font-weight:700;">₹${(s.total || 0).toFixed(2)}</td>
      <td><span class="pill ${pill}">${label}</span></td>
    </tr>`;
  }).join('') + `<tr style="font-weight:800; border-top:2px solid #ccc; background:#fafafa;">
      <td colspan="5">TOTAL — ${rows.length} invoice(s)</td>
      <td style="text-align:right;">₹${tT.toFixed(2)}</td>
      <td style="text-align:right;">₹${tG.toFixed(2)}</td>
      <td style="text-align:right;">₹${tTot.toFixed(2)}</td>
      <td>—</td>
    </tr>`;
}

function closeReportDetail() {
  setDisplay('reportsDetailView', 'none');
  setDisplay('reportsHubView', 'block');
}

function renderActiveReportData() {
  const thead = $id('drillTableHead');
  const tbody = $id('drillTableBody');
  if (!thead || !tbody) return;

  // Dashboard drill-throughs render their own table shape.
  if (String(APP_STATE.currentReportKey || '').startsWith('dash_')) {
    renderDashDrillTable(APP_STATE.dashDrillFilter);
    return;
  }

  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (APP_STATE.currentReportKey === 'party_outstanding') {
    // Receivables ageing. A single "Closing Balance" number tells an owner
    // nothing about collection risk — ₹50,000 due for 12 days and ₹50,000
    // due for 200 days are completely different problems. Buckets are
    // computed from the actual unpaid Khata invoice dates, not from the
    // customer record, because the record only holds a running total.
    const aged = computeReceivablesAgeing();

    thead.innerHTML = `<tr><th>Party Name</th><th>Phone</th>
      <th style="text-align:right;">0–30 d</th>
      <th style="text-align:right;">31–60 d</th>
      <th style="text-align:right;">61–90 d</th>
      <th style="text-align:right;">90+ d</th>
      <th style="text-align:right;">Total Due</th>
      <th>Oldest</th></tr>`;

    if (!aged.rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No outstanding receivables. Every party is settled.</td></tr>`;
    }

    aged.rows.forEach(r => {
      // 90+ is the bracket that actually predicts a write-off, so it gets
      // visual weight rather than sitting as one number among four.
      const risk = r.b90 > 0 ? 'color:var(--danger); font-weight:800;' : '';
      tbody.innerHTML += `<tr>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${esc(r.phone)}</td>
        <td style="text-align:right;">${r.b30 ? '₹' + r.b30.toFixed(2) : '–'}</td>
        <td style="text-align:right;">${r.b60 ? '₹' + r.b60.toFixed(2) : '–'}</td>
        <td style="text-align:right;">${r.b90 ? '₹' + r.b90.toFixed(2) : '–'}</td>
        <td style="text-align:right; ${risk}">${r.bOver ? '₹' + r.bOver.toFixed(2) : '–'}</td>
        <td style="text-align:right; font-weight:800;">₹${r.total.toFixed(2)}</td>
        <td>${r.oldestDays != null ? r.oldestDays + ' d' : '–'}</td>
      </tr>`;
    });

    if (aged.rows.length) {
      const t = aged.totals;
      tbody.innerHTML += `<tr style="font-weight:800; border-top:2px solid #ccc; background:#fafafa;">
        <td colspan="2">TOTAL RECEIVABLE</td>
        <td style="text-align:right;">₹${t.b30.toFixed(2)}</td>
        <td style="text-align:right;">₹${t.b60.toFixed(2)}</td>
        <td style="text-align:right;">₹${t.b90.toFixed(2)}</td>
        <td style="text-align:right; color:var(--danger);">₹${t.bOver.toFixed(2)}</td>
        <td style="text-align:right;">₹${t.total.toFixed(2)}</td>
        <td>–</td>
      </tr>`;
    }
  } else if (APP_STATE.currentReportKey === 'serial_tracking') {
    thead.innerHTML = `<tr><th>Product</th><th>Barcode</th><th>Identifier List (IMEI/HUID/Batch)</th><th>Category</th><th>Stock</th><th style="text-align:right;">Price</th></tr>`;
    APP_STATE.inventory.forEach(i => {
      let idList = '-';
      if (Array.isArray(i.serials) && i.serials.length) idList = i.serials.join(', ');
      else if (Array.isArray(i.huids) && i.huids.length) idList = i.huids.join(', ');
      else if (Array.isArray(i.batches) && i.batches.length) idList = i.batches.map(b => `${b.batch} (${b.expiry})`).join(', ');

      tbody.innerHTML += `<tr><td><strong>${esc(i.name)}</strong></td><td><code>${esc(i.barcode || '-')}</code></td><td><code>${esc(idList)}</code></td><td>${esc(i.category)}</td><td>${i.stock}</td><td style="text-align:right;">₹${i.price.toFixed(2)}</td></tr>`;
    });
  } else if (APP_STATE.currentReportKey === 'gstr1') {
    // HSN-wise summary across ALL invoices, split by CGST/SGST vs IGST per
    // invoice's own transaction type — mirrors what GSTR-1's HSN summary
    // table expects. This is a same-app report, not a government e-filing
    // export (no GSTN portal integration) — see notes at end of file.
    thead.innerHTML = `<tr><th>HSN/SAC</th><th>GST%</th><th style="text-align:right;">Taxable Value</th><th style="text-align:right;">CGST</th><th style="text-align:right;">SGST</th><th style="text-align:right;">IGST</th><th style="text-align:right;">Total Tax</th></tr>`;
    // Reuses TaxEngine.groupByHsn per invoice (same function the printed
    // invoice uses), then merges across invoices — guarantees the return
    // and the invoices agree to the paisa.
    const groups = {};
    APP_STATE.sales.forEach(inv => {
      TaxEngine.groupByHsn(inv.items || [], inv.interstate).forEach(g => {
        const key = `${esc(g.hsn)}|${g.gstRate}`;
        if (!groups[key]) groups[key] = { hsn: g.hsn, gst: g.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        groups[key].taxable = TaxEngine.round2(groups[key].taxable + g.taxable);
        groups[key].cgst = TaxEngine.round2(groups[key].cgst + g.cgst);
        groups[key].sgst = TaxEngine.round2(groups[key].sgst + g.sgst);
        groups[key].igst = TaxEngine.round2(groups[key].igst + g.igst);
      });
    });
    if (!Object.keys(groups).length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No sales recorded yet this period.</td></tr>`;
    }
    Object.values(groups).forEach(g => {
      const totalTax = TaxEngine.round2(g.cgst + g.sgst + g.igst);
      tbody.innerHTML += `<tr><td>${esc(g.hsn)}</td><td>${g.gst}%</td><td style="text-align:right;">₹${g.taxable.toFixed(2)}</td><td style="text-align:right;">₹${g.cgst.toFixed(2)}</td><td style="text-align:right;">₹${g.sgst.toFixed(2)}</td><td style="text-align:right;">₹${g.igst.toFixed(2)}</td><td style="text-align:right; font-weight:700;">₹${totalTax.toFixed(2)}</td></tr>`;
    });
  } else if (APP_STATE.currentReportKey === 'stock_summary') {
    const canSeeCost = APP_STATE.isOwner !== false;
    thead.innerHTML = canSeeCost
      ? `<tr><th>Product</th><th>Category</th><th style="text-align:right;">Stock Qty</th><th style="text-align:right;">Cost/Unit</th><th style="text-align:right;">Value at Cost</th><th style="text-align:right;">Value at Selling Price</th></tr>`
      : `<tr><th>Product</th><th>Category</th><th style="text-align:right;">Stock Qty</th><th style="text-align:right;">Selling Price</th><th style="text-align:right;">Value at Selling Price</th></tr>`;

    let totalCostVal = 0, totalSellVal = 0;
    APP_STATE.inventory.forEach(i => {
      const hasCost = i.cost !== null && i.cost !== undefined && !isNaN(i.cost);
      const costVal = hasCost ? TaxEngine.round2(i.cost * i.stock) : null;
      const sellVal = TaxEngine.round2((i.price || 0) * i.stock);
      if (costVal !== null) totalCostVal = TaxEngine.round2(totalCostVal + costVal);
      totalSellVal = TaxEngine.round2(totalSellVal + sellVal);

      tbody.innerHTML += canSeeCost
        ? `<tr><td><strong>${esc(i.name)}</strong></td><td>${esc(i.category)}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">${fmtCost(i.cost)}</td><td style="text-align:right;">${fmtCost(costVal)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`
        : `<tr><td><strong>${esc(i.name)}</strong></td><td>${esc(i.category)}</td><td style="text-align:right;">${i.stock}</td><td style="text-align:right;">₹${(i.price || 0).toFixed(2)}</td><td style="text-align:right;">₹${sellVal.toFixed(2)}</td></tr>`;
    });

    tbody.innerHTML += canSeeCost
      ? `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL STOCK VALUATION</td><td style="text-align:right;">₹${totalCostVal.toFixed(2)}</td><td style="text-align:right;">₹${totalSellVal.toFixed(2)}</td></tr>`
      : `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL AT SELLING PRICE</td><td style="text-align:right;">₹${totalSellVal.toFixed(2)}</td></tr>`;
  } else if (APP_STATE.currentReportKey === 'sales_summary') {
    thead.innerHTML = `<tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Mode</th><th style="text-align:right;">Taxable</th><th style="text-align:right;">GST</th><th style="text-align:right;">Total</th></tr>`;
    if (!APP_STATE.sales.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No invoices recorded yet.</td></tr>`;
    }
    let dayTaxable = 0, dayGst = 0, dayTotal = 0;
    [...APP_STATE.sales].reverse().forEach(inv => {
      dayTaxable = r2(dayTaxable + (inv.taxable || 0));
      dayGst = r2(dayGst + (inv.gstTotal || 0));
      dayTotal = r2(dayTotal + (inv.total || 0));
      tbody.innerHTML += `<tr class="clickable-row" onclick="openInvoiceActionPopup('${esc(inv.invoiceNo)}')"><td><strong>${esc(inv.invoiceNo)}</strong></td><td>${inv.date}</td><td>${esc(inv.customer?.name || 'Cash Customer')}</td><td>${esc(inv.tender)}</td><td style="text-align:right;">₹${(inv.taxable || 0).toFixed(2)}</td><td style="text-align:right;">₹${(inv.gstTotal || 0).toFixed(2)}</td><td style="text-align:right; font-weight:700;">₹${(inv.total || 0).toFixed(2)}</td></tr>`;
    });
    if (APP_STATE.sales.length) {
      tbody.innerHTML += `<tr style="font-weight:800; border-top:2px solid #ccc;"><td colspan="4">TOTAL</td><td style="text-align:right;">₹${dayTaxable.toFixed(2)}</td><td style="text-align:right;">₹${dayGst.toFixed(2)}</td><td style="text-align:right;">₹${dayTotal.toFixed(2)}</td></tr>`;
    }
  }
}

function filterReportsCategory(cat, btn) {
  $qa('.rep-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const cards = $qa('.report-section-card');
  cards.forEach(c => {
    const cardCats = c.getAttribute('data-cat') || '';
    c.style.display = (cat === 'All' || cardCats.includes(cat)) ? 'flex' : 'none';
  });
}

function renderDashboard() {
  const sales = APP_STATE.sales || [];

  // "Pending" = Khata (credit) sale not yet settled. "Confirmed"/"Delivered"
  // both map to Cash/UPI/Card sales that were paid at counter — this app has
  // no separate fulfillment step, so both buckets share the same paid-sales
  // set (kept as two labels because the dashboard UI already has both slots
  // and a shop owner scanning fast benefits from seeing the same number
  // twice more than from a misleading zero).
  const pending = sales.filter(s => s.tender === 'Khata');
  const paid = sales.filter(s => s.tender !== 'Khata');
  const totalRev = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const pendingVal = pending.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidVal = paid.reduce((sum, s) => sum + (s.total || 0), 0);
  const dueVal = (APP_STATE.customers || []).reduce((sum, c) => sum + (c.dues || 0), 0);
  const dueCount = (APP_STATE.customers || []).filter(c => (c.dues || 0) > 0).length;

  setTxt('dashTotalOrders', sales.length);
  setTxt('dashTotalSalesVal', `₹${totalRev.toLocaleString('en-IN')}`);
  renderKpiDeltas(sales);
  setTxt('dashPendingOrders', pending.length);
  setTxt('dashPendingSalesVal', `₹${pendingVal.toLocaleString('en-IN')}`);
  setTxt('dashConfirmedOrders', paid.length);
  setTxt('dashConfirmedSalesVal', `₹${paidVal.toLocaleString('en-IN')}`);
  setTxt('dashShippedOrders', paid.length);
  setTxt('dashShippedSalesVal', `₹${paidVal.toLocaleString('en-IN')}`);
  setTxt('dashDueCount', dueCount);
  setTxt('dashDueSalesVal', `₹${dueVal.toLocaleString('en-IN')}`);

  // Donut legend — real percentages instead of frozen "0 (0%)"
  const total = sales.length || 1;
  const pct = n => `${n} (${Math.round((n / total) * 100)}%)`;
  setTxt('dLegPending', pct(pending.length));
  setTxt('dLegConfirmed', pct(paid.length));
  setTxt('dLegShipped', pct(paid.length));
  setTxt('dLegCancelled', pct(dueCount));
  renderDonutChart(pending.length, paid.length, dueCount);
  renderTrendChart();
  renderAlertCentre();
  renderActivityFeed();
  renderMobileInvoiceCards();

  // Recent Invoices table
  const recentBody = $id('dashRecentOrdersBody');
  if (recentBody) {
    recentBody.innerHTML = '';
    if (!sales.length) {
      recentBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No invoices yet — make your first sale from the POS tab.</td></tr>`;
    }
    [...sales].reverse().slice(0, 8).forEach(s => {
      // Overdue is distinguished from merely-unpaid: a 90-day-old khata bill
      // and yesterday's are both "DUE", but only one needs chasing today.
      let cls = 'paid', label = 'PAID';
      if (s.tender === 'Khata') {
        const ageDays = Math.floor((Date.now() - new Date(s.timestamp).getTime()) / 86400000);
        cls = ageDays > 30 ? 'overdue' : 'pending';
        label = ageDays > 30 ? `${ageDays}D OVERDUE` : 'DUE';
      }
      recentBody.innerHTML += `<tr class="clickable-row" onclick="openInvoiceActionPopup('${esc(s.invoiceNo)}')"><td><strong>${esc(s.invoiceNo)}</strong></td><td>${esc(s.customer?.name || 'Cash Customer')}</td><td>${s.date}</td><td><span class="pill ${cls}">${label}</span></td><td style="text-align:right; font-weight:700;">₹${(s.total || 0).toFixed(2)}</td></tr>`;
    });
  }

  // Top Parties by lifetime value
  const topList = $id('topCustomersList');
  if (topList) {
    const ranked = [...(APP_STATE.customers || [])].sort((a, b) => (b.totalOrdersVal || 0) - (a.totalOrdersVal || 0)).slice(0, 5);
    topList.innerHTML = ranked.length
      ? ranked.map(c => `<div class="legend-row" style="padding:6px 0;"><div><strong>${esc(c.name)}</strong><br><small style="color:var(--text-muted);">${esc(c.phone)}</small></div><strong>₹${(c.totalOrdersVal || 0).toLocaleString('en-IN')}</strong></div>`).join('')
      : `<p style="color:var(--text-muted); font-size:0.85rem;">No customer purchase history yet.</p>`;
  }
}

function renderActivityFeed() {
  const feed = $id('activityFeed');
  if (!feed) return;

  const sales = [...(APP_STATE.sales || [])].sort((a, b) => {
    const ta = new Date(a.timestamp || a.date || Date.now()).getTime();
    const tb = new Date(b.timestamp || b.date || Date.now()).getTime();
    return tb - ta;
  });
  const lowStock = getLowStockItems ? getLowStockItems() : [];

  const items = [];
  sales.slice(0, 6).forEach(s => {
    items.push({
      icon: '✅',
      text: `${esc(s.invoiceNo || 'Sale')} · ${esc(s.customer?.name || 'Cash Customer')}`,
      meta: `${s.date || new Date(s.timestamp || Date.now()).toLocaleDateString('en-IN')} · ₹${(s.total || 0).toLocaleString('en-IN')}`,
      kind: 'sale'
    });
  });

  lowStock.slice(0, 3).forEach(item => {
    items.push({
      icon: '⚠️',
      text: `${esc(item.name || 'Item')} is low on stock`,
      meta: `Stock: ${item.stock ?? 0} · reorder ${item.reorderLevel ?? 'n/a'}`,
      kind: 'alert'
    });
  });

  if (!items.length) {
    feed.innerHTML = '<div class="activity-empty">No recent activity yet.</div>';
    return;
  }

  feed.innerHTML = items.slice(0, 8).map(entry => `
    <div class="activity-item">
      <span class="activity-icon">${entry.icon}</span>
      <div class="activity-copy">
        <strong>${entry.text}</strong>
        <small>${entry.meta}</small>
      </div>
    </div>
  `).join('');
}

function renderMobileInvoiceCards() {
  const host = $id('dashRecentOrdersMobile');
  if (!host) return;

  const sales = [...(APP_STATE.sales || [])].reverse().slice(0, 5);
  if (!sales.length) {
    host.innerHTML = '<div class="invoice-card empty">No invoices yet.</div>';
    return;
  }

  host.innerHTML = sales.map(s => {
    const customer = s.customer?.name || 'Cash Customer';
    const status = s.tender === 'Khata' ? 'Due' : 'Paid';
    const klass = s.tender === 'Khata' ? 'status due' : 'status paid';
    return `
      <div class="invoice-card" onclick="openInvoiceActionPopup('${esc(s.invoiceNo)}')">
        <div class="invoice-card-head">
          <strong>${esc(s.invoiceNo || 'INV')}</strong>
          <span class="${klass}">${status}</span>
        </div>
        <div class="invoice-card-body">
          <span>${esc(customer)}</span>
          <span>${esc(s.date || new Date(s.timestamp || Date.now()).toLocaleDateString('en-IN'))}</span>
        </div>
        <div class="invoice-card-foot">
          <span>₹${(s.total || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   RECEIVABLES AGEING
   Buckets unpaid Khata invoices by age. Falls back to putting a customer's
   whole balance in 0–30 only when we have no invoice history for them
   (e.g. an opening balance carried in from paper books) — better than
   dropping the amount entirely and under-reporting what's owed.
   ========================================================================== */
function computeReceivablesAgeing(asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  const DAY = 86400000;
  const byPhone = {};

  (APP_STATE.customers || []).forEach(c => {
    if ((c.dues || 0) <= 0) return;
    byPhone[c.phone] = {
      name: c.name, phone: c.phone,
      b30: 0, b60: 0, b90: 0, bOver: 0,
      total: TaxEngine.round2(c.dues), oldestDays: null,
      _allocated: 0
    };
  });

  // Newest-first: partial payments in this app reduce the running balance,
  // so the amount still outstanding is best matched against the most recent
  // credit sales, leaving genuinely old debt visible in the high brackets.
  const credit = (APP_STATE.sales || [])
    .filter(s => s.tender === 'Khata' && s.customer && byPhone[s.customer.phone])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  credit.forEach(s => {
    const row = byPhone[s.customer.phone];
    if (!row) return;
    const remaining = TaxEngine.round2(row.total - row._allocated);
    if (remaining <= 0) return;

    const amount = Math.min(s.total || 0, remaining);
    if (amount <= 0) return;

    const days = Math.max(0, Math.floor((now.getTime() - new Date(s.timestamp).getTime()) / DAY));
    if (days <= 30) row.b30 = TaxEngine.round2(row.b30 + amount);
    else if (days <= 60) row.b60 = TaxEngine.round2(row.b60 + amount);
    else if (days <= 90) row.b90 = TaxEngine.round2(row.b90 + amount);
    else row.bOver = TaxEngine.round2(row.bOver + amount);

    row._allocated = TaxEngine.round2(row._allocated + amount);
    if (row.oldestDays == null || days > row.oldestDays) row.oldestDays = days;
  });

  const rows = Object.values(byPhone);
  rows.forEach(r => {
    const unallocated = TaxEngine.round2(r.total - r._allocated);
    if (unallocated > 0.01) r.b30 = TaxEngine.round2(r.b30 + unallocated);
    delete r._allocated;
  });

  rows.sort((a, b) => (b.bOver - a.bOver) || (b.total - a.total));

  const totals = rows.reduce((t, r) => ({
    b30: TaxEngine.round2(t.b30 + r.b30),
    b60: TaxEngine.round2(t.b60 + r.b60),
    b90: TaxEngine.round2(t.b90 + r.b90),
    bOver: TaxEngine.round2(t.bOver + r.bOver),
    total: TaxEngine.round2(t.total + r.total)
  }), { b30: 0, b60: 0, b90: 0, bOver: 0, total: 0 });

  return { rows, totals };
}

/* ==========================================================================
   KPI TREND BADGES
   Compares the last 30 days against the 30 before it. A bare total tells an
   owner nothing about direction — "₹2.4L" is good or bad only relative to
   last month. Renders nothing when there's no prior period to compare
   against, rather than showing a fake +100%.
   ========================================================================== */
function renderKpiDeltas(sales) {
  const DAY = 86400000, now = Date.now();
  const inWindow = (s, from, to) => {
    const t = new Date(s.timestamp).getTime();
    return t >= now - from * DAY && t < now - to * DAY;
  };

  const curr = sales.filter(s => inWindow(s, 30, 0));
  const prev = sales.filter(s => inWindow(s, 60, 30));

  const sum = arr => arr.reduce((a, s) => a + (s.total || 0), 0);
  const paint = (elId, currVal, prevVal) => {
    const el = $id(elId);
    if (!el) return;
    if (!prevVal) { el.style.display = 'none'; return; }
    const pct = ((currVal - prevVal) / prevVal) * 100;
    const dir = pct > 0.5 ? 'up' : (pct < -0.5 ? 'down' : 'flat');
    el.style.display = 'inline-flex';
    el.className = `kpi-delta ${dir}`;
    el.innerText = `${dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→'} ${Math.abs(pct).toFixed(1)}%`;
  };

  paint('deltaRevenue', sum(curr), sum(prev));
  paint('deltaOrders', curr.length, prev.length);
}

function renderDonutChart(pending, confirmed, due) {
  const svg = $id('donutSvg');
  if (!svg) return;
  const total = pending + confirmed + due;
  if (total === 0) { svg.innerHTML = `<circle cx="70" cy="70" r="55" fill="none" stroke="#e5e7eb" stroke-width="18"/>`; return; }

  const segments = [
    { value: pending, color: '#f59e0b' },
    { value: confirmed, color: '#10b981' },
    { value: due, color: '#ef4444' },
  ];
  const r = 55, cx = 70, cy = 70, circumference = 2 * Math.PI * r;
  let offset = 0;
  svg.innerHTML = segments.map(seg => {
    const frac = seg.value / total;
    const dash = frac * circumference;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="18" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return circle;
  }).join('');
}

/* ==========================================================================
   ORDERS & SALES TREND CHART
   Hand-rolled SVG (no charting library) — buckets real invoices by day and
   draws revenue as an area+line with an order-count bar underlay.
   ========================================================================== */
function renderTrendChart(rangeDays) {
  const container = $id('splineChartContainer');
  if (!container) return;

  const days = rangeDays || APP_STATE.trendRangeDays || 30;
  const buckets = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: 0,
      orders: 0
    });
  }
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));

  (APP_STATE.sales || []).forEach(s => {
    // timestamp is ISO from cloud/local; fall back to parsing display date.
    let key = null;
    if (s.timestamp) key = new Date(s.timestamp).toISOString().slice(0, 10);
    if (key && byKey[key]) {
      byKey[key].revenue += (s.total || 0);
      byKey[key].orders += 1;
    }
  });

  const maxRev = Math.max(...buckets.map(b => b.revenue), 1);
  const maxOrders = Math.max(...buckets.map(b => b.orders), 1);

  const W = 640, H = 220, padL = 46, padR = 12, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = i => padL + (buckets.length === 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW);
  const y = v => padT + plotH - (v / maxRev) * plotH;

  const linePts = buckets.map((b, i) => `${x(i).toFixed(1)},${y(b.revenue).toFixed(1)}`).join(' ');
  const areaPts = `${padL},${padT + plotH} ${linePts} ${(padL + plotW).toFixed(1)},${padT + plotH}`;

  const barW = Math.max(2, (plotW / buckets.length) * 0.45);
  const bars = buckets.map((b, i) => {
    const bh = (b.orders / maxOrders) * (plotH * 0.35);
    return `<rect x="${(x(i) - barW / 2).toFixed(1)}" y="${(padT + plotH - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="#9333ea" opacity="0.18" rx="1"/>`;
  }).join('');

  // Y gridlines at 0/50/100% of max revenue
  const grid = [0, 0.5, 1].map(f => {
    const gy = padT + plotH - f * plotH;
    const val = Math.round(maxRev * f);
    return `<line x1="${padL}" y1="${gy}" x2="${padL + plotW}" y2="${gy}" stroke="#e5e7eb" stroke-width="1"/>
            <text x="${padL - 6}" y="${gy + 3}" text-anchor="end" font-size="9" fill="#8fa59c">₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}</text>`;
  }).join('');

  // Show ~6 x-axis labels regardless of range, so 30-day view stays readable
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const xLabels = buckets.map((b, i) =>
    i % labelEvery === 0
      ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#8fa59c">${b.label}</text>`
      : ''
  ).join('');

  const dots = buckets.map((b, i) =>
    b.orders > 0
      ? `<circle cx="${x(i).toFixed(1)}" cy="${y(b.revenue).toFixed(1)}" r="3" fill="#10b981"><title>${b.label}: ₹${b.revenue.toFixed(2)} · ${b.orders} order(s)</title></circle>`
      : ''
  ).join('');

  const totalRev = buckets.reduce((s, b) => s + b.revenue, 0);
  const totalOrd = buckets.reduce((s, b) => s + b.orders, 0);

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${grid}
      ${bars}
      <polygon points="${areaPts}" fill="url(#trendFill)"/>
      <polyline points="${linePts}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>
    <div style="display:flex; gap:16px; justify-content:center; font-size:0.72rem; color:var(--text-muted); margin-top:4px;">
      <span><span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;"></span> Revenue ₹${totalRev.toLocaleString('en-IN')}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:#9333ea;opacity:0.4;border-radius:2px;"></span> ${totalOrd} orders</span>
    </div>`;
}

function setTrendRange(days, el) {
  const value = parseInt(days, 10) || 30;
  APP_STATE.trendRangeDays = value;
  $qa('.time-pill').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.range) === value));
  if (el && el instanceof HTMLElement) el.classList.add('active');
  renderTrendChart(value);
}

function exportCurrentReportCSV() {
  // Reads whatever is currently rendered in the drill-down table and
  // exports exactly what the user sees, so the export always matches
  // the on-screen report (including its current filter/customer selection).
  const theadRow = $q('#drillTableHead tr');
  const bodyRows = $qa('#drillTableBody tr');
  if (!theadRow || !bodyRows.length) {
    alert("No data to export in this report.");
    return;
  }

  const headers = Array.from(theadRow.children).map(th => th.innerText.trim());
  const rows = [headers];
  bodyRows.forEach(tr => {
    const cells = Array.from(tr.children).map(td => td.innerText.trim());
    if (cells.length) rows.push(cells);
  });

  downloadCSV(`${APP_STATE.currentReportKey || 'report'}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function printReportDocument() { window.print(); }
