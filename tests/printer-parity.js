/* ==========================================================================
   PRINTER PARITY TEST — Run: node tests/printer-parity.js
   Guards src/services/printer/index.ts's buildEscPosPayload() against
   drift from the deployed printerEngine.js's copy — the actual ESC/POS
   byte protocol shops' thermal receipts are printed with, so a silent
   divergence here would produce a real, physically wrong receipt.
   See that file's header for why only buildEscPosPayload() is extracted.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eqBytes(actual, expected, msg) {
  const a = Array.from(actual);
  const b = Array.from(expected);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg || ''} byte arrays differ (legacy ${b.length}B, typed ${a.length}B)`);
  }
}

const ROOT = path.join(__dirname, '..');

// legacy esc() (buildEscPosPayload calls the global esc(), defined in app.js)
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
function extractApp(startMarker, endMarker) {
  const a = appSrc.indexOf(startMarker);
  const b = appSrc.indexOf(endMarker, a);
  return appSrc.slice(a, b);
}
const { esc: legacyEsc } = new Function(`${extractApp('function esc(v)', 'function fmtCost')}; return { esc };`)();

// legacy buildEscPosPayload, with APP_STATE.tenantProfile as a real global
// (the legacy function reads it directly, same as the alerts extraction).
const printerSrc = fs.readFileSync(path.join(ROOT, 'printerEngine.js'), 'utf8');
const pa = printerSrc.indexOf('buildEscPosPayload(inv, width = 80) {');
const pb = printerSrc.indexOf('// Fired from Settings');
// slice() lands right after the method's closing "},\n\n" — trim that back
// to the closing brace so it parses as a standalone function body.
let legacyMethodSrc = printerSrc.slice(pa, pb);
legacyMethodSrc = legacyMethodSrc.slice(0, legacyMethodSrc.lastIndexOf('}') + 1);
global.esc = legacyEsc;
global.APP_STATE = { tenantProfile: {} };
const legacyBuildEscPosPayload = new Function(
  'APP_STATE', 'esc',
  `return function ${legacyMethodSrc}`
)(global.APP_STATE, legacyEsc);

// typed module under test
const tsSrc = fs.readFileSync(path.join(ROOT, 'src/services/printer/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const typedModule = { exports: {} };
new Function('module', 'exports', 'require', outputText)(typedModule, typedModule.exports, () => ({ esc: legacyEsc }));
const { buildEscPosPayload: typedBuild } = typedModule.exports;

const tenantProfile = {
  shopName: "O'Brien's Electronics", address: 'Burrabazar, Kolkata, WB',
  gstin: '19ABCDE1234F1Z5', upiId: 'shop@upi', autoCut: true, cutType: 'partial',
  cashDrawer: true, drawerPin: '2',
};

const invoice = {
  invoiceNo: 'INV-1001', date: '15/09/2026',
  customer: { name: `D'Souza`, phone: '9876543210' },
  items: [
    { name: 'Motorola G84 5G', assignedIdentifier: '864592039481920', qty: 1, price: 18999, totalAmount: 18999 },
    { name: '<script>alert(1)</script>', qty: 2, price: 100.5, totalAmount: 201 },
  ],
  total: 19200, tender: 'Cash',
};

console.log('\nbuildEscPosPayload — full invoice, 80mm');
test('matches (80mm, cash drawer fires)', () => {
  global.APP_STATE.tenantProfile = tenantProfile;
  eqBytes(typedBuild(invoice, tenantProfile, 80, legacyEsc), legacyBuildEscPosPayload(invoice, 80));
});

console.log('\nbuildEscPosPayload — 58mm width');
test('matches (58mm)', () => {
  eqBytes(typedBuild(invoice, tenantProfile, 58, legacyEsc), legacyBuildEscPosPayload(invoice, 58));
});

console.log('\nbuildEscPosPayload — UPI tender (no drawer kick)');
test('matches (UPI tender)', () => {
  const upiInv = { ...invoice, tender: 'UPI' };
  eqBytes(typedBuild(upiInv, tenantProfile, 80, legacyEsc), legacyBuildEscPosPayload(upiInv, 80));
});

console.log('\nbuildEscPosPayload — no UPI id, no auto-cut, no drawer');
test('matches (minimal profile)', () => {
  const minimalProfile = { shopName: 'Shop', address: 'Addr' };
  global.APP_STATE.tenantProfile = minimalProfile;
  eqBytes(typedBuild(invoice, minimalProfile, 80, legacyEsc), legacyBuildEscPosPayload(invoice, 80));
});

console.log('\nbuildEscPosPayload — full cut, drawer pin 5');
test('matches (full cut, pin 5)', () => {
  const p2 = { ...tenantProfile, cutType: 'full', drawerPin: '5' };
  global.APP_STATE.tenantProfile = p2;
  eqBytes(typedBuild(invoice, p2, 80, legacyEsc), legacyBuildEscPosPayload(invoice, 80));
});

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
