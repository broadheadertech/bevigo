/**
 * Thin async IndexedDB wrapper for the offline layer. Two stores:
 *
 *   - `cache`   — keyed snapshots of Convex query results (menu items,
 *                  categories, ingredients, current shift, settings). Read
 *                  on register page mount so we can show the same data
 *                  the cashier was seeing when the network dropped.
 *
 *   - `queue`   — FIFO of mutations that couldn't run because we were
 *                  offline. Each entry has the Convex function path, args,
 *                  attempts count, optimistic id, and metadata (e.g. the
 *                  pre-allocated BIR serial).
 *
 * We intentionally avoid pulling in `idb` or `Dexie` — IndexedDB's native
 * API is a few dozen lines once you wrap it in promises, and a hard
 * dependency on a 3rd-party DB lib for a payment-critical path is risky.
 */

const DB_NAME = "bevigo-offline";
const DB_VERSION = 1;

export type QueueEntry = {
  /** Stable optimistic id assigned at enqueue time. */
  id: string;
  /** Convex function reference path, e.g. "orders/mutations:completeOrder". */
  fn: string;
  /** Args passed to the mutation (must be JSON-serialisable). */
  args: unknown;
  /** Times we've tried to replay; bumped by the replay loop. */
  attempts: number;
  /** Wall-clock the entry was queued at (ms since epoch). */
  queuedAt: number;
  /** Optional metadata — pre-allocated BIR serial, device id, etc. */
  meta?: Record<string, unknown>;
  /** Last error message from a failed replay, if any. */
  lastError?: string;
};

export type CacheEntry<T = unknown> = {
  key: string;
  data: T;
  storedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        const store = db.createObjectStore("queue", { keyPath: "id" });
        store.createIndex("by_queuedAt", "queuedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
  return dbPromise;
}

function tx<T>(
  storeName: "cache" | "queue",
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result: T;
        const maybeReq = run(store);
        if (maybeReq instanceof IDBRequest) {
          maybeReq.onsuccess = () => {
            result = maybeReq.result as T;
          };
          maybeReq.onerror = () => reject(maybeReq.error);
        } else {
          maybeReq.then((r) => (result = r), reject);
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = await tx<CacheEntry<T> | undefined>("cache", "readonly", (s) =>
        s.get(key)
      );
      return entry ? (entry.data as T) : null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, data: T): Promise<void> {
    try {
      await tx("cache", "readwrite", (s) =>
        s.put({ key, data, storedAt: Date.now() } satisfies CacheEntry<T>)
      );
    } catch {
      // Quota errors etc. — fail soft, online path still works.
    }
  },
  async delete(key: string): Promise<void> {
    try {
      await tx("cache", "readwrite", (s) => s.delete(key));
    } catch {
      // ignore
    }
  },
  async clear(): Promise<void> {
    try {
      await tx("cache", "readwrite", (s) => s.clear());
    } catch {
      // ignore
    }
  },
};

export const queue = {
  async enqueue(
    entry: Omit<QueueEntry, "id" | "attempts" | "queuedAt"> & {
      id?: string;
    }
  ): Promise<string> {
    const id = entry.id ?? crypto.randomUUID();
    const full: QueueEntry = {
      id,
      fn: entry.fn,
      args: entry.args,
      attempts: 0,
      queuedAt: Date.now(),
      meta: entry.meta,
    };
    await tx("queue", "readwrite", (s) => s.put(full));
    return id;
  },
  async list(): Promise<QueueEntry[]> {
    try {
      return await tx<QueueEntry[]>("queue", "readonly", (s) => {
        // getAll is enough since we expect at most a few hundred entries.
        return s.getAll() as IDBRequest<QueueEntry[]>;
      }).then((entries) => entries.sort((a, b) => a.queuedAt - b.queuedAt));
    } catch {
      return [];
    }
  },
  async count(): Promise<number> {
    try {
      return await tx<number>("queue", "readonly", (s) =>
        s.count() as IDBRequest<number>
      );
    } catch {
      return 0;
    }
  },
  async update(entry: QueueEntry): Promise<void> {
    await tx("queue", "readwrite", (s) => s.put(entry));
  },
  async delete(id: string): Promise<void> {
    await tx("queue", "readwrite", (s) => s.delete(id));
  },
  async clear(): Promise<void> {
    await tx("queue", "readwrite", (s) => s.clear());
  },
};

/**
 * Wipe everything — used by AuthProvider on logout so the next user
 * doesn't see stale cached menus.
 */
export async function resetOfflineDb(): Promise<void> {
  await Promise.all([cache.clear(), queue.clear()]);
}
