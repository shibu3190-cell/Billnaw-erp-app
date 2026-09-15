/* ==========================================================================
   ESCAPE PARITY TEST — Run: node tests/escape-parity.js
   Guards src/core/security/escape.ts against drift from app.js's esc()/
   escJs(), the same pattern as tests/gst-parity.js. See that file's header
   for why this dual-copy-with-parity-test approach is used during the
   incremental migration instead of either blind duplication or an early,
   unverified cutover.
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

// ---- legacy: extract esc()/escJs() out of the shipped app.js ----
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
function extract(startMarker, endMarker) {
  const a = appSrc.indexOf(startMarker);
  if (a === -1) throw new Error(`marker not found: ${startMarker}`);
  const b = appSrc.indexOf(endMarker, a);
  if (b === -1) throw new Error(`end marker not found: ${endMarker}`);
  return appSrc.slice(a, b);
}
const { esc: legacyEsc, escJs: legacyEscJs } = new Function(`
  ${extract('function esc(v)', 'function fmtCost')}
  ${extract('function escJs(v)', 'function fmtCost')}
  return { esc, escJs };
`)();

// ---- typed module under test ----
const tsSrc = fs.readFileSync(path.join(ROOT, 'src/core/security/escape.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const typedModule = { exports: {} };
new Function('module', 'exports', outputText)(typedModule, typedModule.exports);
const { esc: typedEsc, escJs: typedEscJs } = typedModule.exports;

const cases = [
  null, undefined, '', 'plain text',
  '<img src=x onerror=alert(1)>',
  `D'Souza`, `O'Brien's Pharmacy`,
  `"quoted"`, `back\\slash`, `mix<>&"'`,
  12345, 0, false, true,
];

console.log('\nesc()');
cases.forEach((c) => test(`esc(${JSON.stringify(c)}) matches`, () => eqDeep(typedEsc(c), legacyEsc(c))));

console.log('\nescJs()');
cases.forEach((c) => test(`escJs(${JSON.stringify(c)}) matches`, () => eqDeep(typedEscJs(c), legacyEscJs(c))));

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
