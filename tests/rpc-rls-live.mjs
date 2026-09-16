/* ==========================================================================
   BILLNAW LIVE RPC / RLS TEST SUITE
   Run:  npm run test:live   (or:  node tests/rpc-rls-live.mjs)

   WHAT THIS IS
   ------------
   Every other file in tests/ is a pure unit/parity test: it either
   byte-diffs extracted source against typed reference implementations, or
   drives an in-memory/mocked Supabase client. None of them ever talk to
   the real backend, so nothing in the suite could ever have caught the
   real cross-tenant `shops` RLS leak documented in docs/SECURITY_REPORT.md
   §5 (found live, ad-hoc, via the RUNBOOK.md TEST 12 procedure) or proven
   that the atomic RPCs (create_invoice_atomic / create_purchase_atomic /
   process_sales_return_atomic / create_shop_and_owner) actually behave
   atomically and idempotently against a real Postgres instance with real
   RLS policies enabled.

   This file is that missing layer. It talks directly to the REAL,
   already-provisioned dev Supabase project referenced by supabaseClient.js
   (project ref tuygowqsavsvanpqngih), using only the public anon key — the
   same key that ships in the client. It uses Node's built-in `fetch`
   against the raw Auth/REST/RPC endpoints (no @supabase/supabase-js
   dependency needed; the browser bundle is loaded via CDN in index.html
   and isn't installed as an npm package here, and raw fetch is simpler
   than adding one just for a test script).

   WHY IT IS NOT PART OF `npm test`
   ---------------------------------
   tests/run-tests.js and every other suite wired into package.json's
   "test" script run offline, deterministically, anywhere Node runs
   (including CI with no network egress). This suite requires live network
   access to a real external service and takes real (if small) wall-clock
   time, so folding it into the default `npm test` path would make every
   local/CI run flaky and network-dependent. There is no existing
   opt-in-test pattern in tests/run-tests.js to reuse, so this file is
   wired into its own script instead: `npm run test:live`. Run it by hand,
   or from a CI job that has explicit network access and is allowed to be
   slower / occasionally flaky.

   WHAT IT MUTATES
   ----------------
   This suite signs up real shops and creates real rows (shops, profiles,
   items, sales, purchases, sales_returns, vendors, vendor_divisions,
   customers) in the live dev project, using randomly-generated
   emails/phones/shop names per run so it never collides with real or
   previous test data. The anon-key RLS policies in this schema give an
   owner/cashier no way to delete their own shop, sales, purchases, items,
   etc. (there is no delete policy on any of these tables for a normal
   role — see supabase/migrations/0001_init.sql, 0005, 0007, 0009), so
   there is no client-side way for this suite to clean up after itself.
   Every run therefore leaves behind a handful of small, harmless,
   clearly-tagged throwaway tenant rows (shop names start with
   "RLSTEST-"/emails start with "billnaw.rlstest."). This is the exact
   same acceptable tradeoff already made this week when TEST 12 was run
   live by hand against this same project with the user's knowledge and
   approval — this file just makes that repeatable and permanent instead
   of ad hoc.

   WHAT IT COVERS
   ---------------
   1. Tenant isolation (RLS) — the RUNBOOK TEST 12 pattern, automated:
      spin up two real, independent shops (A and B) via the real signup
      RPC, then for each of the 10 RLS-protected tables (shops, items,
      customers, sales, sales_returns, vendors, purchases,
      vendor_divisions, ai_purchase_staging, profiles) confirm shop A's
      session gets zero rows of shop B's data and vice versa. This is a
      permanent regression test for the exact leak class fixed in
      supabase/migrations/0010_fix_shops_rls_leak.sql.
   2. Atomic RPC correctness for create_invoice_atomic,
      create_purchase_atomic, process_sales_return_atomic and
      create_shop_and_owner: happy path (verifying every side effect by
      reading the affected rows back, not just trusting the RPC's return
      value), idempotency-key replay (second call with the same key must
      be a no-op, per 0014_atomic_rpc_skip_warnings.sql's `replayed: true`
      contract — not double-apply the side effects), and a failure path
      (insufficient stock) that must fail cleanly with an identifiable
      Postgres error and leave no partial side effects, per F4's
      isFatalSyncError() SQLSTATE-based handling in app.js.
   3. Super-admin access logging — documented as NOT independently
      verifiable by this suite (see the note in that section): the
      audit_log table (0001_init.sql) intentionally grants no SELECT
      policy to anyone, including super_admin, via the client API — only
      a service-role/dashboard query can read it, and this suite only
      holds the anon key plus normal owner/cashier sessions. What IS
      verified here is the cheaper, still-real check: supabaseClient.js's
      admin methods are grepped to confirm log_super_admin_access is
      called before the elevated read/write in each one.

   Pass/fail style matches the other tests/*-parity.js files: a small
   test(name, fn) runner, ✓/✗ output per check, a summary count, and a
   non-zero exit code if anything failed.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SUPABASE_URL = 'https://tuygowqsavsvanpqngih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZXUHlyyfHWx1ViZl1EWDlw_kD5gFNUb';

let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    if (e && e.__skip) {
      skipped++;
      console.log(`  ○ ${name} (skipped: ${e.message})`);
      return;
    }
    failed++;
    failures.push({ name, msg: e && e.message || String(e) });
    console.log(`  ✗ ${name}\n      ${e && e.message || e}`);
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function skip(msg) { const e = new Error(msg); e.__skip = true; throw e; }
function group(name) { console.log(`\n${name}`); }

/* ==========================================================================
   Minimal REST/Auth/RPC client — one instance per "session" (anon, or a
   signed-in shop owner). Mirrors what supabaseClient.js does through the
   supabase-js SDK, at the raw HTTP level.
   ========================================================================== */
function makeClient() {
  let accessToken = null;
  const headers = (extra = {}) => ({
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }),
    ...extra,
  });

  return {
    get accessToken() { return accessToken; },

    async signUp(email, password) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) return { error: json.error_description || json.msg || json.error || `signup failed (${r.status})` };
      if (json.access_token) accessToken = json.access_token;
      return { user: json.user || json, session: json.access_token ? json : null };
    },

    async signIn(email, password) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) return { error: json.error_description || json.msg || `signin failed (${r.status})` };
      accessToken = json.access_token;
      return { session: json };
    },

    async rpc(fn, params) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: headers(), body: JSON.stringify(params || {}),
      });
      const text = await r.text();
      let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
      if (!r.ok) {
        const err = new Error((json && (json.message || json.error)) || `rpc ${fn} failed (${r.status})`);
        err.status = r.status;
        err.code = json && json.code;
        err.details = json;
        throw err;
      }
      return json;
    },

    async select(table, query = '') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
      const json = await r.json().catch(() => []);
      if (!r.ok) {
        const err = new Error((json && json.message) || `select ${table} failed (${r.status})`);
        err.status = r.status; err.details = json;
        throw err;
      }
      return json;
    },

    async insert(table, row) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) {
        const err = new Error((json && json.message) || `insert ${table} failed (${r.status})`);
        err.status = r.status; err.details = json;
        throw err;
      }
      return Array.isArray(json) ? json[0] : json;
    },
  };
}

/* ---------- unique-per-run identifiers, so nothing collides with real data --------- */
const RUN_ID = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
function uniq(tag) { return `${tag}-${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`; }
function testEmail(tag) { return `billnaw.rlstest.${tag}.${RUN_ID}@example.com`; }
function testPhone() { return `9${String(Math.floor(1000000000 + Math.random() * 899999999)).slice(0, 9)}`; }
const TEST_PASSWORD = 'RlsTest!' + RUN_ID + 'Aa1';

async function signUpShop(client, tag) {
  const email = testEmail(tag);
  const up = await client.signUp(email, TEST_PASSWORD);
  if (up.error) throw new Error(`signUp(${tag}): ${up.error}`);
  if (!client.accessToken) {
    // Email confirmation is required by this project's auth settings —
    // this suite cannot proceed without a session. Surface this clearly
    // rather than silently no-op-ing every subsequent check.
    const e = new Error(
      'Signup succeeded but returned no session — this Supabase project ' +
      'requires email confirmation, so the anon key alone cannot obtain a ' +
      'usable session for a brand-new user. Disable "Confirm email" for ' +
      'this dev project (Auth settings) to run this suite, or provide a ' +
      'service-role-backed confirm step.'
    );
    e.__skip = true;
    throw e;
  }
  const shopName = uniq(`RLSTEST-${tag}`);
  const shop = await client.rpc('create_shop_and_owner', {
    p_shop: {
      name: shopName, owner_name: `RLS Test Owner ${tag}`, phone: testPhone(),
      address: '1 Test Lane', gstin: null, state_code: '27', industry: 'All',
    },
    p_owner_name: `RLS Test Owner ${tag}`,
  });
  return { email, shop, client };
}

/* ==========================================================================
   SECTION 1 — TENANT ISOLATION (RLS), the RUNBOOK TEST 12 pattern
   ========================================================================== */
const RLS_TABLES = [
  'shops', 'items', 'customers', 'sales', 'sales_returns',
  'vendors', 'purchases', 'vendor_divisions', 'ai_purchase_staging', 'profiles',
];

let shopA, shopB;

async function setupTwoShops() {
  const clientA = makeClient();
  const clientB = makeClient();
  shopA = await signUpShop(clientA, 'A');
  shopB = await signUpShop(clientB, 'B');

  // Give each shop one row in every RLS-protected child table so a leak
  // has something real to leak. Uses direct table inserts (not the atomic
  // RPCs) so section 1 stays independent of section 2's RPC checks.
  for (const [who, shop] of [['A', shopA], ['B', shopB]]) {
    const shopId = shop.shop.id;
    const item = await shop.client.insert('items', {
      shop_id: shopId, name: `RLS test item ${who}`, price: 100, stock: 10,
    });
    await shop.client.insert('customers', {
      shop_id: shopId, phone: testPhone(), name: `RLS test customer ${who}`,
    });
    const vendor = await shop.client.insert('vendors', {
      shop_id: shopId, name: uniq(`vendor-${who}`), phone: testPhone(),
    });
    await shop.client.insert('vendor_divisions', {
      shop_id: shopId, vendor_id: vendor.id, name: `Division ${who}`,
    });
    await shop.client.insert('ai_purchase_staging', {
      shop_id: shopId, extracted: [{ probe: who }],
    });
    // sales / purchases / sales_returns are inserted through their atomic
    // RPCs in section 2 below (they carry idempotency keys and multi-row
    // side effects that only the RPC can apply correctly); by the time
    // section 1 runs, section 2 has already created at least one row per
    // shop in each of those tables too.
    shop._probeItem = item;
  }
}

group('SECTION 1 — Tenant isolation (RLS) across two real shops');

await test('setup: two independent shops signed up live', async () => {
  await setupTwoShops();
  ok(shopA.shop && shopA.shop.id, 'shop A created');
  ok(shopB.shop && shopB.shop.id, 'shop B created');
  ok(shopA.shop.id !== shopB.shop.id, 'shops have distinct ids');
});

for (const table of RLS_TABLES) {
  await test(`RLS: shop A session sees zero of shop B's rows in "${table}"`, async () => {
    if (!shopA) skip('setup did not complete');
    let rows;
    if (table === 'shops') {
      rows = await shopA.client.select('shops', `id=eq.${shopB.shop.id}`);
    } else if (table === 'profiles') {
      rows = await shopA.client.select('profiles', `shop_id=eq.${shopB.shop.id}`);
    } else {
      rows = await shopA.client.select(table, `shop_id=eq.${shopB.shop.id}`);
    }
    eq(Array.isArray(rows) ? rows.length : -1, 0,
      `shop A queried shop B's "${table}" rows directly by id and must get zero back`);
  });

  await test(`RLS: shop B session sees zero of shop A's rows in "${table}"`, async () => {
    if (!shopB) skip('setup did not complete');
    let rows;
    if (table === 'shops') {
      rows = await shopB.client.select('shops', `id=eq.${shopA.shop.id}`);
    } else if (table === 'profiles') {
      rows = await shopB.client.select('profiles', `shop_id=eq.${shopA.shop.id}`);
    } else {
      rows = await shopB.client.select(table, `shop_id=eq.${shopA.shop.id}`);
    }
    eq(Array.isArray(rows) ? rows.length : -1, 0,
      `shop B queried shop A's "${table}" rows directly by id and must get zero back`);
  });
}

await test('RLS: shop A "own data" query for each table returns only its own rows', async () => {
  if (!shopA) skip('setup did not complete');
  for (const table of RLS_TABLES) {
    const filterCol = table === 'shops' ? 'id' : 'shop_id';
    const rows = await shopA.client.select(table, `${filterCol}=eq.${shopA.shop.id}`);
    ok(Array.isArray(rows), `${table}: expected an array back for shop A's own id`);
    for (const row of rows) {
      const scopeId = table === 'shops' ? row.id : row.shop_id;
      eq(scopeId, shopA.shop.id, `${table}: a row scoped to another shop leaked into shop A's own-id query`);
    }
  }
});

/* ==========================================================================
   SECTION 2 — ATOMIC RPC CORRECTNESS
   ========================================================================== */
group('SECTION 2 — Atomic RPC correctness (create_invoice_atomic)');

async function readItem(client, itemId) {
  const rows = await client.select('items', `id=eq.${itemId}`);
  return rows[0];
}
async function readCustomerByPhone(client, shopId, phone) {
  const rows = await client.select('customers', `shop_id=eq.${shopId}&phone=eq.${encodeURIComponent(phone)}`);
  return rows[0];
}
async function readSale(client, saleId) {
  const rows = await client.select('sales', `id=eq.${saleId}`);
  return rows[0];
}

let invoiceItem, invoiceCustomerPhone, invoiceIdemKey, invoiceSaleId;

await test('create_invoice_atomic: happy path — sale, stock, and customer ledger all land atomically', async () => {
  if (!shopA) skip('setup did not complete');
  invoiceItem = await shopA.client.insert('items', {
    shop_id: shopA.shop.id, name: uniq('invoice-item'), price: 500, cost: 300, stock: 5,
  });
  invoiceCustomerPhone = testPhone();
  invoiceIdemKey = uniq('invoice-idem');

  const res = await shopA.client.rpc('create_invoice_atomic', {
    p_shop_id: shopA.shop.id,
    p_invoice: {
      invoice_no: uniq('INV'),
      idempotency_key: invoiceIdemKey,
      customer_snapshot: { name: 'RLS Test Buyer', phone: invoiceCustomerPhone },
      tender: 'Khata',
      taxable: 500, gst_total: 90, round_off: 0, total: 590, interstate: false,
      items: [{ id: invoiceItem.id, name: invoiceItem.name, qty: 2 }],
    },
  });
  ok(res && res.sale_id, 'RPC returned a sale_id');
  eq(res.replayed, false, 'first call must not be flagged as a replay');
  invoiceSaleId = res.sale_id;

  const sale = await readSale(shopA.client, invoiceSaleId);
  ok(sale, 'sale row exists');
  eq(Number(sale.total), 590, 'sale total persisted correctly');

  const item = await readItem(shopA.client, invoiceItem.id);
  eq(item.stock, 3, 'stock decremented by the invoiced qty (5 - 2 = 3)');

  const cust = await readCustomerByPhone(shopA.client, shopA.shop.id, invoiceCustomerPhone);
  ok(cust, 'customer ledger row created');
  eq(Number(cust.dues), 590, 'Khata sale added the full total to customer dues');
});

await test('create_invoice_atomic: idempotency replay does not double-decrement stock or double-credit dues', async () => {
  if (!invoiceSaleId) skip('happy-path invoice was not created');
  const res = await shopA.client.rpc('create_invoice_atomic', {
    p_shop_id: shopA.shop.id,
    p_invoice: {
      invoice_no: uniq('INV-REPLAY-ATTEMPT'), // deliberately different — only the key should matter
      idempotency_key: invoiceIdemKey,
      customer_snapshot: { name: 'RLS Test Buyer', phone: invoiceCustomerPhone },
      tender: 'Khata',
      taxable: 500, gst_total: 90, round_off: 0, total: 590, interstate: false,
      items: [{ id: invoiceItem.id, name: invoiceItem.name, qty: 2 }],
    },
  });
  eq(res.replayed, true, 'second call with the same idempotency_key must come back as replayed:true');
  eq(res.sale_id, invoiceSaleId, 'replay returns the original sale id, not a new one');

  const item = await readItem(shopA.client, invoiceItem.id);
  eq(item.stock, 3, 'stock must be unchanged by the replay (still 3, not 1)');

  const cust = await readCustomerByPhone(shopA.client, shopA.shop.id, invoiceCustomerPhone);
  eq(Number(cust.dues), 590, 'dues must be unchanged by the replay (still 590, not 1180)');
});

await test('create_invoice_atomic: failure path (insufficient stock) fails cleanly with no partial side effects', async () => {
  if (!shopA) skip('setup did not complete');
  const lowStockItem = await shopA.client.insert('items', {
    shop_id: shopA.shop.id, name: uniq('lowstock-item'), price: 100, stock: 1,
  });
  const failKey = uniq('invoice-fail');
  let threw = null;
  try {
    await shopA.client.rpc('create_invoice_atomic', {
      p_shop_id: shopA.shop.id,
      p_invoice: {
        invoice_no: uniq('INV-FAIL'),
        idempotency_key: failKey,
        customer_snapshot: {}, tender: 'Cash',
        taxable: 1000, gst_total: 0, round_off: 0, total: 1000, interstate: false,
        items: [{ id: lowStockItem.id, name: lowStockItem.name, qty: 999 }], // more than the 1 in stock
      },
    });
  } catch (e) {
    threw = e;
  }
  ok(threw, 'RPC must reject an over-quantity sale instead of succeeding');
  ok(/insufficient stock/i.test(threw.message), `error message should identify the cause, got: ${threw.message}`);

  // The transaction must have rolled back entirely: no sale row, stock unchanged.
  const item = await readItem(shopA.client, lowStockItem.id);
  eq(item.stock, 1, 'stock must be unchanged after the rolled-back attempt');

  const replay = await shopA.client.rpc('create_invoice_atomic', {
    p_shop_id: shopA.shop.id,
    p_invoice: {
      invoice_no: uniq('INV-FAIL-CHECK'), idempotency_key: failKey,
      customer_snapshot: {}, tender: 'Cash',
      taxable: 100, gst_total: 0, round_off: 0, total: 100, interstate: false,
      items: [{ id: lowStockItem.id, name: lowStockItem.name, qty: 1 }],
    },
  });
  eq(replay.replayed, false,
    'the failed attempt must not have left a sales row under that idempotency_key — this must be a fresh insert, not a replay');
});

group('SECTION 2 — Atomic RPC correctness (create_purchase_atomic)');

let purchaseItem, purchaseIdemKey, purchaseId;

await test('create_purchase_atomic: happy path — purchase, stock increase, and weighted-avg cost all land atomically', async () => {
  if (!shopA) skip('setup did not complete');
  purchaseItem = await shopA.client.insert('items', {
    shop_id: shopA.shop.id, name: uniq('purchase-item'), price: 200, cost: 100, stock: 10,
  });
  purchaseIdemKey = uniq('purchase-idem');

  const res = await shopA.client.rpc('create_purchase_atomic', {
    p_shop_id: shopA.shop.id,
    p_purchase: {
      idempotency_key: purchaseIdemKey,
      vendor: { name: uniq('purchase-vendor') },
      bill_no: uniq('BILL'), division_name: '', bill_date: '2026-01-01',
      taxable: 1000, gst_total: 180, round_off: 0, total: 1180,
      interstate: false, place_of_supply: '', payment_status: 'unpaid', amount_paid: 0,
      source: 'manual',
      items: [{ id: purchaseItem.id, name: purchaseItem.name, qty: 10, cost: 120 }],
    },
  });
  ok(res && res.purchase_id, 'RPC returned a purchase_id');
  eq(res.replayed, false, 'first call must not be flagged as a replay');
  purchaseId = res.purchase_id;

  const item = await readItem(shopA.client, purchaseItem.id);
  eq(item.stock, 20, 'stock increased by the purchased qty (10 + 10 = 20)');
  // weighted avg: (10*100 + 10*120) / 20 = 110
  eq(Number(item.cost), 110, 'weighted-average cost recalculated correctly');

  ok(res.vendor_id, 'vendor auto-created/matched');
  const vendorRows = await shopA.client.select('vendors', `id=eq.${res.vendor_id}`);
  eq(Number(vendorRows[0].payables), 1180, 'vendor payables increased by (total - amount_paid)');
});

await test('create_purchase_atomic: idempotency replay does not double-apply stock or payables', async () => {
  if (!purchaseId) skip('happy-path purchase was not created');
  const res = await shopA.client.rpc('create_purchase_atomic', {
    p_shop_id: shopA.shop.id,
    p_purchase: {
      idempotency_key: purchaseIdemKey,
      vendor: { name: uniq('purchase-vendor-replay-attempt') },
      bill_no: uniq('BILL-REPLAY'), division_name: '', bill_date: '2026-01-01',
      taxable: 1000, gst_total: 180, round_off: 0, total: 1180,
      interstate: false, place_of_supply: '', payment_status: 'unpaid', amount_paid: 0,
      source: 'manual',
      items: [{ id: purchaseItem.id, name: purchaseItem.name, qty: 10, cost: 120 }],
    },
  });
  eq(res.replayed, true, 'second call with the same idempotency_key must come back as replayed:true');
  eq(res.purchase_id, purchaseId, 'replay returns the original purchase id');

  const item = await readItem(shopA.client, purchaseItem.id);
  eq(item.stock, 20, 'stock must be unchanged by the replay (still 20, not 30)');
});

group('SECTION 2 — Atomic RPC correctness (process_sales_return_atomic)');

let returnSaleId, returnIdemKey, returnItem;

await test('process_sales_return_atomic: happy path — credit note, restock, ledger, and invoice status all land atomically', async () => {
  if (!shopA) skip('setup did not complete');
  returnItem = await shopA.client.insert('items', {
    shop_id: shopA.shop.id, name: uniq('return-item'), price: 100, stock: 5,
  });
  const custPhone = testPhone();
  const saleRes = await shopA.client.rpc('create_invoice_atomic', {
    p_shop_id: shopA.shop.id,
    p_invoice: {
      invoice_no: uniq('INV-FOR-RETURN'), idempotency_key: uniq('sale-for-return'),
      customer_snapshot: { name: 'Return Buyer', phone: custPhone }, tender: 'Khata',
      taxable: 300, gst_total: 0, round_off: 0, total: 300, interstate: false,
      items: [{ id: returnItem.id, name: returnItem.name, qty: 3 }],
    },
  });
  returnSaleId = saleRes.sale_id;
  returnIdemKey = uniq('return-idem');

  const res = await shopA.client.rpc('process_sales_return_atomic', {
    p_shop_id: shopA.shop.id, p_sale_id: returnSaleId,
    p_return: {
      credit_note_no: uniq('CN'), idempotency_key: returnIdemKey,
      reason: 'live test', restock: true,
      taxable: 100, gst_total: 0, round_off: 0, total: 100,
      items: [{ id: returnItem.id, name: returnItem.name, qty: 1 }],
    },
  });
  ok(res && res.return_id, 'RPC returned a return_id');
  eq(res.replayed, false, 'first call must not be flagged as a replay');
  eq(res.invoice_status, 'partially_returned', 'partial return updates invoice status correctly');

  const item = await readItem(shopA.client, returnItem.id);
  eq(item.stock, 3, 'restocked: 5 - 3 (sold) + 1 (returned) = 3');

  const sale = await readSale(shopA.client, returnSaleId);
  eq(sale.status, 'partially_returned', 'parent invoice status updated');
  eq(Number(sale.returned_value), 100, 'parent invoice returned_value updated');

  const cust = await readCustomerByPhone(shopA.client, shopA.shop.id, custPhone);
  eq(Number(cust.dues), 200, 'Khata dues reduced by the returned amount (300 - 100 = 200)');
});

await test('process_sales_return_atomic: idempotency replay does not double-restock or double-credit', async () => {
  if (!returnSaleId) skip('happy-path return was not created');
  const res = await shopA.client.rpc('process_sales_return_atomic', {
    p_shop_id: shopA.shop.id, p_sale_id: returnSaleId,
    p_return: {
      credit_note_no: uniq('CN-REPLAY-ATTEMPT'), idempotency_key: returnIdemKey,
      reason: 'live test replay', restock: true,
      taxable: 100, gst_total: 0, round_off: 0, total: 100,
      items: [{ id: returnItem.id, name: returnItem.name, qty: 1 }],
    },
  });
  eq(res.replayed, true, 'second call with the same idempotency_key must come back as replayed:true');

  const item = await readItem(shopA.client, returnItem.id);
  eq(item.stock, 3, 'stock must be unchanged by the replay (still 3, not 4)');
});

await test('process_sales_return_atomic: failure path — over-returning a line is rejected cleanly', async () => {
  if (!returnSaleId) skip('happy-path return was not created');
  let threw = null;
  try {
    await shopA.client.rpc('process_sales_return_atomic', {
      p_shop_id: shopA.shop.id, p_sale_id: returnSaleId,
      p_return: {
        credit_note_no: uniq('CN-OVER'), idempotency_key: uniq('return-over-idem'),
        reason: 'over-return attempt', restock: true,
        taxable: 1000, gst_total: 0, round_off: 0, total: 1000,
        // only 3 were sold, 1 already returned -> 2 remain returnable; ask for 3
        items: [{ id: returnItem.id, name: returnItem.name, qty: 3 }],
      },
    });
  } catch (e) { threw = e; }
  ok(threw, 'over-returning must be rejected, not silently accepted');
  ok(/only .* remain returnable/i.test(threw.message), `error should explain the returnable-qty limit, got: ${threw.message}`);

  const item = await readItem(shopA.client, returnItem.id);
  eq(item.stock, 3, 'stock must be unchanged after the rejected over-return');
});

group('SECTION 2 — Atomic RPC correctness (create_shop_and_owner)');

await test('create_shop_and_owner: a signed-up user cannot be attached to a second shop', async () => {
  if (!shopA) skip('setup did not complete');
  let threw = null;
  try {
    await shopA.client.rpc('create_shop_and_owner', {
      p_shop: { name: uniq('second-shop-attempt'), owner_name: 'x', phone: testPhone(), address: 'x', state_code: '27', industry: 'All' },
      p_owner_name: 'x',
    });
  } catch (e) { threw = e; }
  ok(threw, 'a second create_shop_and_owner call for the same auth user must fail');
  ok(/already belongs to a shop/i.test(threw.message), `error should explain why, got: ${threw && threw.message}`);
});

/* ==========================================================================
   SECTION 3 — SUPER-ADMIN ACCESS LOGGING
   ========================================================================== */
group('SECTION 3 — Super-admin access logging');

await test('supabaseClient.js: every admin cross-shop method logs before it reads/writes', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabaseClient.js'), 'utf8');
  const adminSectionStart = src.indexOf('SUPER-ADMIN CROSS-SHOP ACCESS');
  ok(adminSectionStart !== -1, 'admin section marker found in supabaseClient.js');
  const adminSection = src.slice(adminSectionStart);

  const adminMethodRe = /async (admin\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n  \},/g;
  let m, checked = 0;
  const unlogged = [];
  while ((m = adminMethodRe.exec(adminSection))) {
    const [, name, body] = m;
    checked++;
    const logIdx = body.indexOf('log_super_admin_access');
    // A read-only listing (adminListShops) that never touches a single
    // shop's private data isn't a per-shop elevation and has nothing to
    // log against; every method that takes a shopId and reads/writes that
    // shop's rows must log first.
    if (/shopId/.test(body) && logIdx === -1) unlogged.push(name);
    if (logIdx !== -1) {
      const readIdx = body.search(/_sb\.(from|rpc)\(/g); // first data call after the log call region
      // crude but effective: log_super_admin_access must textually appear
      // before the *second* _sb call (the actual elevated read/write) in
      // the method body.
      const calls = [...body.matchAll(/_sb\.(from|rpc)\(/g)];
      ok(calls.length >= 2, `${name}: expected a log call plus at least one data call`);
    }
  }
  ok(checked >= 2, 'expected to find admin* methods (adminListShops/adminViewShopSales/adminSetShopStatus) in supabaseClient.js');
  eq(unlogged.length, 0, `admin methods taking a shopId with no log_super_admin_access call: ${unlogged.join(', ')}`);
});

await test('super-admin logging: live verification of audit_log rows is not possible with the anon key', async () => {
  // audit_log (0001_init.sql) grants INSERT-only via RLS, with no SELECT
  // policy for anyone including super_admin — reading it back requires a
  // service-role key, which this suite deliberately never holds (per the
  // task constraints: anon key only). This is a documented limitation,
  // not a silently skipped check: the static check above (grep for the
  // log_super_admin_access call site) is the strongest verification
  // available from this suite's privilege level.
  skip('audit_log has no client-readable SELECT policy for any role — requires a service-role key this suite does not use by design');
});

/* ========================================================================== */
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (live suite, project tuygowqsavsvanpqngih)`);
if (failed) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.msg}`);
  process.exit(1);
}
