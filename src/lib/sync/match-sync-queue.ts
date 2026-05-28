const DB_NAME = "rankingpong-sync";
const DB_VERSION = 1;
const STORE = "pending-matches";

export const SYNC_TAG = "register-match";

export type PendingMatchPayload = {
  requestId: string;
  playerId: string;
  opponentId: string;
  outcome: string;
  enqueuedAt: number;
};

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "requestId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const result = fn(store);

      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result as T);
        result.onerror = () => reject(result.error);
      } else {
        Promise.resolve(result).then(resolve, reject);
      }

      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function enqueuePendingMatch(payload: PendingMatchPayload): Promise<void> {
  if (!hasIndexedDB()) return;
  await runTx("readwrite", (store) => store.put(payload));
}

export async function removePendingMatch(requestId: string): Promise<void> {
  if (!hasIndexedDB()) return;
  await runTx("readwrite", (store) => store.delete(requestId));
}

export async function getAllPendingMatches(): Promise<PendingMatchPayload[]> {
  if (!hasIndexedDB()) return [];
  return (await runTx("readonly", (store) => store.getAll())) as PendingMatchPayload[];
}

export async function clearPendingMatches(): Promise<void> {
  if (!hasIndexedDB()) return;
  await runTx("readwrite", (store) => store.clear());
}

export async function tryRegisterBackgroundSync(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;

    if (!syncManager) return false;

    await syncManager.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}
