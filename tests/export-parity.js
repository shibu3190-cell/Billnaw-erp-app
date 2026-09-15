/* ==========================================================================
   EXPORT PARITY TEST — Run: node tests/export-parity.js
   Guards src/services/export/index.ts's escXml() against drift from the
   deployed exportEngine.js. See src/services/export/index.ts's header for
   why only escXml() is extracted so far (the rest is DOM-coupled).
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

const legacySrc = fs.readFileSync(path.join(ROOT, 'exportEngine.js'), 'utf8');
const a = legacySrc.indexOf('function escXml(v)');
const b = legacySrc.indexOf('function exportToExcel');
const legacyEscXml = new Function(`${legacySrc.slice(a, b)}; return escXml;`)();

const tsSrc = fs.readFileSync(path.join(ROOT, 'src/services/export/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const typedModule = { exports: {} };
new Function('module', 'exports', outputText)(typedModule, typedModule.exports);
const { escXml: typedEscXml } = typedModule.exports;

const cases = [null, undefined, '', 'plain', `<tag> & "quoted" 'single'`, 12345, 0, false];

console.log('\nescXml()');
cases.forEach((c) => test(`escXml(${JSON.stringify(c)}) matches`, () => eqDeep(typedEscXml(c), legacyEscXml(c))));

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
