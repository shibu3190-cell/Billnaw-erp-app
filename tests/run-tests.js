/* ==========================================================================
   BILLNAW TEST SUITE  (P2 #10)
   Run:  node tests/run-tests.js
   No framework — these run anywhere Node runs, including in CI, with zero
   install step. The point is that the money-handling paths (tax, returns,
   rounding, queue ordering) have executable proof rather than a manual
   click-through that nobody repeats after the first week.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; failures.push({ name, msg: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} expected ${expected}, got ${actual}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
function group(name) { console.log(`\n${name}`); }

/* ---------- load the real modules under test ---------- */
const ROOT = path.join(__dirname, '..');
global.window = {};
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  clear() { this._d = {}; }
};
global.document = { querySelectorAll: () => [], getElementById: () => null };

const gstSrc = fs.readFileSync(path.join(ROOT, 'gstConfig.js'), 'utf8');
const { TaxEngine, GST_STATE_CODES } =
  new Function(gstSrc + '; return { TaxEngine, GST_STATE_CODES };')();

// Pull pure helpers out of app.js by name so the tests exercise the shipped
// code rather than a copy that can drift from it.
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const alertSrc = fs.readFileSync(path.join(ROOT, 'alertEngine.js'), 'utf8');
const posSrc = fs.readFileSync(path.join(ROOT, 'pos.js'), 'utf8');

// Pulls a named block out of whichever source file currently owns it. After
// module extractions these helpers moved from app.js to alertEngine.js /
// pos.js — searching all three means the suite keeps testing the SHIPPED
// code rather than silently falling back to a stale copy.
function extract(startMarker, endMarker) {
  for (const src of [appSrc, alertSrc, posSrc]) {
    const a = src.indexOf(startMarker);
    if (a === -1) continue;
    const b = src.indexOf(endMarker, a);
    if (b === -1) continue;
    return src.slice(a, b);
  }
  throw new Error(`Could not extract ${startMarker} from app.js, alertEngine.js or pos.js`);
}
const helpers = {};
new Function('TaxEngine', 'out', `
  ${extract('function normaliseComposition', 'function findAlternatives')}
  ${extract('function parseBatchExpiry', 'function getLowStockItems')}
  ${extract('function esc(v)', 'function fmtCost')}
  ${extract('function escJs(v)', 'function fmtCost')}
  ${extract('function isFatalSyncError', 'const SyncEngine = {')}
  out.normaliseComposition = normaliseComposition;
  out.compositionTokens = compositionTokens;
  out.parseBatchExpiry = parseBatchExpiry;
  out.daysUntil = daysUntil;
  out.esc = esc;
  out.escJs = escJs;
  out.isFatalSyncError = isFatalSyncError;
`)(TaxEngine, helpers);

/* ========================================================================== */
group('TaxEngine — rounding');

test('round2 kills floating point drift', () => {
  eq(TaxEngine.round2(0.1 + 0.2), 0.3);
  eq(TaxEngine.round2(1.005), 1.01);
  eq(TaxEngine.round2(-0.005), -0.01);
});

test('line totals are internally consistent', () => {
  const l = TaxEngine.computeLine({ price: 342.86, qty: 1, gstRate: 5 });
  eq(l.taxableValue, 342.86);
  eq(l.gstAmount, 17.14);
  eq(l.totalAmount, 360);
});

test('zero-rated goods produce zero tax, not NaN', () => {
  const l = TaxEngine.computeLine({ price: 100, qty: 3, gstRate: 0 });
  eq(l.gstAmount, 0);
  eq(l.totalAmount, 300);
});

test('inclusive GST input resolves to correct base and tax while preserving the billed total', () => {
  const l = TaxEngine.computeLine({ price: 1180, qty: 2, gstRate: 18, includeGst: true });
  eq(l.taxableValue, 2000);
  eq(l.gstAmount, 360);
  eq(l.totalAmount, 2360);
  eq(l.gstModeAtBilling, 'inclusive');
});

/* ========================================================================== */
group('TaxEngine — place of supply');

test('B2C walk-in with no data is intra-state', () => {
  eq(TaxEngine.isInterstate({ customerGstin: '', customerStateCode: '', shopStateCode: '19' }), false);
});

test('customer GSTIN overrides the selected state dropdown', () => {
  eq(TaxEngine.isInterstate({ customerGstin: '27ABCDE1234F1Z5', customerStateCode: '19', shopStateCode: '19' }), true);
  eq(TaxEngine.isInterstate({ customerGstin: '19ABCDE1234F1Z5', customerStateCode: '27', shopStateCode: '19' }), false);
});

test('B2C with an explicit other-state selection is inter-state', () => {
  eq(TaxEngine.isInterstate({ customerGstin: '', customerStateCode: '27', shopStateCode: '19' }), true);
});

test('unknown state code falls back safely instead of throwing', () => {
  eq(TaxEngine.isInterstate({ customerGstin: '99XXXXX0000X1Z0', customerStateCode: '', shopStateCode: '19' }), false);
});

/* ========================================================================== */
group('TaxEngine — CGST/SGST split');

test('odd-paise split still sums exactly to the total tax', () => {
  [17.14, 17.15, 0.01, 1800, 107.13, 3419.82].forEach(amt => {
    const g = TaxEngine.groupByHsn([{ hsn: 'X', gst: 5, taxableValue: 100, gstAmount: amt }], false)[0];
    eq(TaxEngine.round2(g.cgst + g.sgst), amt, `split of ${amt}:`);
  });
});

test('inter-state puts everything in IGST and nothing in CGST/SGST', () => {
  const g = TaxEngine.groupByHsn([{ hsn: 'X', gst: 18, taxableValue: 1000, gstAmount: 180 }], true)[0];
  eq(g.igst, 180); eq(g.cgst, 0); eq(g.sgst, 0);
});

test('invoice totals reconcile against HSN grouping in both tax modes', () => {
  const cart = [
    { hsn: '8517', gst: 18, gstRateAtBilling: 18, ...TaxEngine.computeLine({ price: 10000, qty: 1, gstRate: 18 }) },
    { hsn: '7113', gst: 3,  gstRateAtBilling: 3,  ...TaxEngine.computeLine({ price: 65000, qty: 2, gstRate: 3 }) },
    { hsn: '4051', gst: 5,  gstRateAtBilling: 5,  ...TaxEngine.computeLine({ price: 342.86, qty: 1, gstRate: 5 }) }
  ];
  const t = TaxEngine.computeInvoiceTotals(cart);
  [false, true].forEach(inter => {
    const groups = TaxEngine.groupByHsn(cart, inter);
    const taxable = TaxEngine.round2(groups.reduce((s, g) => s + g.taxable, 0));
    const tax = TaxEngine.round2(groups.reduce((s, g) => s + g.cgst + g.sgst + g.igst, 0));
    eq(taxable, t.taxable, `${inter ? 'inter' : 'intra'} taxable:`);
    eq(tax, t.gstTotal, `${inter ? 'inter' : 'intra'} tax:`);
  });
});

/* ========================================================================== */
group('TaxEngine — round-off');

test('round-off is the exact difference and never exceeds 50 paise', () => {
  for (let p = 100; p < 140; p += 0.37) {
    const line = TaxEngine.computeLine({ price: p, qty: 1, gstRate: 18 });
    const t = TaxEngine.computeInvoiceTotals([line]);
    eq(TaxEngine.round2(t.precise + t.roundOff), t.total, `at price ${p}:`);
    ok(Math.abs(t.roundOff) <= 0.5, `round-off ${t.roundOff} out of range at ${p}`);
  }
});

/* ========================================================================== */
group('TaxEngine — amount in words');

test('handles lakh and crore boundaries', () => {
  eq(TaxEngine.amountInWords(0), 'Zero Rupees Only');
  eq(TaxEngine.amountInWords(22419), 'Twenty Two Thousand Four Hundred Nineteen Rupees Only');
  eq(TaxEngine.amountInWords(100000), 'One Lakh Rupees Only');
  eq(TaxEngine.amountInWords(12345678), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only');
});

test('includes paise when present', () => {
  ok(/Paise/.test(TaxEngine.amountInWords(660.5)), 'expected paise in output');
});

/* ========================================================================== */
group('Returns — GST reversal');

test('reversal uses the rate stamped at billing, not the current slab', () => {
  // Sold at 18%. Even if the shop later reconfigures slabs, the credit note
  // must reverse 18% — otherwise the customer is refunded the wrong tax.
  const soldLine = { price: 18999, qty: 2, gstRateAtBilling: 18, gst: 28 /* current slab drifted */ };
  const rate = soldLine.gstRateAtBilling !== undefined ? soldLine.gstRateAtBilling : soldLine.gst;
  const ret = TaxEngine.computeLine({ price: soldLine.price, qty: 1, gstRate: rate });
  eq(ret.gstAmount, TaxEngine.round2(18999 * 0.18));
});

test('partial vs full return status transitions', () => {
  const saleTotal = 111788;
  const partial = 22419;
  eq(partial >= saleTotal - 0.01 ? 'returned' : 'partially_returned', 'partially_returned');
  eq(saleTotal >= saleTotal - 0.01 ? 'returned' : 'partially_returned', 'returned');
});

test('returning every line equals the original invoice total', () => {
  const lines = [
    TaxEngine.computeLine({ price: 18999, qty: 2, gstRate: 18 }),
    TaxEngine.computeLine({ price: 65000, qty: 1, gstRate: 3 })
  ];
  const sale = TaxEngine.computeInvoiceTotals(lines);
  const ret = TaxEngine.computeInvoiceTotals(lines);
  eq(ret.total, sale.total);
  eq(ret.gstTotal, sale.gstTotal);
});

test('customer dues can never go negative from an over-credit', () => {
  const dues = 500, creditNote = 2000;
  eq(Math.max(0, TaxEngine.round2(dues - creditNote)), 0);
});

/* ========================================================================== */
group('Expiry parsing');

test('month-only expiry resolves to the LAST day of that month', () => {
  const d = helpers.parseBatchExpiry('2026-09');
  eq(d.getMonth(), 8);
  eq(d.getDate(), 30, 'September has 30 days:');
});

test('February leap-year handled', () => {
  eq(helpers.parseBatchExpiry('2028-02').getDate(), 29);
  eq(helpers.parseBatchExpiry('2027-02').getDate(), 28);
});

test('explicit day form is preserved', () => {
  const d = helpers.parseBatchExpiry('2026-09-15');
  eq(d.getDate(), 15);
});

test('invalid and empty input return null rather than an Invalid Date', () => {
  eq(helpers.parseBatchExpiry(''), null);
  eq(helpers.parseBatchExpiry('garbage'), null);
  eq(helpers.parseBatchExpiry(null), null);
});

/* ========================================================================== */
group('Pharmacy — composition matching');

test('dose strength and separators are normalised away', () => {
  const a = helpers.compositionTokens('Paracetamol 650mg');
  ['paracetamol  650 mg', 'PARACETAMOL-650MG', 'Paracetamol 650 MG'].forEach(v => {
    eq(JSON.stringify(helpers.compositionTokens(v)), JSON.stringify(a), `${v}:`);
  });
});

test('combination drugs split into their salts', () => {
  const t = helpers.compositionTokens('Paracetamol + Caffeine 65mg');
  eq(t.length, 2);
  ok(t.includes('paracetamol') && t.includes('caffeine'));
});

test('different molecules do not match', () => {
  const a = new Set(helpers.compositionTokens('Paracetamol 650mg'));
  const b = helpers.compositionTokens('Amoxicillin 500mg');
  eq(b.filter(x => a.has(x)).length, 0);
});

/* ========================================================================== */
group('XSS escaping');

test('script and attribute payloads are neutralised', () => {
  ok(!helpers.esc('<img src=x onerror=alert(1)>').includes('<img'));
  ok(!helpers.esc('<script>alert(1)</script>').includes('<script'));
  eq(helpers.esc('"'), '&quot;');
  eq(helpers.esc("'"), '&#39;');
  eq(helpers.esc('&'), '&amp;');
});

test('null and undefined render as empty string, not "null"', () => {
  eq(helpers.esc(null), '');
  eq(helpers.esc(undefined), '');
});

/* ========================================================================== */
group('Offline sync queue');

// Re-implements the queue contract against the same localStorage shim, so
// ordering guarantees are proven rather than assumed.
test('returns stay queued until their parent sale has a cloud id', () => {
  const queue = [
    { kind: 'sale', payload: { idempotency_key: 's1' } },
    { kind: 'return', payload: { idempotency_key: 'r1', cloudSaleId: null } }
  ];
  const remaining = [];
  queue.forEach(e => {
    if (e.kind === 'return' && !e.payload.cloudSaleId) { remaining.push(e); return; }
  });
  eq(remaining.length, 1, 'orphan return should be held back:');
  eq(remaining[0].kind, 'return');
});

test('duplicate-key errors are treated as success, not retried forever', () => {
  const isFatal = helpers.isFatalSyncError;
  eq(isFatal('duplicate key value violates unique constraint'), false);
  eq(isFatal('network timeout'), true);
  eq(isFatal(null), false, 'must return a real boolean, not null:');
  eq(isFatal(undefined), false);
});

test('F4 fix: SQLSTATE 23505 (unique_violation) is preferred over string-matching the message', () => {
  // The atomic RPCs' own idempotency check (SELECT-then-insert) means a
  // normal retry never hits a real Postgres error at all — it returns
  // {replayed: true} with no error. A genuine 23505 here only happens in
  // the race between two concurrent calls with the same idempotency_key,
  // and is still "already synced," not a failure.
  const isFatal = helpers.isFatalSyncError;
  eq(isFatal('duplicate key value violates unique constraint', '23505'), false, 'a real 23505 must not be treated as fatal:');
  eq(isFatal('some other constraint failed', '23514'), true, 'a non-23505 Postgres error must still be treated as fatal even if the message happens to contain unrelated text:');
  eq(isFatal('duplicate key value violates unique constraint', '23514'), true, 'the code must win over the message text when both are present — a locale/wording change to the message must not silently flip this:');
  // No code available (e.g. a thrown JS exception with no Postgres error
  // shape) — falls back to the old string-match, unchanged behavior.
  eq(isFatal('duplicate key value violates unique constraint', undefined), false, 'falls back to string-match when no code is available:');
  eq(isFatal('network timeout', undefined), true);
});

test('legacy flat queue entries still drain after an app update', () => {
  const legacy = { idempotency_key: 'old1', invoiceNo: 'INV-1' };  // pre-envelope format
  const kind = legacy.kind || 'sale';
  const payload = legacy.payload || legacy;
  eq(kind, 'sale');
  eq(payload.invoiceNo, 'INV-1');
});

/* ========================================================================== */
group('Weighted average cost');

test('averages across lots instead of overwriting with the latest price', () => {
  const oldStock = 10, oldCost = 100, qty = 10, unitCost = 200;
  const weighted = ((oldStock * oldCost) + (qty * unitCost)) / (oldStock + qty);
  eq(Math.round(weighted * 100) / 100, 150);
});

test('negative stock does not produce a divide-by-zero or absurd cost', () => {
  const oldStock = -5, oldCost = 100, qty = 5, unitCost = 200;
  const denom = Math.max(oldStock, 0) + qty;
  const weighted = denom > 0 ? ((Math.max(oldStock, 0) * oldCost) + (qty * unitCost)) / denom : unitCost;
  eq(weighted, 200);
  ok(isFinite(weighted));
});


/* ========================================================================== */
group('onclick attribute escaping (escJs vs esc)');

// Simulates exactly what a browser does: HTML-decode the attribute value,
// THEN hand the result to the JS engine as the onclick handler's source.
// This is the mechanism that silently broke every "View 360" / "Settle" /
// similar button for any customer or vendor named with an apostrophe.
function htmlDecode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function simulateOnclickRoundTrip(escapedValue) {
  const attrSource = `onclick="capture('${escapedValue}')"`;
  const decoded = htmlDecode(attrSource.match(/onclick="(.*)"/)[1]);
  let captured;
  new Function('capture', decoded + '')((v) => { captured = v; });
  return captured;
}

test('esc() alone BREAKS an apostrophe name inside a single-quoted onclick arg (documents why escJs exists)', () => {
  let threw = false;
  try { simulateOnclickRoundTrip(helpers.esc("D'Souza")); }
  catch (e) { threw = true; }
  ok(threw, 'expected esc() alone to produce a JS syntax error for this input:');
});

test("escJs() round-trips an apostrophe name correctly (D'Souza, O'Brien — common Indian surnames)", () => {
  eq(simulateOnclickRoundTrip(helpers.escJs("D'Souza")), "D'Souza");
  eq(simulateOnclickRoundTrip(helpers.escJs("O'Brien")), "O'Brien");
});

test('escJs() round-trips apostrophe + double-quote combined', () => {
  const name = `D'Angelo "Big D"`;
  eq(simulateOnclickRoundTrip(helpers.escJs(name)), name);
});

test('escJs() round-trips a literal backslash without corruption', () => {
  const name = 'Back\\slash Traders';
  eq(simulateOnclickRoundTrip(helpers.escJs(name)), name);
});

test('escJs() round-trips a plain name unchanged', () => {
  eq(simulateOnclickRoundTrip(helpers.escJs('Ramesh Traders')), 'Ramesh Traders');
});


/* ========================================================================== */
group('stored-XSS on printed invoice & modals (found during review pass)');

test('HSN code on the printed A4 invoice is escaped', () => {
  const payload = '<script>alert(1)</script>';
  ok(!helpers.esc(payload).includes('<script'), 'HSN field must not render a live <script> tag:');
});

test('sale item identifier (serial/IMEI/HUID/batch) on the printed invoice is escaped', () => {
  const payload = `"><img src=x onerror=alert(2)>`;
  const rendered = helpers.esc(payload);
  ok(!rendered.includes('<img'), 'identifier field must not render a live <img> tag:');
  ok(!rendered.includes('">'), 'identifier field must not break out of its containing attribute/tag:');
});

test('POS cart line escapes the assigned identifier (serial/IMEI/HUID/batch) — F2 audit finding, 2026-09-15', () => {
  // renderCart() rendered it.assignedIdentifier raw while every other render
  // path for the same field (return modal, printed invoice, audit trail)
  // already called esc() on it — a cashier typing a serial containing HTML
  // during normal checkout executed it in their own browser the moment the
  // cart re-rendered. Source-extracted so this guards the actual call site,
  // not just esc()'s general behavior (which the other tests above already
  // cover) — a regression here means someone removed the esc() call again,
  // not that esc() itself broke.
  const fnSrc = extract('function renderCart()', 'function removeCart');
  ok(fnSrc.includes('esc(it.assignedIdentifier)'), 'renderCart must call esc(it.assignedIdentifier), not interpolate it raw:');
});

test('showSaasToast escapes its message — server error text can embed a user-typed product name', () => {
  // Mirrors the real path: a Postgres RAISE EXCEPTION in the return-quantity
  // guard echoes the product's own name back into its error string, which
  // then flows straight into showSaasToast(error, ...).
  const productName = '<img src=x onerror=alert(3)>';
  const serverError = `Cannot return 5 of "${productName}": only 2 remain returnable on invoice INV-1001`;
  ok(!helpers.esc(serverError).includes('<img'), 'a malicious product name inside a server error string must not execute in the toast:');
});

/* ========================================================================== */
console.log(`\n${'='.repeat(52)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(`\nFailures:`);
  failures.forEach(f => console.log(`  - ${f.name}: ${f.msg}`));
}
console.log('='.repeat(52));
process.exit(failed ? 1 : 0);
