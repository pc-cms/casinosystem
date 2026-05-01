/**
 * NetworkHealthPanel — super_admin / finance_manager view of:
 *   - cron job health (last run, status, 24h failures)
 *   - sync outbox depth per casino (pending / failed / oldest pending)
 *   - recent update_commands queue
 */
import { useCronHealth, useSyncOutboxHealth, useUpdateCommands } from "@/hooks/use-network-admin";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Rocket, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmtMs = (ms: number | null) => ms == null ? "—" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
const fmtTime = (ts: string | null) => ts ? new Date(ts).toLocaleString() : "—";

const useCasinoNameMap = () => {
  const { data } = useQuery({
    queryKey: ["all-casinos-namemap"],
    queryFn: async () => {
      const { data } = await supabase.from("casinos").select("id, name");
      const m = new Map<string, string>();
      (data ?? []).forEach(c => m.set(c.id, c.name));
      return m;
    },
  });
  return data ?? new Map<string, string>();
};

export const NetworkHealthPanel = () => {
  const { data: cron = [] } = useCronHealth();
  const { data: sync = [] } = useSyncOutboxHealth();
  const { data: cmds = [] } = useUpdateCommands();
  const names = useCasinoNameMap();

  return (
    <div className="space-y-6">
      {/* Cron health */}
      <div className="cms-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Scheduled Jobs (pg_cron)</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">auto-refresh 30s</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Job</th>
                <th className="text-left px-3 py-2">Schedule</th>
                <th className="text-left px-3 py-2">Last run</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Runtime</th>
                <th className="text-right px-3 py-2">Failures 24h</th>
                <th className="text-center px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {cron.map(j => {
                const failed = j.last_status === "failed";
                const stale = j.last_run_start && (Date.now() - new Date(j.last_run_start).getTime()) > 1000 * 60 * 60 * 25;
                return (
                  <tr key={j.jobname} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{j.jobname}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{j.schedule}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(j.last_run_start)}</td>
                    <td className="px-3 py-2">
                      {failed
                        ? <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="w-3 h-3" />failed</Badge>
                        : j.last_status === "succeeded"
                          ? <Badge variant="default" className="text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" />ok</Badge>
                          : <Badge variant="secondary" className="text-[10px]">{j.last_status ?? "—"}</Badge>}
                      {stale && <Badge variant="outline" className="text-[10px] ml-1 gap-1"><Clock className="w-3 h-3" />stale</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmtMs(j.last_runtime_ms)}</td>
                    <td className="px-3 py-2 text-right">
                      {j.total_failures_24h > 0
                        ? <span className="text-destructive font-semibold">{j.total_failures_24h}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {j.active
                        ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        : <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" />}
                    </td>
                  </tr>
                );
              })}
              {cron.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-sm text-muted-foreground">No cron jobs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync outbox */}
      <div className="cms-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Sync Outbox (last 7 days)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Casino</th>
                <th className="text-right px-3 py-2">Pending</th>
                <th className="text-left px-3 py-2">Oldest pending</th>
                <th className="text-right px-3 py-2">Failed</th>
              </tr>
            </thead>
            <tbody>
              {sync.map(s => {
                const stuck = s.oldest_pending_at && (Date.now() - new Date(s.oldest_pending_at).getTime()) > 1000 * 60 * 10;
                return (
                  <tr key={s.casino_id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{names.get(s.casino_id) ?? s.casino_id.slice(0, 8)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${stuck ? "text-warning font-semibold" : ""}`}>{s.pending_count}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {fmtTime(s.oldest_pending_at)}
                      {stuck && <Badge variant="outline" className="text-[10px] ml-2 gap-1"><AlertTriangle className="w-3 h-3" />stuck &gt;10m</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.failed_count > 0
                        ? <span className="text-destructive font-semibold">{s.failed_count}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                  </tr>
                );
              })}
              {sync.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-sm text-muted-foreground">No outbox activity</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update commands */}
      <div className="cms-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Rocket className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Recent Update Commands</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Casino</th>
                <th className="text-left px-3 py-2">Version</th>
                <th className="text-center px-3 py-2">Auto</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Issued</th>
                <th className="text-left px-3 py-2">Applied</th>
                <th className="text-left px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {cmds.map(c => {
                const variant = c.status === "applied" ? "default"
                  : c.status === "failed" ? "destructive"
                  : c.status === "acknowledged" ? "secondary"
                  : "outline";
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{names.get(c.casino_id) ?? c.casino_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.target_version}</td>
                    <td className="px-3 py-2 text-center text-xs">{c.auto_apply ? "✓" : "—"}</td>
                    <td className="px-3 py-2"><Badge variant={variant} className="text-[10px]">{c.status}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(c.issued_at)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(c.applied_at)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[280px]">{c.status_message ?? "—"}</td>
                  </tr>
                );
              })}
              {cmds.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-sm text-muted-foreground">No update commands queued</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
