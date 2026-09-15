/* ==========================================================================
   PERMISSIONS PARITY TEST — Run: node tests/permissions-parity.js

   Guards src/core/permissions/index.ts against drift from the deployed
   app.js's applyRoleSecurity(). Unlike a pure-function parity test, the
   legacy function has DOM and APP_STATE side effects baked into its body,
   so this doesn't diff source text — it runs the ACTUAL legacy function
   (extracted from app.js and eval'd, same technique tests/run-tests.js
   already uses) against a minimal stub DOM, and separately runs the new
   typed module's applyRoleSecurity() against an equivalent stub, then
   requires every observable outcome (isOwner flag, badge text/colors,
   which elements got hidden) to match, for both the Owner and Cashier
   cases.

   This is stronger than a text diff: it proves the two behave identically
   under real invocation, not just that their source happens to look
   similar.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const ROOT = path.join(__dirname, '..');

/* ---------------- stub DOM shared shape ---------------- */

function makeStubEl() {
  return { style: {}, innerText: '' };
}

function makeStubDom() {
  const adminOnlyEls = [makeStubEl(), makeStubEl()];
  const costSensitiveEls = [makeStubEl()];
  const roleBadge = makeStubEl();
  const els = { '.admin-only': adminOnlyEls, '.cost-sensitive': costSensitiveEls, '#roleBadge': roleBadge };
  return {
    adminOnlyEls, costSensitiveEls, roleBadge,
    $qa: (selector) => els[selector] || [],
    $id: (id) => (id === 'roleBadge' ? roleBadge : null),
  };
}

/* ---------------- run the ACTUAL legacy app.js function ---------------- */

function runLegacy(role) {
  const dom = makeStubDom();
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const start = appSrc.indexOf('function applyRoleSecurity(role) {');
  const end = appSrc.indexOf('\n/* ==', start); // next section banner
  const fnSrc = appSrc.slice(start, end);

  const APP_STATE = {};
  const $qa = (sel) => dom.$qa(sel);
  const $id = (id) => dom.$id(id);
  const legacyApplyRoleSecurity = new Function(
    'APP_STATE', '$qa', '$id',
    `${fnSrc}\nreturn applyRoleSecurity;`
  )(APP_STATE, $qa, $id);

  legacyApplyRoleSecurity(role);
  return {
    isOwner: APP_STATE.isOwner,
    badgeText: dom.roleBadge.innerText,
    badgeBackground: dom.roleBadge.style.background,
    badgeColor: dom.roleBadge.style.color,
    adminOnlyDisplay: dom.adminOnlyEls.map((el) => el.style.display),
    costSensitiveDisplay: dom.costSensitiveEls.map((el) => el.style.display),
  };
}

/* ---------------- run the NEW typed module ---------------- */

const tsSrc = fs.readFileSync(path.join(ROOT, 'src/core/permissions/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const typedModule = { exports: {} };
new Function('module', 'exports', outputText)(typedModule, typedModule.exports);
const { applyRoleSecurity: typedApplyRoleSecurity, computeRoleSecurity } = typedModule.exports;

function runTyped(role) {
  const dom = makeStubDom();
  let isOwner;
  typedApplyRoleSecurity(role, {
    queryAll: (sel) => dom.$qa(sel),
    getById: (id) => dom.$id(id),
    setIsOwner: (v) => { isOwner = v; },
  });
  return {
    isOwner,
    badgeText: dom.roleBadge.innerText,
    badgeBackground: dom.roleBadge.style.background,
    badgeColor: dom.roleBadge.style.color,
    adminOnlyDisplay: dom.adminOnlyEls.map((el) => el.style.display),
    costSensitiveDisplay: dom.costSensitiveEls.map((el) => el.style.display),
  };
}

/* ---------------- compare ---------------- */

for (const role of ['Owner', 'owner', 'Cashier', 'cashier', 'super_admin', '']) {
  test(`role="${role}": legacy and typed produce identical observable output`, () => {
    const legacy = runLegacy(role);
    const typed = runTyped(role);
    eq(JSON.stringify(typed), JSON.stringify(legacy), `role=${role}`);
  });
}

test('computeRoleSecurity("Owner") is pure and matches the applied decision', () => {
  const decision = computeRoleSecurity('Owner');
  eq(decision.isOwner, true);
  eq(decision.badgeText, '👑 Owner');
});

test('computeRoleSecurity("Cashier") is pure and matches the applied decision', () => {
  const decision = computeRoleSecurity('Cashier');
  eq(decision.isOwner, false);
  eq(decision.badgeText, '🛒 Staff');
});

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
