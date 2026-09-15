/* ==========================================================================
   DATABASE PARITY TEST — Run: node tests/database-parity.js
   Guards database.js (deployed) against drift from src/core/database/
   index.ts (typed reference), the same pattern as gst-parity.js etc. —
   diffs each function's body after stripping TS-only syntax and
   whitespace, so a real logic change in one without the other fails here.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

const ROOT = path.join(__dirname, '..');
const deployedSrc = fs.readFileSync(path.join(ROOT, 'database.js'), 'utf8');

const tsSrc = fs.readFileSync(path.join(ROOT, 'src/core/database/index.ts'), 'utf8');
const { outputText: typedSrc } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});

function extractFn(src, name) {
  const marker = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = marker.exec(src);
  if (!m) throw new Error(`"${name}" not found`);
  let i = src.indexOf('(', m.index);
  let depth = 1; i++;
  while (depth > 0) { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; i++; }
  const braceStart = src.indexOf('{', i);
  let bdepth = 0;
  for (let j = braceStart; j < src.length; j++) {
    if (src[j] === '{') bdepth++;
    else if (src[j] === '}') { bdepth--; if (bdepth === 0) return src.slice(braceStart, j + 1); }
  }
  throw new Error(`unbalanced braces for "${name}"`);
}

// TS's CommonJS transpile rewrites references to an exported top-level
// const as `exports.NAME` inside function bodies — a mechanical artifact
// of the module system, not a real difference from the deployed script's
// plain `NAME` reference to its own top-level const.
function normalize(s) { return s.replace(/\s+/g, ' ').replace(/\bexports\./g, '').trim(); }

const FUNCTIONS = [
  'openBillnawDB', 'getAll', 'get', 'put', 'putAll', 'remove', 'clearStore', 'replaceAll',
];

for (const name of FUNCTIONS) {
  test(`${name}() body matches token-for-token between database.js and the typed reference`, () => {
    const deployed = normalize(extractFn(deployedSrc, name));
    const typed = normalize(extractFn(typedSrc, name));
    if (deployed !== typed) {
      throw new Error(`bodies differ — deployed: ${deployed}\n      typed:    ${typed}`);
    }
  });
}

test('STORE_CONFIG matches between database.js and the typed reference', () => {
  const extractObj = (src) => {
    const start = src.indexOf('meta:');
    const end = src.indexOf('};', start) + 1;
    return normalize(src.slice(start, end));
  };
  const deployed = extractObj(deployedSrc);
  const typed = extractObj(typedSrc);
  if (deployed !== typed) throw new Error(`STORE_CONFIG differs:\n      deployed: ${deployed}\n      typed:    ${typed}`);
});

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
