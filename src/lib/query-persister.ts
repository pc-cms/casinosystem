/**
 * Persist React Query cache to IndexedDB for offline reads.
 * Uses idb-keyval for simple key-value storage.
 */
import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const IDB_KEY = "cms-query-cache";

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(IDB_KEY, client);
      } catch (e) {
        console.warn("[Persister] Failed to save cache:", e);
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(IDB_KEY);
      } catch (e) {
        console.warn("[Persister] Failed to restore cache:", e);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(IDB_KEY);
      } catch (e) {
        // ignore
      }
    },
  };
}
