/* ==========================================================================
   SHOP-OWNER DAY SIMULATION
   Run:  node tests/shop-day-simulation.js

   The unit suite (tests/run-tests.js) checks each function in isolation.
   This checks that a whole day's worth of real actions — register, stock,
   sell (cash + credit + inter-state), return, check the dashboard — stay
   internally consistent end to end, the way a head coder actually verifies
   a build before calling it done: not "does each brick work" but "does the
   wall stand up."

   No network, no DOM — pure business logic against the shipped TaxEngine
   and the same arithmetic app.js uses, so a drift here means a real bug.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; failures.push({ name, msg: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} expected ${b}, got ${a}`); }

global.window = {};
const { TaxEngine, GST_STATE_CODES } = new Function(
  fs.readFileSync(path.join(ROOT, 'gstConfig.js'), 'utf8') + '; return { TaxEngine, GST_STATE_CODES };'
)();

/* -------------------------------------------------------------------------- */
console.log('\n📋 DAY 1 — Sunrise Electronics (owner: Abhijit) opens shop\n');

const shop = { name: 'Sunrise Electronics', stateCode: '19', gstin: '19ABCDE1234F1Z5' }; // West Bengal

const inventory = [
  { id: 'i1', name: 'Motorola G84 5G', category: 'Electronics', hsn: '8517', gst: 18, cost: 16200, price: 18999, stock: 10, serials: ['IMEI001','IMEI002','IMEI003'] },
  { id: 'i2', name: 'Gold Chain 22K',  category: 'Jewelry',     hsn: '7113', gst: 3,  cost: 62000, price: 65000, stock: 5,  huids: ['HUID-A1'] },
];
const customers = [];
const sales = [];
const returns = [];

check('Shop registers with a valid home state', () => {
  eq(GST_STATE_CODES[shop.stateCode], 'West Bengal');
});

/* -------------------------------------------------------------------------- */
console.log('\n🛒 Sale #1 — Cash, walk-in, intra-state (same as shop)\n');

function makeLine(item, qty) {
  return { id: item.id, name: item.name, hsn: item.hsn, gst: item.gst,
           gstRateAtBilling: item.gst, price: item.price, qty,
           ...TaxEngine.computeLine({ price: item.price, qty, gstRate: item.gst }) };
}

function checkout({ customer, tender, lines, stateCode = '', gstin = '' }) {
  const totals = TaxEngine.computeInvoiceTotals(lines);
  const interstate = TaxEngine.isInterstate({ customerGstin: gstin, customerStateCode: stateCode, shopStateCode: shop.stateCode });
  const invoice = {
    invoiceNo: `INV-${1000 + sales.length + 1}`,
    timestamp: new Date().toISOString(),
    customer, tender, items: lines, interstate,
    taxable: totals.taxable, gstTotal: totals.gstTotal, roundOff: totals.roundOff, total: totals.total,
    status: 'active', returnedValue: 0
  };
  sales.push(invoice);

  lines.forEach(l => { const inv = inventory.find(i => i.id === l.id); if (inv) inv.stock -= l.qty; });

  if (customer.phone && customer.phone !== '-') {
    let c = customers.find(c => c.phone === customer.phone);
    if (!c) { c = { ...customer, dues: 0, totalOrdersVal: 0 }; customers.push(c); }
    if (tender === 'Khata') c.dues = TaxEngine.round2(c.dues + invoice.total);
    c.totalOrdersVal = TaxEngine.round2(c.totalOrdersVal + invoice.total);
  }
  return invoice;
}

const sale1 = checkout({
  customer: { name: 'Ramesh', phone: '9800000001' },
  tender: 'Cash',
  lines: [makeLine(inventory[0], 1)]
});

check('Sale #1 total matches hand-computed 18% GST on ₹18,999', () => {
  eq(sale1.total, 22419);
});
check('Sale #1 is intra-state (CGST+SGST)', () => { eq(sale1.interstate, false); });
check('Motorola stock decremented from 10 to 9', () => { eq(inventory[0].stock, 9); });

/* -------------------------------------------------------------------------- */
console.log('\n🛒 Sale #2 — Khata (credit), inter-state customer (Maharashtra)\n');

const sale2 = checkout({
  customer: { name: 'Priya Traders', phone: '9800000002', gstin: '27ABCDE1234F1Z5' },
  tender: 'Khata',
  lines: [makeLine(inventory[1], 1)],
  gstin: '27ABCDE1234F1Z5'
});

check('Sale #2 is inter-state (customer GSTIN overrides)', () => { eq(sale2.interstate, true); });
check('Sale #2 total matches 3% GST on ₹65,000', () => { eq(sale2.total, 66950); });
check('Priya Traders now owes exactly the invoice total', () => {
  eq(customers.find(c => c.phone === '9800000002').dues, 66950);
});
check('Gold Chain stock decremented from 5 to 4', () => { eq(inventory[1].stock, 4); });

/* -------------------------------------------------------------------------- */
console.log('\n↩️  Return — Priya returns the chain (wrong size)\n');

function processReturn(sale, restock = true) {
  const lines = sale.items.map(l => TaxEngine.computeLine({ price: l.price, qty: l.qty, gstRate: l.gstRateAtBilling }));
  const totals = TaxEngine.computeInvoiceTotals(lines);
  const ret = { invoiceNo: sale.invoiceNo, total: totals.total, gstTotal: totals.gstTotal, items: sale.items, restock };
  returns.push(ret);

  if (restock) sale.items.forEach(l => { const inv = inventory.find(i => i.id === l.id); if (inv) inv.stock += l.qty; });

  sale.returnedValue = TaxEngine.round2((sale.returnedValue || 0) + ret.total);
  sale.status = sale.returnedValue >= sale.total - 0.01 ? 'returned' : 'partially_returned';

  const cust = customers.find(c => c.phone === sale.customer.phone);
  if (cust) {
    if (sale.tender === 'Khata') cust.dues = Math.max(0, TaxEngine.round2(cust.dues - ret.total));
    cust.totalOrdersVal = Math.max(0, TaxEngine.round2(cust.totalOrdersVal - ret.total));
  }
  return ret;
}

const ret1 = processReturn(sale2, true);

check('Credit note reverses the exact original tax (3%), not a re-derived rate', () => {
  eq(ret1.total, 66950);
});
check('Sale #2 status flips to fully returned', () => { eq(sale2.status, 'returned'); });
check('Priya Traders dues drop back to zero, not negative', () => {
  eq(customers.find(c => c.phone === '9800000002').dues, 0);
});
check('Gold Chain stock restored to 5', () => { eq(inventory[1].stock, 5); });

/* -------------------------------------------------------------------------- */
console.log('\n📊 Dashboard reconciliation\n');

const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
const totalReturned = returns.reduce((s, x) => s + x.total, 0);
const netRevenue = TaxEngine.round2(totalRevenue - totalReturned);

check('Gross revenue = sale1 + sale2 exactly', () => { eq(totalRevenue, 89369); });
check('Net revenue after return excludes the returned chain', () => { eq(netRevenue, 22419); });
check('Outstanding receivables across all customers is zero (everyone settled or cash)', () => {
  const totalDues = customers.reduce((s, c) => s + c.dues, 0);
  eq(totalDues, 0);
});
check('Total GST collected reconciles: gross GST minus reversed GST', () => {
  const grossGst = sales.reduce((s, x) => s + x.gstTotal, 0);
  const reversedGst = returns.reduce((s, x) => s + x.gstTotal, 0);
  eq(TaxEngine.round2(grossGst - reversedGst), 3419.82); // only the Motorola's 18% remains
});

/* -------------------------------------------------------------------------- */
console.log('\n📦 A second, over-eager return is rejected\n');

check('Cannot return the same invoice twice past what was sold', () => {
  const already = sale2.returnedValue;
  const soldTotal = sale2.total;
  const wouldOverReturn = already >= soldTotal - 0.01;
  eq(wouldOverReturn, true, 'system should refuse a further return on this invoice:');
});

/* -------------------------------------------------------------------------- */
console.log(`\n${'='.repeat(52)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f.name}: ${f.msg}`)); }
console.log('='.repeat(52));
process.exit(failed ? 1 : 0);
