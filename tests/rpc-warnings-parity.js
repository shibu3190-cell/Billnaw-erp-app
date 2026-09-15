/* ==========================================================================
   RPC WARNINGS PARITY TEST — Run: node tests/rpc-warnings-parity.js

   F5 fix (supabase/migrations/0014_atomic_rpc_skip_warnings.sql) makes
   create_invoice_atomic, create_purchase_atomic, and
   process_sales_return_atomic surface silently-skipped lines via a new
   `warnings` field, WITHOUT changing anything else about their existing
   behavior. This is the highest-stakes SQL in the schema — the atomic
   invoice/purchase/return RPCs — so "nothing else changed" is not an
   assertion to trust by reading the diff once; it's asserted here by
   stripping every warning-related addition back out of migration 0014's
   function bodies and requiring the result to be byte-identical
   (whitespace-normalized) to the live version defined in 0009/0005.

   This is a static/textual check, not a live database test — it cannot
   verify the SQL actually runs correctly against Postgres (no DB
   connection from Node). It exists to guard the specific risk this fix
   carries: an accidental edit to unrelated logic while hand-copying a
   130+ line function body across a migration boundary. Live behavior
   must still be verified against a real Supabase instance before this
   finding is considered closed — see the live verification script
   provided alongside this fix.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

const ROOT = path.join(__dirname, '..');

function extractFn(src, name) {
  const marker = `create or replace function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`"${marker}" not found`);
  const end = src.indexOf('$$;', start);
  if (end === -1) throw new Error(`no closing $$; for "${name}"`);
  return src.slice(start, end + 3);
}

// Removes every warning-collection addition the F5 fix made, so what
// remains should be exactly the pre-fix function body.
function stripWarningAdditions(s) {
  s = s.replace(/v_warnings := v_warnings \|\| format\([\s\S]*?\);\s*/g, '');
  s = s.replace(/v_warnings\s+text\[\]\s*:=\s*'\{\}';\s*/g, '');
  s = s.replace(/,\s*'warnings',\s*to_jsonb\(v_warnings\)/g, '');
  return s;
}

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim();
}

const newSrc = fs.readFileSync(path.join(ROOT, 'supabase/migrations/0014_atomic_rpc_skip_warnings.sql'), 'utf8');

const CASES = [
  { fn: 'create_invoice_atomic', file: 'supabase/migrations/0009_customer_lifecycle_b2b.sql' },
  { fn: 'create_purchase_atomic', file: 'supabase/migrations/0009_customer_lifecycle_b2b.sql' },
  { fn: 'process_sales_return_atomic', file: 'supabase/migrations/0005_sales_returns.sql' },
];

for (const { fn, file } of CASES) {
  test(`${fn}() is unchanged except for the warning additions (vs. live definition in ${file})`, () => {
    const liveSrc = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const live = normalize(extractFn(liveSrc, fn));
    const patched = normalize(stripWarningAdditions(extractFn(newSrc, fn)));
    if (live !== patched) {
      throw new Error(`bodies differ after stripping warning additions — review the migration for an unintended change, not just the warning logic`);
    }
  });

  test(`${fn}() returns 'warnings' in its final jsonb_build_object`, () => {
    const body = extractFn(newSrc, fn);
    // Only the non-replayed return path needs it — a replayed call never
    // reaches the loop, so there's nothing to warn about.
    const nonReplayedReturn = body.slice(body.lastIndexOf('return jsonb_build_object('));
    if (!nonReplayedReturn.includes("'warnings', to_jsonb(v_warnings)")) {
      throw new Error(`final return of ${fn} does not include the warnings field`);
    }
  });
}

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
