/**
 * Sync Engine — processes offline queue when connection is restored.
 * Runs actions in chronological order, retries with exponential backoff.
 * After MAX_RETRIES, marks action as permanently_failed (no further retries).
 * Designed for wired connections with brief packet-loss interruptions.
 */

import { supabase } from "@/integrations/supabase/client";
import { getPendingActions, markAction, removeAction, type QueuedAction } from "./offline-queue";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s

export type SyncStatus = "online" | "offline" | "syncing";
type SyncListener = (status: SyncStatus, pending: number) => void;

const listeners = new Set<SyncListener>();
let currentStatus: SyncStatus = navigator.onLine ? "online" : "offline";
let pendingCount = 0;
let syncInProgress = false;

export function getSyncStatus() {
  return { status: currentStatus, pendingCount };
}

export function onSyncStatusChange(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(status: SyncStatus, pending: number) {
  currentStatus = status;
  pendingCount = pending;
  listeners.forEach(fn => fn(status, pending));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeAction(action: QueuedAction): Promise<boolean> {
  try {
    let result;
    const table = action.table as any;

    if (action.operation === "insert") {
      result = await supabase.from(table).insert(action.payload);
    } else if (action.operation === "upsert") {
      result = await supabase.from(table).upsert(action.payload, {
        onConflict: action.upsertConflict,
      } as any);
    } else if (action.operation === "update") {
      const { _match, ...updateFields } = action.payload;
      if (_match) {
        let q = supabase.from(table).update(updateFields);
        for (const [k, v] of Object.entries(_match as Record<string, any>)) {
          q = q.eq(k, v);
        }
        result = await q;
      } else {
        result = await supabase.from(table).update(updateFields);
      }
    }

    if (result?.error) {
      console.error(`[Sync] Failed action ${action.id}:`, result.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[Sync] Exception on action ${action.id}:`, e);
    return false;
  }
}

export async function syncPendingActions(): Promise<{ synced: number; failed: number }> {
  if (syncInProgress || !navigator.onLine) return { synced: 0, failed: 0 };
  syncInProgress = true;

  const pending = await getPendingActions();
  if (pending.length === 0) {
    syncInProgress = false;
    notify("online", 0);
    return { synced: 0, failed: 0 };
  }

  notify("syncing", pending.length);

  // Sort by timestamp to preserve order
  pending.sort((a, b) => a.timestamp - b.timestamp);

  let synced = 0;
  let failed = 0;

  for (const action of pending) {
    // Check connection before each action — abort early on disconnect
    if (!navigator.onLine) {
      console.log("[Sync] Connection lost during sync, pausing...");
      break;
    }

    await markAction(action.id, "syncing");
    const success = await executeAction(action);

    if (success) {
      await removeAction(action.id);
      synced++;
      notify("syncing", pending.length - synced - failed);
    } else {
      const newRetries = action.retries + 1;
      if (newRetries >= MAX_RETRIES) {
        // Permanently failed — stop retrying
        await markAction(action.id, "permanently_failed", newRetries);
        failed++;
        console.error(`[Sync] Action ${action.id} permanently failed after ${MAX_RETRIES} retries`);
      } else {
        // Exponential backoff before marking as pending again
        const backoffMs = BASE_DELAY_MS * Math.pow(2, newRetries - 1);
        console.log(`[Sync] Action ${action.id} retry ${newRetries}/${MAX_RETRIES}, waiting ${backoffMs}ms...`);
        await delay(backoffMs);
        await markAction(action.id, "pending", newRetries);
        failed++;
      }
    }
  }

  syncInProgress = false;

  const remaining = await getPendingActions();
  notify("online", remaining.length);

  if (synced > 0) {
    console.log(`[Sync] Completed: ${synced} synced, ${failed} failed`);
  }

  // If there are still pending actions and we're online, schedule another round
  if (remaining.length > 0 && navigator.onLine) {
    setTimeout(() => syncPendingActions(), 3000);
  }

  return { synced, failed };
}

// Initialize connection monitoring
let initialized = false;
export function initSyncEngine() {
  if (initialized) return;
  initialized = true;

  const handleOnline = () => {
    console.log("[Sync] Connection restored, starting sync...");
    syncPendingActions().then(() => {
      // M8: Notify app to staggered-refetch critical data after reconnect,
      // instead of React Query's all-at-once refetchOnReconnect (which
      // DDoSes the API on flaky links).
      window.dispatchEvent(new CustomEvent("cms:reconnected"));
    });
  };


  const handleOffline = () => {
    console.log("[Sync] Connection lost");
    notify("offline", pendingCount);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Set initial status
  if (navigator.onLine) {
    // Try to sync any leftover pending actions from previous session
    syncPendingActions();
  } else {
    notify("offline", 0);
  }
}
