/**
 * Offline Queue — stores pending mutations in IndexedDB.
 * When connection is restored, syncs them in order.
 * Prevents duplicates via idempotency keys.
 */

const DB_NAME = "cms-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "pending_actions";

export type QueuedAction = {
  id: string;
  table: string;
  operation: "insert" | "upsert" | "update";
  payload: Record<string, any>;
  upsertConflict?: string;
  timestamp: number;
  retries: number;
  status: "pending" | "syncing" | "failed" | "permanently_failed";
  meta?: Record<string, any>; // extra context for logging
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(action: Omit<QueuedAction, "id" | "timestamp" | "retries" | "status">): Promise<string> {
  const db = await openDB();
  const id = `${action.table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: QueuedAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retries: 0,
    status: "pending",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const idx = tx.objectStore(STORE_NAME).index("timestamp");
    const req = idx.getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedAction[];
      resolve(all.filter(a => a.status === "pending" || a.status === "failed" || a.status === "syncing"));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markAction(id: string, status: QueuedAction["status"], retries?: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result as QueuedAction | undefined;
      if (!entry) { resolve(); return; }
      entry.status = status;
      if (retries !== undefined) entry.retries = retries;
      store.put(entry);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeAction(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const actions = await getPendingActions();
  return actions.length;
}

export async function clearCompleted(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedAction[];
      for (const a of all) {
        if (a.status !== "pending" && a.status !== "syncing") {
          store.delete(a.id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
