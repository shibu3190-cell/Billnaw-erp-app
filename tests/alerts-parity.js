/* ==========================================================================
   ALERTS PARITY TEST — Run: node tests/alerts-parity.js
   Guards src/services/alerts/index.ts against drift from the deployed
   alertEngine.js. Same pattern as tests/gst-parity.js — see that file's
   header for why. The legacy module reads a global APP_STATE; the typed
   module takes inventory/tenantProfile as explicit parameters (a real
   module-boundary fix, not a logic change) — this test builds one fixture
   and feeds it to both call shapes, so any divergence in output is a bug.
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

const fixture = {
  tenantProfile: { lowStockThreshold: 5, expiryWarnDays: 30 },
  inventory: [
    { id: 1, name: 'Motorola G84 5G', category: 'Electronics', stock: 2, lowStockLevel: undefined, batches: [] },
    { id: 2, name: 'Gold Chain 22K', category: 'Jewelry', stock: 8, lowStockLevel: 3, batches: [] },
    {
      id: 3, name: 'Paracetamol 650mg', category: 'Pharmacy', stock: 12,
      composition: 'Paracetamol 650mg',
      batches: [
        { batch: 'B1', expiry: '2026-09', stock: 6 },
        { batch: 'B2', expiry: '2020-01-01', stock: 6 },
        { batch: 'B3', expiry: '', stock: 0 },
      ],
    },
    { id: 4, name: 'Paracetamol + Caffeine 650mg', category: 'Pharmacy', stock: 5, composition: 'Paracetamol 650mg + Caffeine 50mg' },
    { id: 5, name: 'Ibuprofen 400mg', category: 'Pharmacy', stock: 0, composition: 'Ibuprofen 400mg' },
    { id: 6, name: 'Amoxicillin 500mg', category: 'Pharmacy', stock: 3, meta: { composition: 'amoxicillin  500 mg' } },
  ],
};

// ---- legacy: eval alertEngine.js with APP_STATE as a real global ----
global.APP_STATE = fixture;
global.window = {};
const legacySrc = fs.readFileSync(path.join(ROOT, 'alertEngine.js'), 'utf8');
new Function(legacySrc)();
const legacy = {
  getAlertThresholds: global.window.getAlertThresholds,
  parseBatchExpiry: global.window.parseBatchExpiry,
  daysUntil: global.window.daysUntil,
  getLowStockItems: global.window.getLowStockItems,
  getExpiryAlerts: global.window.getExpiryAlerts,
  normaliseComposition: global.window.normaliseComposition,
  compositionTokens: global.window.compositionTokens,
  findAlternatives: global.window.findAlternatives,
};

// ---- typed module under test ----
const tsSrc = fs.readFileSync(path.join(ROOT, 'src/services/alerts/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const typedModule = { exports: {} };
new Function('module', 'exports', outputText)(typedModule, typedModule.exports);
const typed = typedModule.exports;

console.log('\ngetAlertThresholds');
test('matches with explicit thresholds', () => eqDeep(typed.getAlertThresholds(fixture.tenantProfile), legacy.getAlertThresholds()));
test('matches with defaults', () => {
  const saved = global.APP_STATE.tenantProfile;
  global.APP_STATE.tenantProfile = {};
  try {
    eqDeep(typed.getAlertThresholds({}), legacy.getAlertThresholds());
  } finally {
    global.APP_STATE.tenantProfile = saved;
  }
});

console.log('\nparseBatchExpiry / daysUntil');
['2026-09', '2026-09-15', '2020-01-01', '', null, 'garbage', '2026-02'].forEach((raw) => {
  test(`parseBatchExpiry(${JSON.stringify(raw)}) matches`, () =>
    eqDeep(typed.parseBatchExpiry(raw)?.getTime() ?? null, legacy.parseBatchExpiry(raw)?.getTime() ?? null));
});

console.log('\ngetLowStockItems');
test('matches', () => eqDeep(typed.getLowStockItems(fixture.inventory, fixture.tenantProfile), legacy.getLowStockItems()));

console.log('\ngetExpiryAlerts');
test('matches', () => eqDeep(typed.getExpiryAlerts(fixture.inventory, fixture.tenantProfile), legacy.getExpiryAlerts()));

console.log('\nnormaliseComposition / compositionTokens');
['Paracetamol 650mg', 'paracetamol  650 mg', 'PARACETAMOL-650MG', 'A + B', ''].forEach((raw) => {
  test(`normaliseComposition(${JSON.stringify(raw)}) matches`, () => eqDeep(typed.normaliseComposition(raw), legacy.normaliseComposition(raw)));
  test(`compositionTokens(${JSON.stringify(raw)}) matches`, () => eqDeep(typed.compositionTokens(raw), legacy.compositionTokens(raw)));
});

console.log('\nfindAlternatives');
fixture.inventory.forEach((item) => {
  test(`findAlternatives(${item.name}) matches`, () => eqDeep(typed.findAlternatives(item, fixture.inventory), legacy.findAlternatives(item)));
});
test('findAlternatives(null) matches', () => eqDeep(typed.findAlternatives(null, fixture.inventory), legacy.findAlternatives(null)));

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
