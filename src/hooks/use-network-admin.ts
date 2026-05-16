/**
 * Hooks for Network admin tooling — peer-mesh era.
 * Legacy hub/spoke hooks (local servers, initial-sync jobs, secret rotation,
 * server-overview RPCs) were removed; that data is now owned by per-node
 * `node_identity` + `peer_links` and exposed through PeerLinksPanel.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface UpdateCommand {
  id: string;
  casino_id: string;
  target_version: string;
  auto_apply: boolean;
  status: "pending" | "acknowledged" | "applied" | "failed";
  status_message: string | null;
  issued_by: string;
  issued_at: string;
  acknowledged_at: string | null;
  applied_at: string | null;
}

export const useUpdateCommands = () => useQuery({
  queryKey: ["update-commands"],
  queryFn: async (): Promise<UpdateCommand[]> => {
    const { data, error } = await supabase
      .from("update_commands" as any)
      .select("*")
      .order("issued_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as UpdateCommand[];
  },
  refetchInterval: 15_000,
});

export const usePushUpdate = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ casinoId, version, autoApply }: { casinoId: string; version: string; autoApply: boolean }) => {
      const { error } = await supabase.from("update_commands" as any).insert({
        casino_id: casinoId,
        target_version: version.trim(),
        auto_apply: autoApply,
        issued_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["update-commands"] });
      toast.success("Update queued");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export interface CronJobHealth {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_start: string | null;
  last_status: string | null;
  last_runtime_ms: number | null;
  total_failures_24h: number;
}

export const useCronHealth = () => useQuery({
  queryKey: ["cron-health"],
  queryFn: async (): Promise<CronJobHealth[]> => {
    const { data, error } = await supabase.rpc("cron_health_overview" as any);
    if (error) throw error;
    return (data ?? []) as unknown as CronJobHealth[];
  },
  refetchInterval: 30_000,
});

export interface SyncOutboxHealth {
  casino_id: string;
  pending_count: number;
  oldest_pending_at: string | null;
  failed_count: number;
}

export const useSyncOutboxHealth = () => useQuery({
  queryKey: ["sync-outbox-health"],
  queryFn: async (): Promise<SyncOutboxHealth[]> => {
    const { data, error } = await supabase.rpc("sync_outbox_health" as any);
    if (error) throw error;
    return (data ?? []) as unknown as SyncOutboxHealth[];
  },
  refetchInterval: 30_000,
});
