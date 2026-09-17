/* ==========================================================================
   BILLNAW — RPC & RLS TEST SUITE
   Run:  tests/rpc-rls-setup.sh && node tests/rpc-rls-tests.js
   (or:  npm run test:rpc, which does both plus teardown)

   Everything else in tests/ exercises pure JS logic extracted from the
   client files. Nothing anywhere in this repo touched Supabase, RLS, or the
   atomic RPCs before this file — AUDIT_REPORT.md/MIGRATION_PLAN.md both
   flagged that as the single biggest test-coverage gap for a financial
   system, since the RPCs and RLS policies are precisely the layer enforcing
   tenant isolation and transaction integrity.

   This suite runs against a REAL PostgreSQL 16 instance with every
   migration in supabase/migrations/ applied exactly as Supabase would
   apply them (see rpc-rls-setup.sh) — not a mock, not a re-implementation
   of the SQL in JS. It connects as a genuinely non-superuser, non-table-
   owner role (`app_user`, standing in for Supabase's `authenticated`
   role) so RLS policies are actually enforced; running as the table owner
   or a superuser would make every isolation check a false positive, since
   Postgres bypasses RLS entirely for both.

   Fixture setup (creating shops/users/items before a test) uses a separate
   admin connection deliberately, bypassing RLS -- fixture creation is not
   under test; only the operations described in each test group are.
   ========================================================================== */

const { Client } = require('pg');

const SOCK_DIR = process.env.PGDATA_DIR ? `${process.env.PGDATA_DIR}/sock` : '/tmp/billnaw_pgtest/sock';
const DB_NAME = 'billnaw_test';

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, msg: e.message });
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
function group(name) { console.log(`\n${name}`); }
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
async function expectReject(promise, msgFragment) {
  try {
    await promise;
  } catch (e) {
    if (msgFragment && !e.message.includes(msgFragment)) {
      throw new Error(`rejected, but with the wrong message: expected to include "${msgFragment}", got "${e.message}"`);
    }
    return e;
  }
  throw new Error('expected a rejection, but the call succeeded');
}

// ---- connections ----
const admin = new Client({ host: SOCK_DIR, database: DB_NAME, user: 'postgres' });
const app = new Client({ host: SOCK_DIR, database: DB_NAME, user: 'app_user' });

// Simulates "logged in as this user" for the app_user connection, the same
// way Supabase's PostgREST sets the JWT claim per request.
async function loginAs(userId) {
  await app.query(`SET request.jwt.claim.sub = '${userId}'`);
}
async function logout() {
  await app.query(`SET request.jwt.claim.sub = ''`);
}

function uuid() {
  return require('crypto').randomUUID();
}

async function main() {
  await admin.connect();
  await app.connect();

  // ======================================================================
  // FIXTURES — two active shops, one revoked shop, owner+cashier per shop,
  // a super_admin, and starter inventory. Created via the admin connection
  // (bypasses RLS deliberately; fixture creation is not under test).
  // ======================================================================
  const shopA = uuid(), shopB = uuid(), shopRevoked = uuid();
  const ownerA = uuid(), cashierA = uuid(), ownerB = uuid(), superAdmin = uuid();
  const itemA1 = uuid(), itemA2 = uuid(), itemB1 = uuid();

  await admin.query(`insert into shops (id, name, phone, address, state_code, status) values
    ('${shopA}', 'Shop A', '9000000001', 'Addr A', '19', 'active'),
    ('${shopB}', 'Shop B', '9000000002', 'Addr B', '27', 'active'),
    ('${shopRevoked}', 'Shop Revoked', '9000000003', 'Addr R', '19', 'active')`);

  await admin.query(`insert into auth.users (id) values
    ('${ownerA}'), ('${cashierA}'), ('${ownerB}'), ('${superAdmin}')`);

  await admin.query(`insert into profiles (id, shop_id, role, full_name) values
    ('${ownerA}', '${shopA}', 'owner', 'Owner A'),
    ('${cashierA}', '${shopA}', 'cashier', 'Cashier A'),
    ('${ownerB}', '${shopB}', 'owner', 'Owner B'),
    ('${superAdmin}', null, 'super_admin', 'Super Admin')`);

  await admin.query(`insert into items (id, shop_id, name, category, hsn, gst, price, cost, stock) values
    ('${itemA1}', '${shopA}', 'Item A1', 'Electronics', '8517', 18, 1000, 700, 10),
    ('${itemA2}', '${shopA}', 'Item A2', 'Electronics', '8517', 18, 500, 300, 5),
    ('${itemB1}', '${shopB}', 'Item B1', 'Electronics', '8517', 18, 2000, 1500, 8)`);

  // ======================================================================
  group('TENANT ISOLATION (the security test the audit flagged as untested)');
  // ======================================================================
  await test('Owner A sees only Shop A items, never Shop B\'s', async () => {
    await loginAs(ownerA);
    const res = await app.query('select id, shop_id from items order by name');
    eq(res.rows.length, 2, 'row count');
    ok(res.rows.every((r) => r.shop_id === shopA), 'every row belongs to Shop A');
  });

  await test('Owner A cannot read Shop B\'s shop row', async () => {
    await loginAs(ownerA);
    const res = await app.query(`select id from shops where id = '${shopB}'`);
    eq(res.rows.length, 0);
  });

  await test('Owner A cannot UPDATE a Shop B item (0 rows affected, not an error)', async () => {
    await loginAs(ownerA);
    const res = await app.query(`update items set price = 99999 where id = '${itemB1}'`);
    eq(res.rowCount, 0);
    const check = await admin.query(`select price from items where id = '${itemB1}'`);
    eq(Number(check.rows[0].price), 2000, 'Shop B item price must be unchanged');
  });

  await test('Owner A cannot DELETE a Shop B item', async () => {
    await loginAs(ownerA);
    const res = await app.query(`delete from items where id = '${itemB1}'`);
    eq(res.rowCount, 0);
  });

  await test('Owner A cannot INSERT an item into Shop B', async () => {
    await loginAs(ownerA);
    await expectReject(
      app.query(`insert into items (shop_id, name, hsn, gst) values ('${shopB}', 'Sneaky Item', '8517', 18)`),
      'row-level security'
    );
  });

  await test('Owner B symmetrically cannot see Shop A\'s items', async () => {
    await loginAs(ownerB);
    const res = await app.query('select id from items');
    eq(res.rows.length, 1);
    eq(res.rows[0].id, itemB1);
  });

  await test('super_admin can see items across both shops', async () => {
    await loginAs(superAdmin);
    const res = await app.query('select id from items order by name');
    eq(res.rows.length, 3);
  });

  // ======================================================================
  group('SHOP REVOCATION (status must gate access, not just hide a UI button)');
  // ======================================================================
  const ownerRevoked = uuid();
  const itemRevoked = uuid();
  await admin.query(`insert into auth.users (id) values ('${ownerRevoked}')`);
  await admin.query(`insert into profiles (id, shop_id, role) values ('${ownerRevoked}', '${shopRevoked}', 'owner')`);
  await admin.query(`insert into items (id, shop_id, name, hsn, gst, stock) values ('${itemRevoked}', '${shopRevoked}', 'Revoked Shop Item', '8517', 18, 5)`);

  await test('Active shop: owner can see their own item', async () => {
    await loginAs(ownerRevoked);
    const res = await app.query('select id from items');
    eq(res.rows.length, 1);
  });

  await test('Revoked shop: owner loses all data access immediately', async () => {
    await admin.query(`update shops set status = 'revoked' where id = '${shopRevoked}'`);
    await loginAs(ownerRevoked);
    const res = await app.query('select id from items');
    eq(res.rows.length, 0, 'a revoked shop\'s owner must see zero rows, not their own inventory');
  });

  await test('Reactivated shop: access is restored', async () => {
    await admin.query(`update shops set status = 'active' where id = '${shopRevoked}'`);
    await loginAs(ownerRevoked);
    const res = await app.query('select id from items');
    eq(res.rows.length, 1);
  });

  // ======================================================================
  group('ROLE-BASED FINANCIAL REDACTION (server-side, not just UI hiding)');
  // ======================================================================
  await test('fetch_items_for_role: owner sees real cost', async () => {
    await loginAs(ownerA);
    const res = await app.query(`select * from fetch_items_for_role('${shopA}') where id = '${itemA1}'`);
    eq(Number(res.rows[0].cost), 700);
  });

  await test('fetch_items_for_role: cashier gets NULL cost, not the real figure', async () => {
    await loginAs(cashierA);
    const res = await app.query(`select * from fetch_items_for_role('${shopA}') where id = '${itemA1}'`);
    eq(res.rows[0].cost, null);
    ok(Number(res.rows[0].price) === 1000, 'price (not cost) is still visible to cashiers');
  });

  await test('shop_profit_summary: cashier is rejected outright', async () => {
    await loginAs(cashierA);
    await expectReject(app.query(`select shop_profit_summary('${shopA}')`), 'restricted to the account owner');
  });

  await test('shop_profit_summary: owner succeeds and computes real margin', async () => {
    await loginAs(ownerA);
    const res = await app.query(`select shop_profit_summary('${shopA}') as summary`);
    ok(res.rows[0].summary !== null, 'owner should get a result');
  });

  await test('purchases RLS: cashier gets zero rows even if a purchase exists', async () => {
    const purchaseId = uuid();
    await admin.query(`insert into purchases (id, shop_id, idempotency_key, taxable, gst_total, total) values ('${purchaseId}', '${shopA}', '${uuid()}', 100, 18, 118)`);
    await loginAs(cashierA);
    const res = await app.query('select id from purchases');
    eq(res.rows.length, 0, 'cashiers must be fully excluded from purchases, not just cost-redacted');
    await loginAs(ownerA);
    const ownerRes = await app.query('select id from purchases');
    eq(ownerRes.rows.length, 1, 'owner can see it');
  });

  // ======================================================================
  group('create_invoice_atomic (the actual money-moving RPC)');
  // ======================================================================
  let invoiceSaleId, invoiceIdemKey;
  await test('creates a sale, decrements stock, upserts the customer ledger -- all atomically', async () => {
    await loginAs(ownerA);
    invoiceIdemKey = uuid();
    const invoice = {
      invoice_no: 'INV-TEST-0001',
      idempotency_key: invoiceIdemKey,
      customer_snapshot: { phone: '9876500001', name: 'Test Customer' },
      tender: 'Khata',
      taxable: 1000, gst_total: 180, round_off: 0, total: 1180,
      interstate: false,
      items: [{ id: itemA1, name: 'Item A1', qty: 2 }]
    };
    const res = await app.query(`select create_invoice_atomic('${shopA}', $1::jsonb) as result`, [JSON.stringify(invoice)]);
    const result = res.rows[0].result;
    eq(result.replayed, false);
    invoiceSaleId = result.sale_id;

    const item = await admin.query(`select stock from items where id = '${itemA1}'`);
    eq(Number(item.rows[0].stock), 8, 'stock 10 - 2 = 8');

    const cust = await admin.query(`select dues, total_orders_val from customers where shop_id = '${shopA}' and phone = '9876500001'`);
    eq(Number(cust.rows[0].dues), 1180, 'Khata tender adds to dues');
    eq(Number(cust.rows[0].total_orders_val), 1180);
  });

  await test('idempotency: replaying the same idempotency_key returns the existing row, does not double-decrement stock', async () => {
    await loginAs(ownerA);
    const invoice = {
      invoice_no: 'INV-TEST-0001-RETRY',
      idempotency_key: invoiceIdemKey, // same key as above -- simulates an offline-queue retry
      customer_snapshot: { phone: '9876500001', name: 'Test Customer' },
      tender: 'Khata', taxable: 1000, gst_total: 180, total: 1180, interstate: false,
      items: [{ id: itemA1, name: 'Item A1', qty: 2 }]
    };
    const res = await app.query(`select create_invoice_atomic('${shopA}', $1::jsonb) as result`, [JSON.stringify(invoice)]);
    eq(res.rows[0].result.replayed, true);
    eq(res.rows[0].result.sale_id, invoiceSaleId, 'must return the SAME sale, not create a second one');

    const item = await admin.query(`select stock from items where id = '${itemA1}'`);
    eq(Number(item.rows[0].stock), 8, 'stock must still be 8, not double-decremented to 6');

    const cust = await admin.query(`select dues from customers where shop_id = '${shopA}' and phone = '9876500001'`);
    eq(Number(cust.rows[0].dues), 1180, 'dues must not be double-counted either');
  });

  await test('rejects a sale that would take stock negative, and rolls back the whole transaction', async () => {
    await loginAs(ownerA);
    const before = await admin.query(`select stock from items where id = '${itemA2}'`);
    const invoice = {
      invoice_no: 'INV-TEST-0002', idempotency_key: uuid(),
      customer_snapshot: {}, tender: 'Cash', taxable: 100, gst_total: 18, total: 118, interstate: false,
      items: [{ id: itemA2, name: 'Item A2', qty: 999 }] // only 5 in stock
    };
    await expectReject(
      app.query(`select create_invoice_atomic('${shopA}', $1::jsonb) as result`, [JSON.stringify(invoice)]),
      'Insufficient stock'
    );
    const after = await admin.query(`select stock from items where id = '${itemA2}'`);
    eq(Number(after.rows[0].stock), Number(before.rows[0].stock), 'a failed insert must not partially decrement stock');
    const saleCheck = await admin.query(`select id from sales where invoice_no = 'INV-TEST-0002'`);
    eq(saleCheck.rows.length, 0, 'the whole transaction rolled back -- no orphaned sale row');
  });

  await test('a cashier CAN create a sale (checkout is a cashier-facing action)', async () => {
    await loginAs(cashierA);
    const invoice = {
      invoice_no: 'INV-TEST-0003', idempotency_key: uuid(),
      customer_snapshot: {}, tender: 'Cash', taxable: 100, gst_total: 18, total: 118, interstate: false,
      items: [{ id: itemA1, name: 'Item A1', qty: 1 }]
    };
    const res = await app.query(`select create_invoice_atomic('${shopA}', $1::jsonb) as result`, [JSON.stringify(invoice)]);
    eq(res.rows[0].result.replayed, false);
  });

  await test('owner A cannot create an invoice against shop B (cross-tenant RPC call rejected)', async () => {
    await loginAs(ownerA);
    const invoice = {
      invoice_no: 'INV-TEST-HACK', idempotency_key: uuid(),
      customer_snapshot: {}, tender: 'Cash', taxable: 10, gst_total: 1.8, total: 11.8,
      items: [{ id: itemB1, name: 'Item B1', qty: 1 }]
    };
    await expectReject(
      app.query(`select create_invoice_atomic('${shopB}', $1::jsonb) as result`, [JSON.stringify(invoice)]),
      'Not permitted'
    );
  });

  // ======================================================================
  group('process_sales_return_atomic');
  // ======================================================================
  await test('full return: creates a credit note, restocks, flips invoice status to returned', async () => {
    await loginAs(ownerA);
    const ret = {
      credit_note_no: 'CN-TEST-0001', idempotency_key: uuid(),
      restock: true, taxable: 1000, gst_total: 180, total: 1180,
      items: [{ id: itemA1, name: 'Item A1', qty: 2 }]
    };
    const stockBefore = await admin.query(`select stock from items where id = '${itemA1}'`);
    const res = await app.query(
      `select process_sales_return_atomic('${shopA}', '${invoiceSaleId}', $1::jsonb) as result`,
      [JSON.stringify(ret)]
    );
    eq(res.rows[0].result.replayed, false);
    eq(res.rows[0].result.invoice_status, 'returned');

    const stockAfter = await admin.query(`select stock from items where id = '${itemA1}'`);
    eq(Number(stockAfter.rows[0].stock), Number(stockBefore.rows[0].stock) + 2, 'restock adds qty back');

    const sale = await admin.query(`select status, returned_value from sales where id = '${invoiceSaleId}'`);
    eq(sale.rows[0].status, 'returned');
    eq(Number(sale.rows[0].returned_value), 1180);

    const cust = await admin.query(`select dues from customers where shop_id = '${shopA}' and phone = '9876500001'`);
    eq(Number(cust.rows[0].dues), 0, 'Khata dues credited back to zero');
  });

  await test('over-return is rejected: cannot return more than was sold minus already returned', async () => {
    await loginAs(ownerA);
    const ret = {
      credit_note_no: 'CN-TEST-0002', idempotency_key: uuid(),
      restock: true, taxable: 1000, gst_total: 180, total: 1180,
      items: [{ id: itemA1, name: 'Item A1', qty: 1 }] // already fully returned above
    };
    await expectReject(
      app.query(`select process_sales_return_atomic('${shopA}', '${invoiceSaleId}', $1::jsonb) as result`, [JSON.stringify(ret)]),
      'only'
    );
  });

  // ======================================================================
  group('decrement_item_stock');
  // ======================================================================
  await test('guarded decrement succeeds when stock is sufficient', async () => {
    await loginAs(ownerA);
    const before = await admin.query(`select stock from items where id = '${itemA2}'`);
    await app.query(`select decrement_item_stock('${itemA2}', 1)`);
    const after = await admin.query(`select stock from items where id = '${itemA2}'`);
    eq(Number(after.rows[0].stock), Number(before.rows[0].stock) - 1);
  });

  await test('guarded decrement rejects when stock is insufficient (no negative stock)', async () => {
    await loginAs(ownerA);
    await expectReject(app.query(`select decrement_item_stock('${itemA2}', 999999)`), 'Insufficient stock');
  });

  // ======================================================================
  group('AUDIT LOG (must be genuinely append-only)');
  // ======================================================================
  await test('a user can insert their own audit_log row', async () => {
    await loginAs(superAdmin);
    await app.query(`insert into audit_log (actor_id, shop_id, action) values ('${superAdmin}', '${shopA}', 'test_action')`);
  });

  await test('nobody can SELECT audit_log via the client role -- not even super_admin', async () => {
    await loginAs(superAdmin);
    const res = await app.query('select id from audit_log');
    eq(res.rows.length, 0, 'no select policy exists at all -- RLS default-denies read for every role');
  });

  await test('nobody can UPDATE or DELETE audit_log rows', async () => {
    await loginAs(superAdmin);
    const upd = await app.query(`update audit_log set action = 'tampered' where actor_id = '${superAdmin}'`);
    eq(upd.rowCount, 0);
    const del = await app.query(`delete from audit_log where actor_id = '${superAdmin}'`);
    eq(del.rowCount, 0);
  });

  // ======================================================================
  group('KNOWN GAP -- new-shop signup insert policy (see SECURITY_REPORT.md)');
  // ======================================================================
  await test('[DOCUMENTS A REAL FINDING] shops has no INSERT policy: a brand-new signup insert is rejected under RLS', async () => {
    const brandNewUser = uuid();
    await admin.query(`insert into auth.users (id) values ('${brandNewUser}')`);
    await loginAs(brandNewUser);
    // This mirrors exactly what supabaseClient.js's createShopForCurrentUser()
    // does: a plain client-side insert into `shops` as the newly-authenticated
    // user, with no profiles row yet (there's nothing to check shop_id/role
    // against, since none exists). No INSERT policy exists anywhere across
    // all 9 migrations for `shops` or `profiles` -- RLS default-denies any
    // write with no matching policy, for every role including the row's own
    // future owner. If this test's rejection ever starts passing (i.e. the
    // insert succeeds), it means a migration added the missing policy --
    // that's progress, not a regression, and this test should be deleted at
    // that point rather than "fixed" to expect success.
    await expectReject(
      app.query(`insert into shops (name, phone, address) values ('Brand New Shop', '9999999998', 'New Addr')`),
      'row-level security'
    );
  });

  await test('[DOCUMENTS THE SAME GAP] profiles has no INSERT policy either -- assign_staff_to_shop() is the only sanctioned bypass, and only for cashiers', async () => {
    const brandNewUser2 = uuid();
    const someShop = shopA;
    await admin.query(`insert into auth.users (id) values ('${brandNewUser2}')`);
    await loginAs(brandNewUser2);
    await expectReject(
      app.query(`insert into profiles (id, shop_id, role) values ('${brandNewUser2}', '${someShop}', 'owner')`),
      'row-level security'
    );
  });

  // ======================================================================
  console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
  if (failed) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.msg}`));
  }

  await admin.end();
  await app.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try { await admin.end(); } catch {}
  try { await app.end(); } catch {}
  process.exit(1);
});
