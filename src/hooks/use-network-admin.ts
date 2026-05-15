/**
 * Hooks for Network/Servers admin tooling.
 * - useUpdateCommands / usePushUpdate / rotateSecret
 * - useCronHealth / useSyncHealth
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
      toast.success("Update queued — local server will pick it up on next health ping");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useRotateServerSecret = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serverId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("rotate_local_server_secret" as any, { _server_id: serverId } as any);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["local-servers"] });
      toast.success("Secret rotated. Update local .env immediately.");
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

export interface LocalServerOverview {
  id: string;
  casino_id: string;
  server_name: string;
  server_ip: string | null;
  is_online: boolean;
  last_sync_at: string | null;
  health_updated_at: string | null;
  current_version: string | null;
  uptime_seconds: number | null;
  containers_running: number | null;
  containers_total: number | null;
  disk_used_pct: number | null;
  minutes_since_sync: number | null;
}

export const useLocalServersOverview = () => useQuery({
  queryKey: ["local-servers-overview"],
  queryFn: async (): Promise<LocalServerOverview[]> => {
    const { data, error } = await supabase.rpc("local_servers_overview" as any);
    if (error) throw error;
    return (data ?? []) as unknown as LocalServerOverview[];
  },
  refetchInterval: 30_000,
});

export interface SyncInboxHealth {
  casino_id: string;
  total_24h: number;
  errors_24h: number;
  last_applied_at: string | null;
  oldest_error_at: string | null;
}

export const useSyncInboxHealth = () => useQuery({
  queryKey: ["sync-inbox-health"],
  queryFn: async (): Promise<SyncInboxHealth[]> => {
    const { data, error } = await supabase.rpc("sync_inbox_health" as any);
    if (error) throw error;
    return (data ?? []) as unknown as SyncInboxHealth[];
  },
  refetchInterval: 30_000,
});

export interface SyncOutboxPerTable {
  casino_id: string;
  table_name: string;
  pending_count: number;
  oldest_change_at: string | null;
  oldest_minutes: number | null;
}

export const useSyncOutboxPerTable = () => useQuery({
  queryKey: ["sync-outbox-per-table"],
  queryFn: async (): Promise<SyncOutboxPerTable[]> => {
    const { data, error } = await supabase.rpc("sync_outbox_per_table" as any);
    if (error) throw error;
    return (data ?? []) as unknown as SyncOutboxPerTable[];
  },
  refetchInterval: 30_000,
});

// ───── Initial Sync jobs ─────
export interface InitialSyncJob {
  id: string;
  casino_id: string;
  local_server_id: string;
  status: "pending" | "running" | "done" | "failed";
  tables_total: number | null;
  tables_done: number | null;
  rows_total: number | null;
  rows_done: number | null;
  current_table: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export const useInitialSyncJobs = () => useQuery({
  queryKey: ["initial-sync-jobs"],
  queryFn: async (): Promise<InitialSyncJob[]> => {
    const { data, error } = await supabase
      .from("initial_sync_jobs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as unknown as InitialSyncJob[];
  },
  refetchInterval: 3_000,
});

export const useTriggerInitialSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (localServerId: string) => {
      const { data, error } = await supabase.functions.invoke("initial-sync-trigger", {
        body: { local_server_id: localServerId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initial-sync-jobs"] });
      toast.success("Initial Sync queued — server will start pulling within 10s");
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });
};
