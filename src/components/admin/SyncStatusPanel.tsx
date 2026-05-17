/**
 * SyncStatusPanel — human-friendly mirror status for the Peers tab.
 *
 * Shows for every paired peer:
 *  - Sent / Recv cumulative cursors + Sent progress bar (push_cursor vs local outbox tip)
 *  - Last push / last pull timestamps with a relative age
 *  - Recent throughput (rows in the last 5 min, per direction)
 *  - Plain-English status pill: Up to date | Catching up | Idle | Error | Pairing
 *
 * "Up to date" = push_cursor == local outbox tip AND last 3 pull batches were
 * each smaller than the batch size (no more rows waiting on the remote).
 *
 * Refreshes every 5 s, same cadence as cms-sync ticks.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowUpFromLine, ArrowDownToLine, CheckCircle2, Loader2, AlertTriangle, Pause } from "lucide-react";

const BATCH_SIZE = 200; // matches cms-sync default tick batch

interface PeerLink {
  id: string;
  display_name: string;
  status: string;
  last_seen_at: string | null;
  last_push_cursor: number;
  last_pull_cursor: number;
  last_push_error: string | null;
  last_pull_error: string | null;
}

interface ExchangeRow {
  peer_link_id: string | null;
  direction: string;
  status: string;
  row_count: number | null;
  created_at: string;
}

const age = (ts: string | null) => {
  if (!ts) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ");

export const SyncStatusPanel = () => {
  // 1) All paired peers
  const { data: peers = [] } = useQuery({
    queryKey: ["sync-status-peers"],
    queryFn: async (): Promise<PeerLink[]> => {
      const { data, error } = await supabase
        .from("peer_links")
        .select("id, display_name, status, last_seen_at, last_push_cursor, last_pull_cursor, last_push_error, last_pull_error")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as PeerLink[];
    },
    refetchInterval: 5_000,
  });

  // 2) Local outbox tip (what we still need to send out)
  const { data: outboxTip = 0 } = useQuery({
    queryKey: ["sync-outbox-tip"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("sync_outbox" as any)
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      if (error) return 0;
      return Number((data?.[0] as any)?.id ?? 0);
    },
    refetchInterval: 5_000,
  });

  // 3) Recent exchange activity (last 5 min) for throughput + caught-up detection
  const sinceIso = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: recent = [] } = useQuery({
    queryKey: ["sync-status-recent", sinceIso.slice(0, 16)],
    queryFn: async (): Promise<ExchangeRow[]> => {
      const { data, error } = await supabase
        .from("sync_exchange_logs")
        .select("peer_link_id, direction, status, row_count, created_at")
        .gte("created_at", sinceIso)
        .in("direction", ["push", "pull"])
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ExchangeRow[];
    },
    refetchInterval: 5_000,
  });

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-card-foreground">Sync Status</h3>
          <p className="text-xs text-muted-foreground">
            Per-peer summary of what's been sent to and received from each mirror. Refreshes every 5s.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          local tip #{fmt(outboxTip)}
        </Badge>
      </div>

      {peers.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No peers paired yet. Use the panel below to pair this server with another node.
        </p>
      ) : (
        <div className="space-y-2">
          {peers.map((p) => {
            const peerLogs = recent.filter((r) => r.peer_link_id === p.id);
            const sentRecent  = peerLogs.filter((r) => r.direction === "push").reduce((a, r) => a + (r.row_count ?? 0), 0);
            const recvRecent  = peerLogs.filter((r) => r.direction === "pull").reduce((a, r) => a + (r.row_count ?? 0), 0);
            const lastPushLog = peerLogs.find((r) => r.direction === "push");
            const lastPullLog = peerLogs.find((r) => r.direction === "pull");
            const lastPulls   = peerLogs.filter((r) => r.direction === "pull").slice(0, 3);
            const recentPullErr = peerLogs.find((r) => r.status === "error");

            // Push progress (we know both ends — local outbox tip and our cursor)
            const sendPct = outboxTip > 0 ? Math.min(100, Math.round((p.last_push_cursor / outboxTip) * 100)) : 100;
            const sendBehind = Math.max(0, outboxTip - p.last_push_cursor);

            // Pull "caught up" heuristic: we've seen at least 1 pull and the last
            // 3 pull batches all returned strictly less than a full batch.
            const pullCaughtUp = lastPulls.length > 0 && lastPulls.every((r) => (r.row_count ?? 0) < BATCH_SIZE);
            const pullIdle = lastPulls.length === 0;

            // Overall status pill
            let pill: { icon: typeof CheckCircle2; label: string; variant: "default" | "secondary" | "outline" | "destructive"; tone: string };
            if (p.status === "paused")            pill = { icon: Pause,         label: "Paused",       variant: "secondary",  tone: "text-muted-foreground" };
            else if (p.status.startsWith("pend")) pill = { icon: Loader2,       label: "Pairing",      variant: "secondary",  tone: "text-amber-500" };
            else if (recentPullErr || p.last_push_error || p.last_pull_error)
                                                  pill = { icon: AlertTriangle, label: "Error",        variant: "destructive",tone: "text-destructive" };
            else if (sendBehind === 0 && pullCaughtUp)
                                                  pill = { icon: CheckCircle2,  label: "Up to date",   variant: "default",    tone: "text-emerald-500" };
            else if (sentRecent > 0 || recvRecent > 0)
                                                  pill = { icon: Loader2,       label: "Catching up",  variant: "outline",    tone: "text-primary" };
            else                                  pill = { icon: Activity,      label: "Idle",         variant: "outline",    tone: "text-muted-foreground" };
            const PillIcon = pill.icon;

            return (
              <div key={p.id} className="rounded border border-border p-3 space-y-2.5">
                {/* Header line: name + pill + last seen */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-card-foreground truncate">{p.display_name}</span>
                    <Badge variant={pill.variant} className={`text-[10px] uppercase gap-1 ${pill.tone}`}>
                      <PillIcon className={`w-3 h-3 ${pill.label === "Catching up" || pill.label === "Pairing" ? "animate-spin" : ""}`} />
                      {pill.label}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    last contact {age(p.last_seen_at)}
                  </span>
                </div>

                {/* Sent / Recv counters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* SENT (push) */}
                  <div className="rounded bg-muted/30 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ArrowUpFromLine className="w-3 h-3" /> Sent
                      </span>
                      <span className="font-mono text-card-foreground">
                        #{fmt(p.last_push_cursor)} <span className="text-muted-foreground">/ #{fmt(outboxTip)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 rounded bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${sendBehind === 0 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${sendPct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{sendBehind === 0 ? "fully pushed" : `${fmt(sendBehind)} row${sendBehind === 1 ? "" : "s"} behind`}</span>
                      <span>+{fmt(sentRecent)} last 5m · {lastPushLog ? age(lastPushLog.created_at) : "—"}</span>
                    </div>
                  </div>

                  {/* RECV (pull) */}
                  <div className="rounded bg-muted/30 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ArrowDownToLine className="w-3 h-3" /> Recv
                      </span>
                      <span className="font-mono text-card-foreground">cursor #{fmt(p.last_pull_cursor)}</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${pullCaughtUp ? "bg-emerald-500" : pullIdle ? "bg-muted-foreground/30" : "bg-primary"}`}
                        style={{ width: pullCaughtUp ? "100%" : pullIdle ? "0%" : "66%" }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>
                        {pullIdle
                          ? "no recent pulls"
                          : pullCaughtUp
                            ? "caught up with remote"
                            : `last batch ${lastPulls[0]?.row_count ?? 0} rows (≥ ${BATCH_SIZE} → more pending)`}
                      </span>
                      <span>+{fmt(recvRecent)} last 5m · {lastPullLog ? age(lastPullLog.created_at) : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Errors line */}
                {(p.last_push_error || p.last_pull_error || recentPullErr?.status === "error") && (
                  <div className="text-[11px] text-destructive font-mono break-all">
                    {p.last_pull_error && <div>pull: {p.last_pull_error}</div>}
                    {p.last_push_error && <div>push: {p.last_push_error}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
