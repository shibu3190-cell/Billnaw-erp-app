/* ==========================================================================
   BILLNAW — REPORTS & DASHBOARD DRILL-THROUGH ENGINE (part 1)
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). The Reports hub entry
   point (openReport) and dashboard KPI-card drill-through (every headline
   dashboard number is clickable into the filtered invoice list behind it).

   This is "reports" part 1, not the whole feature: the reports/dashboard
   code in app.js is NOT one contiguous block — it's interleaved with the
   Subscription & Billing panel, the generic switchView() navigation
   utility (used across every feature, not report-specific, so it stays
   in app.js), search, sidebar, and GST/printer settings sections. Rather
   than pull in unrelated code to make one big contiguous cut, this slice
   takes the two report-specific ranges that sit cleanly on their own;
   renderDashboard/renderActivityFeed/renderMobileInvoiceCards,
   computeReceivablesAgeing/renderKpiDeltas/renderDonutChart,
   renderTrendChart/setTrendRange, and exportCurrentReportCSV/
   printReportDocument remain in app.js for a follow-up slice.

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
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

window.openReport = openReport;
window.DASH_CARD_FILTERS = DASH_CARD_FILTERS;
window.drillDashboardCard = drillDashboardCard;
window.renderDashDrillTable = renderDashDrillTable;
window.closeReportDetail = closeReportDetail;
window.renderActiveReportData = renderActiveReportData;
