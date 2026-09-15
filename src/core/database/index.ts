/* ==========================================================================
   BILLNAW — LOCAL DATABASE (IndexedDB), Phase 6 first increment

   THIS IS NOT WIRED INTO THE DEPLOYED APP. index.html still loads app.js,
   which still uses localStorage exactly as before. Nothing here changes
   runtime behavior until a separate, explicit cutover happens — per
   docs/MIGRATION_PLAN.md Phase 6's own gate ("requires explicit approval
   before starting... must preserve idempotency_key semantics exactly").
   This file is that phase's first safe increment: build and prove the new
   storage layer in isolation, the same pattern every other extraction this
   migration has used (gst, export, alerts, printer, supabase, permissions)
   — parallel first, cutover later, as its own reviewed step.

   WHY THIS EXISTS — localStorage cannot be "made" to hold years of data:
   - Hard cap of ~5-10MB per origin (varies by browser), enforced by the
     browser, not configurable. Once hit, every write throws
     QuotaExceededError. There is no negotiating with it.
   - persistState() (app.js) currently re-serializes the ENTIRE inventory/
     customers/sales/returns/purchases arrays to JSON strings and rewrites
     all of them, synchronously, on every single state change — a sale,
     a stock edit, a customer save. That's O(total historical data) work
     on the main thread for every interaction, which gets slower every
     day the shop operates, independent of the size cap.
   IndexedDB has neither limit: capacity is effectively bounded by device
   free space (browsers report far larger quotas, often gigabytes), and
   writes are per-record, not whole-dataset rewrites, and asynchronous
   (never blocks the UI thread).

   SCHEMA — one object store per existing localStorage key, keyed the same
   way the app already treats each collection as unique:
     meta       — keyPath 'key'               (tenantProfile, invCounter,
                                                 cnCounter, lastSyncedAt —
                                                 anything currently a single
                                                 scalar/object under its own
                                                 bn_* key)
     inventory  — keyPath 'id'                (items)
     customers  — keyPath 'phone'             (matches shops.customers'
                                                 real unique key today:
                                                 (shop_id, phone) unique
                                                 constraint in 0001_init.sql)
     sales      — keyPath 'idempotency_key'   (matches SyncEngine's own
     returns    — keyPath 'idempotency_key'     dedup key exactly — no new
     purchases  — keyPath 'idempotency_key'     identity scheme invented)
     syncQueue  — autoIncrement                (envelope: {kind, payload,
                                                 queuedAt}, same shape
                                                 SyncEngine.enqueue already
                                                 uses)

   Every store gets a single put()/get()/delete() per record, not a
   whole-array rewrite — this is the actual fix, not just "a bigger box."
   ========================================================================== */

export const DB_NAME = 'billnaw';
export const DB_VERSION = 1;

export type StoreName = 'meta' | 'inventory' | 'customers' | 'sales' | 'returns' | 'purchases' | 'syncQueue';

const STORE_CONFIG: Record<StoreName, IDBObjectStoreParameters> = {
  meta: { keyPath: 'key' },
  inventory: { keyPath: 'id' },
  customers: { keyPath: 'phone' },
  sales: { keyPath: 'idempotency_key' },
  returns: { keyPath: 'idempotency_key' },
  purchases: { keyPath: 'idempotency_key' },
  syncQueue: { autoIncrement: true },
};

export function openBillnawDB(idb: IDBFactory = indexedDB, name: string = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(name, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of Object.keys(STORE_CONFIG) as StoreName[]) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, STORE_CONFIG[storeName]);
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, store: StoreName, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

export function getAll<T = any>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export function get<T = any>(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

// Single-record write — the whole point. Never rewrites the rest of the
// store, unlike the current localStorage persistState() pattern.
export function put<T = any>(db: IDBDatabase, store: StoreName, record: T): Promise<IDBValidKey> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').put(record as any);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Bulk write — for one-time migration of existing localStorage data into
// this store, not for routine per-sale writes (use put() for those).
export function putAll<T = any>(db: IDBDatabase, store: StoreName, records: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    records.forEach((r) => os.put(r as any));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function remove(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function clearStore(db: IDBDatabase, store: StoreName): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// meta is a key/value store (one row per scalar the app currently keeps
// under its own bn_* localStorage key) — these two helpers hide the
// {key, value} record shape so call sites read like a plain map.
export async function getMeta<T = any>(db: IDBDatabase, key: string): Promise<T | undefined> {
  const row = await get<{ key: string; value: T }>(db, 'meta', key);
  return row?.value;
}

export function setMeta<T = any>(db: IDBDatabase, key: string, value: T): Promise<IDBValidKey> {
  return put(db, 'meta', { key, value });
}
