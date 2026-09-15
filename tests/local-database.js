/* ==========================================================================
   LOCAL DATABASE TEST — Run: node tests/local-database.js

   Tests src/core/database/index.ts (Phase 6 first increment, NOT wired
   into the deployed app — see that file's header) against
   fake-indexeddb, a pure-JS IndexedDB implementation, since Node has no
   native IndexedDB. This proves the module's logic is correct; it cannot
   prove real-browser storage quotas (those vary by browser/device and
   aren't observable from Node) — that claim rests on IndexedDB's
   documented design (per-record storage bounded by device free space,
   not a fixed small cap), not on anything this test measures.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const fakeIndexedDB = require('fake-indexeddb');

let passed = 0, failed = 0;
function test(name, fn) {
  return fn()
    .then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch((e) => { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); });
}
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || ''} expected ${b}, got ${a}`);
}

const ROOT = path.join(__dirname, '..');
const tsSrc = fs.readFileSync(path.join(ROOT, 'src/core/database/index.ts'), 'utf8');
const { outputText } = ts.transpileModule(tsSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const mod = { exports: {} };
new Function('module', 'exports', outputText)(mod, mod.exports);
const { openBillnawDB, getAll, get, put, putAll, remove, clearStore, getMeta, setMeta } = mod.exports;

let dbCounter = 0;
async function freshDb() {
  // A distinct DB name per test so they don't see each other's data —
  // fake-indexeddb keeps databases in an in-memory registry for the
  // process lifetime, same as a real browser keeps them per-origin.
  return openBillnawDB(fakeIndexedDB.indexedDB, `billnaw-test-${++dbCounter}`);
}

async function main() {
  await test('opens the database and creates all expected object stores', async () => {
    const db = await freshDb();
    const expected = ['meta', 'inventory', 'customers', 'sales', 'returns', 'purchases', 'syncQueue'];
    for (const name of expected) {
      ok(db.objectStoreNames.contains(name), `missing store: ${name}`);
    }
  });

  await test('put() + get() round-trips a single inventory record by id', async () => {
    const db = await freshDb();
    const item = { id: 'item-1', name: 'Motorola G84', stock: 10, price: 18999 };
    await put(db, 'inventory', item);
    const back = await get(db, 'inventory', 'item-1');
    eq(back, item);
  });

  await test('customers are keyed by phone, matching the real (shop_id, phone) unique constraint', async () => {
    const db = await freshDb();
    await put(db, 'customers', { phone: '9876543210', name: 'Ramesh' });
    await put(db, 'customers', { phone: '9876543210', name: 'Ramesh Traders' }); // same phone = update, not a duplicate
    const all = await getAll(db, 'customers');
    eq(all.length, 1, 'same phone must overwrite, not duplicate:');
    eq(all[0].name, 'Ramesh Traders');
  });

  await test('sales/returns/purchases are keyed by idempotency_key, matching SyncEngine\'s own dedup key exactly', async () => {
    const db = await freshDb();
    const sale = { idempotency_key: 'abc-123', invoiceNo: 'INV-1', total: 500 };
    await put(db, 'sales', sale);
    await put(db, 'sales', sale); // replaying the same idempotency_key must not create a second row
    const all = await getAll(db, 'sales');
    eq(all.length, 1);
  });

  await test('syncQueue accepts multiple envelopes without a caller-supplied key (autoIncrement)', async () => {
    const db = await freshDb();
    const k1 = await put(db, 'syncQueue', { kind: 'sale', payload: { a: 1 }, queuedAt: '2026-01-01' });
    const k2 = await put(db, 'syncQueue', { kind: 'return', payload: { b: 2 }, queuedAt: '2026-01-02' });
    ok(k1 !== k2, 'each queued envelope must get a distinct key:');
    const all = await getAll(db, 'syncQueue');
    eq(all.length, 2);
  });

  await test('meta stores scalars (tenantProfile, invCounter, etc.) under their own key, like today\'s bn_* localStorage keys', async () => {
    const db = await freshDb();
    await setMeta(db, 'invCounter', 42);
    await setMeta(db, 'tenantProfile', { shopName: 'Sunrise Electronics' });
    eq(await getMeta(db, 'invCounter'), 42);
    eq(await getMeta(db, 'tenantProfile'), { shopName: 'Sunrise Electronics' });
    eq(await getMeta(db, 'nonExistentKey'), undefined);
  });

  await test('remove() deletes exactly one record, leaving the rest untouched', async () => {
    const db = await freshDb();
    await put(db, 'inventory', { id: 'i1', name: 'A' });
    await put(db, 'inventory', { id: 'i2', name: 'B' });
    await remove(db, 'inventory', 'i1');
    const all = await getAll(db, 'inventory');
    eq(all.length, 1);
    eq(all[0].id, 'i2');
  });

  await test('putAll() bulk-loads many records in one transaction (for one-time migration from localStorage)', async () => {
    const db = await freshDb();
    const records = Array.from({ length: 500 }, (_, i) => ({ id: `bulk-${i}`, name: `Item ${i}`, stock: i }));
    await putAll(db, 'inventory', records);
    const all = await getAll(db, 'inventory');
    eq(all.length, 500);
  });

  await test('clearStore() empties one store without affecting others', async () => {
    const db = await freshDb();
    await put(db, 'inventory', { id: 'i1', name: 'A' });
    await put(db, 'customers', { phone: '111', name: 'X' });
    await clearStore(db, 'inventory');
    eq((await getAll(db, 'inventory')).length, 0);
    eq((await getAll(db, 'customers')).length, 1, 'clearing one store must not touch another:');
  });

  await test('scale: 5,000 sales can be written and a single record fetched WITHOUT reading the rest — the actual fix over localStorage\'s full-array rewrite/reparse pattern', async () => {
    const db = await freshDb();
    const records = Array.from({ length: 5000 }, (_, i) => ({
      idempotency_key: `scale-${i}`, invoiceNo: `INV-${i}`, total: i, items: [{ name: 'x', qty: 1 }],
    }));
    await putAll(db, 'sales', records);

    // The point: fetching ONE record by key does not require touching the
    // other 4,999 — unlike localStorage's bn_sales, where reading or
    // writing anything means JSON.parse/stringify-ing the entire array.
    const one = await get(db, 'sales', 'scale-2500');
    eq(one.invoiceNo, 'INV-2500');

    const all = await getAll(db, 'sales');
    eq(all.length, 5000);
  });
}

function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }

main().then(() => {
  console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
  process.exit(failed ? 1 : 0);
});
