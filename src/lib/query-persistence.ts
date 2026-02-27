"use client";

import {
  removeOldestQuery,
  type Persister,
} from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QUERY_PERSISTENCE_KEY } from "@/lib/query-client";

const noopPersister: Persister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

let browserPersister: Persister | undefined;

export function getQueryPersister(): Persister {
  if (typeof window === "undefined") {
    return noopPersister;
  }

  if (!browserPersister) {
    try {
      browserPersister = createSyncStoragePersister({
        key: QUERY_PERSISTENCE_KEY,
        storage: window.localStorage,
        throttleTime: 1000,
        retry: removeOldestQuery,
      });
    } catch {
      browserPersister = noopPersister;
    }
  }

  return browserPersister;
}

export function clearPersistedQueryCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUERY_PERSISTENCE_KEY);
  } catch {
    // noop
  }
}
