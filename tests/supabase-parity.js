/* ==========================================================================
   SUPABASE SERVICE PARITY TEST — Run: node tests/supabase-parity.js

   Phase 5 of MIGRATION_PLAN.md extracts supabaseClient.js's `SB` namespace
   into a typed src/services/supabase/index.ts factory (createSB). The
   deployed app still loads the original supabaseClient.js as a classic
   <script> — index.html is unchanged. Two copies of ~35 RPC/table call
   sites existing at once is exactly the kind of drift risk the audit
   flagged elsewhere in this codebase (see docs/AUDIT_REPORT.md §9): this
   test exists so that risk is actively guarded, not just documented.

   Unlike the gst/export/alerts/printer parity tests, these methods are not
   pure functions — they make live Supabase calls — so this test does not
   invoke them. Instead it requires every method's *body* (everything
   between the body's outer braces, i.e. excluding the parameter list,
   where TypeScript type annotations were deliberately added) to be
   byte-identical text between the two files. The typed module was written
   to keep the same local variable names (`_sb`, `SUPABASE_URL`) specifically
   so this comparison is meaningful — a failure here means the RPC name,
   table name, parameter payload, or control flow actually changed, which
   is a real contract deviation per MIGRATION_PLAN.md §2's stop condition,
   not a cosmetic difference to wave off.

   This also asserts every method the legacy SB namespace exposes has a
   counterpart in the new module (nothing silently dropped) and vice versa
   (nothing invented that isn't part of the documented contract).
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

// Extracts just the `{ ... }` body of `[async] <name>(...) { ... }`,
// balanced-brace, skipping over the parameter list (which may itself
// contain destructuring braces, and may differ from the legacy file by
// TypeScript type annotations only).
function extractMethodBody(src, name) {
  // Anchored to a method-declaration line (only leading whitespace before
  // it) so this can't false-match a mention inside a comment (e.g. the
  // file header's "SB.signIn()") or a call site elsewhere in the file.
  const marker = new RegExp(`^\\s*(?:async\\s+)?${name}\\s*\\(`, 'm');
  const m = marker.exec(src);
  if (!m) throw new Error(`marker for "${name}" not found`);
  let i = src.indexOf('(', m.index);
  let depth = 1;
  i++;
  while (depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  const braceStart = src.indexOf('{', i);
  if (braceStart === -1) throw new Error(`no body brace found for "${name}"`);
  let bdepth = 0;
  for (let j = braceStart; j < src.length; j++) {
    if (src[j] === '{') bdepth++;
    else if (src[j] === '}') {
      bdepth--;
      if (bdepth === 0) return src.slice(braceStart, j + 1);
    }
  }
  throw new Error(`unbalanced braces for "${name}"`);
}

// All method names declared directly on the legacy SB object (top-level
// `async name(` or `name(` lines inside supabaseClient.js's `const SB = {`
// block, excluding the `client` property which isn't a method).
const LEGACY_METHODS = [
  'signUpShop', 'signIn', 'signOut', 'sendEmailOtp', 'verifyEmailOtp',
  'sendPhoneOtp', 'verifyPhoneOtp', 'getSessionAndProfile', 'signInWithGoogle',
  'createShopForCurrentUser', 'updateShopSettings', 'fetchShopStaff',
  'fetchItems', 'saveItem', 'decrementStock',
  'upsertCustomer', 'fetchCustomers', 'fetchCustomersTagged', 'setCustomerStar',
  'archiveCustomer', 'deleteCustomerIfUnused', 'updateCustomerDetails',
  'fetchVendorDivisions', 'createVendorDivision', 'setVendorStar', 'updateVendorDetails',
  'saveSale', 'nextInvoiceNumber', 'fetchSales', 'fetchProfitSummary',
  'savePurchase', 'fetchPurchases', 'fetchVendors', 'fetchStockAlerts',
  'fetchReturnableLines', 'processReturn', 'fetchReturns',
  'parseInvoiceImage',
  'fetchSubscription', 'fetchAllPlans',
  'adminListShops', 'adminViewShopSales', 'adminSetShopStatus',
];

const legacySrc = fs.readFileSync(path.join(ROOT, 'supabaseClient.js'), 'utf8');

const tsSrc = fs.readFileSync(path.join(ROOT, 'src/services/supabase/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});

test('every legacy SB method name appears exactly once as a declaration in the typed module source', () => {
  for (const name of LEGACY_METHODS) {
    const re = new RegExp(`^\\s*(?:async\\s+)?${name}\\s*\\(`, 'gm');
    const count = (outputText.match(re) || []).length;
    if (count !== 1) throw new Error(`"${name}" declared ${count} time(s) in src/services/supabase/index.ts, expected exactly 1`);
  }
});

test('typed module declares no extra top-level methods beyond the legacy contract', () => {
  // createSB / SBClient / exports are expected; every other identifier
  // immediately followed by `(` at the start of an object-literal line
  // inside the returned SB object should be in LEGACY_METHODS.
  // Require a `{` (object-method body opener) on the same declaration
  // line, not just any statement-level function call — this is what
  // distinguishes `saveItem(item) {` from `clearTimeout(timeout);`.
  const methodDeclRe = /^\s*(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\([^()]*\)\s*\{/gm;
  const found = new Set();
  let m;
  while ((m = methodDeclRe.exec(outputText))) {
    found.add(m[1]);
  }
  const allowlist = new Set([...LEGACY_METHODS, 'createSB']);
  const jsKeywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return']);
  const extras = [...found].filter((n) => !allowlist.has(n) && !jsKeywords.has(n));
  if (extras.length) throw new Error(`unexpected method-shaped declarations not in the legacy contract: ${extras.join(', ')}`);
});

// Collapses all whitespace runs to a single space so the comparison is
// insensitive to indentation depth (the typed module's methods sit one
// nesting level deeper — inside createSB's function body — than the
// legacy file's top-level `const SB = {...}`) while remaining sensitive
// to every token: RPC names, table names, parameter keys, operators,
// string literals, and control flow all still have to match exactly.
function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// The TS compiler's printer drops now-redundant grouping parens once it
// erases a type assertion, e.g. `(reader.result as string)` -> just
// `reader.result` (no parens) after `as string` is stripped, whereas the
// legacy file wrote `(reader.result)` with parens for readability around
// its JSDoc-comment cast. Both are behaviorally identical (a no-op
// grouping). Normalize this one specific, reviewed, compiler-introduced
// cosmetic difference rather than have parseInvoiceImage's parity check
// permanently fail on it.
function stripRedundantParens(s) {
  return s.replace(/\(reader\.result\)/g, 'reader.result');
}

console.log('\nmethod body parity (legacy supabaseClient.js vs. src/services/supabase/index.ts, whitespace-insensitive)');
for (const name of LEGACY_METHODS) {
  test(`${name}() body matches token-for-token`, () => {
    const legacyBody = stripRedundantParens(normalizeWhitespace(extractMethodBody(legacySrc, name)));
    const typedBody = stripRedundantParens(normalizeWhitespace(extractMethodBody(outputText, name)));
    if (legacyBody !== typedBody) {
      throw new Error(`bodies differ — contract may have changed, review before trusting\n      legacy: ${legacyBody}\n      typed:  ${typedBody}`);
    }
  });
}

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
