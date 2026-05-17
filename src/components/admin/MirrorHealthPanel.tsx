/**
 * MirrorHealthPanel — per-peer live health derived from sync_peer_health
 * (heartbeat / push / pull / apply timestamps, probe latency, outbox depth,
 * apply error count, schema versions). Replaces the heartbeat noise that
 * used to live in the Exchange Log.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

type State = "ok" | "degraded" | "broken" | "pairing" | "schema_mismatch" | "snapshot_required";

interface HealthRow {
  peer_link_id: string;
  peer_name: string | null;
  state: State;
  last_heartbeat_at: string | null;
  last_push_ok_at: string | null;
  last_pull_ok_at: string | null;
  last_apply_ok_at: string | null;
  last_probe_latency_ms: number | null;
  pending_outbox_count: number;
  apply_errors_count: number;
  schema_version_local: string | null;
  schema_version_remote: string | null;
  last_error_text: string | null;
  updated_at: string;
}

const age = (ts: string | null) => {
  if (!ts) return "—";
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
};

const stateBadge = (s: State) => {
  const map: Record<State, { v: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    ok: { v: "default", label: "OK" },
    degraded: { v: "outline", label: "Degraded" },
    broken: { v: "destructive", label: "Broken" },
    pairing: { v: "secondary", label: "Pairing" },
    schema_mismatch: { v: "destructive", label: "Schema Mismatch" },
    snapshot_required: { v: "destructive", label: "Snapshot Required" },
  };
  const m = map[s] ?? map.broken;
  return <Badge variant={m.v} className="text-[10px] uppercase">{m.label}</Badge>;
};

export const MirrorHealthPanel = () => {
  const { data: rows = [] } = useQuery({
    queryKey: ["sync-peer-health"],
    queryFn: async (): Promise<HealthRow[]> => {
      const { data, error } = await supabase
        .from("sync_peer_health" as any)
        .select("*")
        .order("peer_name");
      if (error) throw error;
      return (data ?? []) as unknown as HealthRow[];
    },
    refetchInterval: 5_000,
  });

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Mirror Health</h3>
          <p className="text-xs text-muted-foreground">
            Live per-peer health from <span className="font-mono">sync_peer_health</span> — refreshes every 5s. Heartbeat data lives here, not in the Exchange Log.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground uppercase">
              <th className="text-left px-2 py-2 font-medium">Peer</th>
              <th className="text-left px-2 py-2 font-medium">State</th>
              <th className="text-left px-2 py-2 font-medium">Schema</th>
              <th className="text-right px-2 py-2 font-medium">Probe</th>
              <th className="text-right px-2 py-2 font-medium">Heart</th>
              <th className="text-right px-2 py-2 font-medium">Push ok</th>
              <th className="text-right px-2 py-2 font-medium">Pull ok</th>
              <th className="text-right px-2 py-2 font-medium">Outbox</th>
              <th className="text-right px-2 py-2 font-medium">Errors</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.peer_link_id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium">{r.peer_name ?? "—"}</td>
                <td className="px-2 py-1.5">{stateBadge(r.state)}</td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  v{r.schema_version_local ?? "?"} ↔ v{r.schema_version_remote ?? "?"}
                </td>
                <td className="px-2 py-1.5 text-right">{r.last_probe_latency_ms ?? "—"}ms</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{age(r.last_heartbeat_at)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{age(r.last_push_ok_at)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{age(r.last_pull_ok_at)}</td>
                <td className="px-2 py-1.5 text-right">{r.pending_outbox_count}</td>
                <td className={`px-2 py-1.5 text-right ${r.apply_errors_count > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {r.apply_errors_count}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No peers yet — pair a server first</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
