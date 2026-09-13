/* ==========================================================================
   BILLNAW — GST CONFIGURATION & TAX ENGINE
   Loaded before app.js.

   WHY THIS FILE EXISTS: GST slabs change with budgets (they have changed
   several times since 2017). Hard-coding 5/12/18/28 into dropdowns across
   the app means a rate change is a code deploy. Here they're data: editable
   in Settings, versioned with an effective-from date, and persisted per
   shop. Historical invoices keep the rate they were billed at — recomputing
   old invoices at new rates would corrupt filed returns.
   ========================================================================== */

// Official GST state codes (first 2 digits of every GSTIN).
const GST_STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory'
};

// Default slabs as of the current build. Editable per shop in Settings —
// see GstConfig.setSlabs(). Adding a slab here does NOT retroactively
// change any saved invoice.
const DEFAULT_GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

const GstConfig = {
  storageKey: 'bn_gst_config',

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (Array.isArray(cfg.slabs) && cfg.slabs.length) return cfg;
      }
    } catch (e) { /* fall through to defaults */ }
    return { slabs: [...DEFAULT_GST_SLABS], cessEnabled: false, updatedAt: null };
  },

  save(cfg) {
    cfg.updatedAt = new Date().toISOString();
    localStorage.setItem(this.storageKey, JSON.stringify(cfg));
  },

  getSlabs() { return this.load().slabs; },

  setSlabs(slabArray) {
    const clean = slabArray
      .map(s => parseFloat(s))
      .filter(s => !isNaN(s) && s >= 0 && s <= 100)
      .sort((a, b) => a - b);
    if (!clean.length) return { error: 'At least one valid GST rate is required.' };
    const cfg = this.load();
    cfg.slabs = clean;
    this.save(cfg);
    return { slabs: clean };
  },

  // Repopulates every GST-rate dropdown in the app from current config, so
  // a slab change in Settings is reflected everywhere without a reload.
  refreshAllRateSelects() {
    const slabs = this.getSlabs();
    $qa('select[data-gst-rate-select]').forEach(sel => {
      const previous = sel.value;
      sel.innerHTML = slabs.map(s => `<option value="${s}">${s}%</option>`).join('');
      if (slabs.map(String).includes(previous)) sel.value = previous;
    });
  }
};

/* ==========================================================================
   TAX COMPUTATION
   Single source of truth. Every screen that shows tax must call these —
   duplicated arithmetic is how invoice totals and report totals drift apart.
   ========================================================================== */
const TaxEngine = {
  // JavaScript's Math.round breaks ties toward +Infinity, so +0.005 rounds
  // to 0.01 but -0.005 rounds to 0 — the same magnitude treated differently
  // by sign. Round-off adjustments and credit-note amounts are routinely
  // negative, so this rounds half AWAY FROM ZERO in both directions, which
  // is the convention Indian invoicing (and every accountant) expects.
  round2(n) {
    if (!isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  },

  // Resolve place of supply. Priority:
  //   1. Customer GSTIN state code (most authoritative — it's registered)
  //   2. Explicitly selected billing state (covers B2C, who have no GSTIN)
  //   3. Shop's own state (assume walk-in local customer)
  resolvePlaceOfSupply({ customerGstin, customerStateCode, shopStateCode }) {
    const fromGstin = (customerGstin || '').trim().slice(0, 2);
    if (fromGstin && GST_STATE_CODES[fromGstin]) return fromGstin;
    if (customerStateCode && GST_STATE_CODES[customerStateCode]) return customerStateCode;
    return shopStateCode || '';
  },

  isInterstate({ customerGstin, customerStateCode, shopStateCode }) {
    if (!shopStateCode) return false;
    const pos = this.resolvePlaceOfSupply({ customerGstin, customerStateCode, shopStateCode });
    if (!pos) return false;
    return pos !== shopStateCode;
  },

  // Computes one line item's tax. Rate is captured onto the line so the
  // invoice is immune to later slab changes. If the user enters a price that
  // already includes GST, we reverse-calculate the base amount instead of
  // double-counting the tax.
  computeLine({ price, qty, gstRate, includeGst = false }) {
    const unitPrice = Number(price) || 0;
    const quantity = Number(qty) || 0;
    const rate = Number(gstRate) || 0;
    const netUnit = includeGst && rate > 0 ? this.round2(unitPrice / (1 + (rate / 100))) : unitPrice;
    const taxableValue = this.round2(netUnit * quantity);
    const gstAmount = includeGst
      ? this.round2((unitPrice * quantity) - taxableValue)
      : this.round2(taxableValue * (rate / 100));
    return {
      taxableValue,
      gstAmount,
      totalAmount: this.round2((includeGst ? unitPrice * quantity : taxableValue + gstAmount)),
      gstRateAtBilling: rate,
      gstModeAtBilling: includeGst ? 'inclusive' : 'exclusive'
    };
  },

  // Totals for a whole cart, including the visible round-off.
  computeInvoiceTotals(lines) {
    const taxable = this.round2(lines.reduce((s, l) => s + l.taxableValue, 0));
    const gstTotal = this.round2(lines.reduce((s, l) => s + l.gstAmount, 0));
    const precise = this.round2(taxable + gstTotal);
    const total = Math.round(precise);
    return { taxable, gstTotal, precise, total, roundOff: this.round2(total - precise) };
  },

  // HSN-wise grouping used by both the printed invoice and GSTR-1 report,
  // so those two can never disagree.
  groupByHsn(items, interstate) {
    const groups = {};
    items.forEach(it => {
      const rate = it.gstRateAtBilling !== undefined ? it.gstRateAtBilling : it.gst;
      const key = `${it.hsn}|${rate}`;
      if (!groups[key]) groups[key] = { hsn: it.hsn, gstRate: rate, taxable: 0, gstAmt: 0, cgst: 0, sgst: 0, igst: 0 };
      groups[key].taxable = this.round2(groups[key].taxable + it.taxableValue);
      groups[key].gstAmt = this.round2(groups[key].gstAmt + it.gstAmount);
    });
    Object.values(groups).forEach(g => {
      if (interstate) {
        g.igst = g.gstAmt;
      } else {
        g.cgst = this.round2(g.gstAmt / 2);
        // Assign the remainder to SGST so cgst+sgst always equals gstAmt
        // exactly — naive halving of an odd paisa amount loses ₹0.01 per
        // line, which shows up as reports not tying to invoices.
        g.sgst = this.round2(g.gstAmt - g.cgst);
      }
    });
    return Object.values(groups);
  },

  // Amount in words — legally expected on Indian tax invoices.
  amountInWords(num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
    };
    const rupees = Math.floor(Math.abs(num));
    const paise = Math.round((Math.abs(num) - rupees) * 100);
    let out = rupees === 0 ? 'Zero' : inWords(rupees);
    out += ' Rupees';
    if (paise > 0) out += ' and ' + inWords(paise) + ' Paise';
    return out + ' Only';
  }
};

window.GST_STATE_CODES = GST_STATE_CODES;
window.GstConfig = GstConfig;
window.TaxEngine = TaxEngine;
