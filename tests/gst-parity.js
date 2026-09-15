/* ==========================================================================
   GST PARITY TEST
   Run:  node tests/gst-parity.js

   Phase 3 of MIGRATION_PLAN.md extracted gstConfig.js into a typed ES
   module at src/services/gst/index.ts, but the DEPLOYED app still loads
   the original gstConfig.js as a classic <script> (index.html is
   unchanged). Two copies of GST arithmetic existing at once is exactly
   the kind of drift risk the audit flagged elsewhere in this codebase
   (see AUDIT_REPORT.md §9/§10) — this test exists so that risk is
   actively guarded, not just documented.

   It transpiles the new TS module with the TypeScript compiler already
   in devDependencies (no extra tooling), then runs the same input matrix
   through both implementations and requires byte-identical results.
   A failure here means the two files disagree — that is a real bug to
   fix, never a reason to loosen this test.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eqDeep(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || ''} legacy=${b} typed=${a}`);
}

const ROOT = path.join(__dirname, '..');

// ---- load the legacy runtime module (what index.html actually ships) ----
const legacySrc = fs.readFileSync(path.join(ROOT, 'gstConfig.js'), 'utf8');
const { TaxEngine: legacyTax, GST_STATE_CODES: legacyStates, GstConfig: legacyConfig } =
  new Function('localStorage', 'window', legacySrc + '; return { TaxEngine, GST_STATE_CODES, GstConfig };')(
    makeMockStorage(), {}
  );

// ---- transpile and load the typed module under test ----
const tsSrc = fs.readFileSync(path.join(ROOT, 'src/services/gst/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const typedModule = { exports: {} };
new Function('module', 'exports', 'localStorage', outputText)(typedModule, typedModule.exports, makeMockStorage());
const { TaxEngine: typedTax, GST_STATE_CODES: typedStates, GstConfig: typedConfig } = typedModule.exports;

function makeMockStorage() {
  const d = {};
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    clear: () => { for (const k of Object.keys(d)) delete d[k]; },
  };
}

console.log('\nGST state codes');
test('GST_STATE_CODES identical', () => eqDeep(typedStates, legacyStates));

console.log('\nTaxEngine.round2');
[0, 0.005, -0.005, 1.005, -1.005, 22419.005, -22419.995, NaN, Infinity].forEach((n) => {
  test(`round2(${n}) matches`, () => eqDeep(typedTax.round2(n), legacyTax.round2(n)));
});

console.log('\nTaxEngine.resolvePlaceOfSupply / isInterstate');
[
  { customerGstin: '27ABCDE1234F1Z5', customerStateCode: '', shopStateCode: '19' },
  { customerGstin: '', customerStateCode: '19', shopStateCode: '19' },
  { customerGstin: '', customerStateCode: '', shopStateCode: '19' },
  { customerGstin: 'INVALID', customerStateCode: '27', shopStateCode: '19' },
  { customerGstin: '', customerStateCode: '', shopStateCode: '' },
].forEach((input, i) => {
  test(`resolvePlaceOfSupply case ${i} matches`, () =>
    eqDeep(typedTax.resolvePlaceOfSupply(input), legacyTax.resolvePlaceOfSupply(input)));
  test(`isInterstate case ${i} matches`, () =>
    eqDeep(typedTax.isInterstate(input), legacyTax.isInterstate(input)));
});

console.log('\nTaxEngine.computeLine');
[
  { price: 18999, qty: 1, gstRate: 18, includeGst: false },
  { price: 65000, qty: 1, gstRate: 3, includeGst: false },
  { price: 999, qty: 3, gstRate: 12, includeGst: true },
  { price: 0, qty: 1, gstRate: 18, includeGst: false },
  { price: 100, qty: 0, gstRate: 18, includeGst: false },
  { price: '250.50', qty: '2', gstRate: '28', includeGst: false },
].forEach((input, i) => {
  test(`computeLine case ${i} matches`, () => eqDeep(typedTax.computeLine(input), legacyTax.computeLine(input)));
});

console.log('\nTaxEngine.computeInvoiceTotals');
[
  [{ taxableValue: 18999, gstAmount: 3419.82 }],
  [{ taxableValue: 100.5, gstAmount: 18.09 }, { taxableValue: 250.33, gstAmount: 45.06 }],
  [],
].forEach((lines, i) => {
  test(`computeInvoiceTotals case ${i} matches`, () =>
    eqDeep(typedTax.computeInvoiceTotals(lines), legacyTax.computeInvoiceTotals(lines)));
});

console.log('\nTaxEngine.groupByHsn');
[
  [
    { hsn: '8517', gstRateAtBilling: 18, taxableValue: 18999, gstAmount: 3419.82 },
    { hsn: '8517', gstRateAtBilling: 18, taxableValue: 999, gstAmount: 179.82 },
    { hsn: '7113', gst: 3, taxableValue: 65000, gstAmount: 1950 },
  ],
].forEach((items, i) => {
  test(`groupByHsn intra-state case ${i} matches`, () => eqDeep(typedTax.groupByHsn(items, false), legacyTax.groupByHsn(items, false)));
  test(`groupByHsn inter-state case ${i} matches`, () => eqDeep(typedTax.groupByHsn(items, true), legacyTax.groupByHsn(items, true)));
});

console.log('\nTaxEngine.amountInWords');
[0, 1, 19, 20, 99, 100, 999, 1000, 22419, 100000, 10000000, 22419.5, -500].forEach((n) => {
  test(`amountInWords(${n}) matches`, () => eqDeep(typedTax.amountInWords(n), legacyTax.amountInWords(n)));
});

console.log('\nGstConfig');
test('default slabs match', () => eqDeep(typedConfig.getSlabs(), legacyConfig.getSlabs()));
test('setSlabs with valid input matches', () =>
  eqDeep(typedConfig.setSlabs(['0', '5', '200', 'abc', '18']), legacyConfig.setSlabs(['0', '5', '200', 'abc', '18'])));
test('setSlabs with all-invalid input matches', () => eqDeep(typedConfig.setSlabs(['abc', '-5', '200']), legacyConfig.setSlabs(['abc', '-5', '200'])));

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
