/* ==========================================================================
   BILLNAW — LOCAL DATABASE (IndexedDB)
   Deployed plain-JS twin of src/core/database/index.ts (Phase 6 cutover,
   docs/PHASE6_CUTOVER_PLAN.md). Loaded before app.js, same convention as
   dom.js/gstConfig.js/etc. — kept in lockstep with the typed source via
   tests/database-parity.js (byte-diff after stripping TS-only syntax),
   the same pattern used for every other extracted engine in this repo.

   See src/core/database/index.ts for the full design rationale (why
   IndexedDB, the schema, why every store is keyed to match the app's own
   existing identity scheme). This file is the runtime implementation;
   that one is the typed reference kept in sync with it.
   ========================================================================== */

const DB_NAME = 'billnaw';
const DB_VERSION = 1;

const STORE_CONFIG = {
  meta: { keyPath: 'key' },
  inventory: { keyPath: 'id' },
  customers: { keyPath: 'phone' },
  sales: { keyPath: 'idempotency_key' },
  returns: { keyPath: 'idempotency_key' },
  purchases: { keyPath: 'idempotency_key' },
  syncQueue: { autoIncrement: true },
};

function openBillnawDB(idb = indexedDB, name = DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = idb.open(name, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of Object.keys(STORE_CONFIG)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, STORE_CONFIG[storeName]);
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function get(db, store, key) {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function put(db, store, record) {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putAll(db, store, records) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    records.forEach((r) => os.put(r));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

function remove(db, store, key) {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearStore(db, store) {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getMeta(db, key) {
  const row = await get(db, 'meta', key);
  return row ? row.value : undefined;
}

function setMeta(db, key, value) {
  return put(db, 'meta', { key: key, value: value });
}

// clear a store then repopulate it in one call — used by persistState()
// to sync a whole in-memory array (APP_STATE.inventory etc.) to its store,
// replacing whatever localStorage's JSON.stringify-the-whole-array write
// used to do, but per-store rather than one giant blob, and off the main
// thread (IndexedDB transactions are async).
async function replaceAll(db, store, records) {
  await clearStore(db, store);
  if (records && records.length) await putAll(db, store, records);
}

const LocalDB = {
  DB_NAME, DB_VERSION,
  openBillnawDB, getAll, get, put, putAll, remove, clearStore, getMeta, setMeta, replaceAll,
};

window.LocalDB = LocalDB;
