/**
 * Offline-aware mutation wrapper.
 * When online: executes directly via Supabase.
 * When offline: enqueues to IndexedDB and returns optimistically.
 */

import { supabase } from "@/integrations/supabase/client";
import { enqueue } from "./offline-queue";
import { syncPendingActions } from "./sync-engine";
import { toast } from "sonner";

type OfflineMutationOptions = {
  table: string;
  operation: "insert" | "upsert" | "update";
  payload: Record<string, any>;
  upsertConflict?: string;
  meta?: Record<string, any>;
};

export async function offlineMutation(opts: OfflineMutationOptions): Promise<{ offline: boolean; error?: string }> {
  // If online, try direct execution
  if (navigator.onLine) {
    try {
      let result;
      const table = opts.table as any;

      if (opts.operation === "insert") {
        result = await supabase.from(table).insert(opts.payload);
      } else if (opts.operation === "upsert") {
        result = await supabase.from(table).upsert(opts.payload, {
          onConflict: opts.upsertConflict,
        } as any);
      } else if (opts.operation === "update") {
        const { _match, ...updateFields } = opts.payload;
        if (_match) {
          let q = supabase.from(table).update(updateFields);
          for (const [k, v] of Object.entries(_match as Record<string, any>)) {
            q = q.eq(k, v);
          }
          result = await q;
        }
      }

      if (result?.error) {
        // If it's a network error, fall through to offline mode
        if (result.error.message?.includes("fetch") || result.error.message?.includes("network")) {
          // Fall through to enqueue
        } else {
          return { offline: false, error: result.error.message };
        }
      } else {
        return { offline: false };
      }
    } catch (e: any) {
      // Network error — fall through to offline enqueue
      if (!(e?.message?.includes("fetch") || e?.message?.includes("Failed") || e?.message?.includes("network"))) {
        return { offline: false, error: e.message };
      }
    }
  }

  // Offline: enqueue the action
  try {
    await enqueue({
      table: opts.table,
      operation: opts.operation,
      payload: opts.payload,
      upsertConflict: opts.upsertConflict,
      meta: opts.meta,
    });
    toast.info("Saved offline — will sync when connected");
    return { offline: true };
  } catch (e: any) {
    return { offline: true, error: e.message };
  }
}

// Trigger sync attempt (e.g., after coming back online)
export async function triggerSync() {
  return syncPendingActions();
}
