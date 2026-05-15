/**
 * NetworkHealthPanel — super_admin / finance_manager view of:
 *   - local servers status (online/offline, version, disk, containers)
 *   - cron job health
 *   - sync outbox depth per casino + per-table breakdown
 *   - sync inbox stats (incoming changes from local servers)
 *   - update_commands queue
 */
import {
  useCronHealth, useSyncOutboxHealth, useUpdateCommands,
  useLocalServersOverview, useSyncInboxHealth, useSyncOutboxPerTable,
} from "@/hooks/use-network-admin";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Rocket, AlertTriangle, CheckCircle2, Clock, Server, Inbox, HardDrive, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PendingServersPanel } from "./PendingServersPanel";

const fmtMs = (ms: number | null) => ms == null ? "—" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
const fmtTime = (ts: string | null) => ts ? new Date(ts).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtUptime = (s: number | null) => {
  if (s == null) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};
const fmtMinutes = (m: number | null) => {
  if (m == null) return "—";
  if (m < 1) return "<1m";
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(1)}h`;
};
const shortId = (id: string | null | undefined) => id ? id.slice(0, 8) : "—";
const casinoLabel = (names: Map<string, string>, casinoId: string | null | undefined) =>
  casinoId ? (names.get(casinoId) ?? shortId(casinoId)) : "—";

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
  const { data: servers = [] } = useLocalServersOverview();
  const { data: inbox = [] } = useSyncInboxHealth();
  const { data: outboxPerTable = [] } = useSyncOutboxPerTable();
  const names = useCasinoNameMap();

  return (
    <div className="space-y-6">
      <PendingServersPanel />

      {/* Local servers */}
      <div className="cms-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Local Servers</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">auto-refresh 30s</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Casino</th>
                <th className="text-left px-3 py-2">Server</th>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Version</th>
                <th className="text-right px-3 py-2">Uptime</th>
                <th className="text-center px-3 py-2">Containers</th>
                <th className="text-right px-3 py-2">Disk</th>
                <th className="text-left px-3 py-2">Last sync</th>
              </tr>
            </thead>
            <tbody>
              {servers.map(s => {
                const stale = (s.minutes_since_sync ?? 0) > 5;
                const containersOk = s.containers_running != null && s.containers_total != null && s.containers_running === s.containers_total;
                const diskWarn = (s.disk_used_pct ?? 0) > 85;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{casinoLabel(names, s.casino_id)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.server_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.server_ip ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {s.is_online
                        ? <Badge variant="default" className="text-[10px] gap-1"><Wifi className="w-3 h-3" />online</Badge>
                        : <Badge variant="destructive" className="text-[10px] gap-1"><WifiOff className="w-3 h-3" />offline</Badge>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{s.current_version ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{fmtUptime(s.uptime_seconds)}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {s.containers_running != null
                        ? <span className={containersOk ? "text-emerald-500" : "text-destructive font-semibold"}>{s.containers_running}/{s.containers_total}</span>
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {s.disk_used_pct != null
                        ? <span className={diskWarn ? "text-warning font-semibold" : "text-muted-foreground"}>{s.disk_used_pct.toFixed(0)}%</span>
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={stale ? "text-warning" : "text-muted-foreground"}>
                        {fmtMinutes(s.minutes_since_sync)} ago
                      </span>
                    </td>
                  </tr>
                );
              })}
              {servers.length === 0 && (
                <tr><td colSpan={9} className="text-center py-6 text-sm text-muted-foreground">No local servers linked yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync inbox (incoming from local servers) */}
      <div className="cms-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Sync Inbox — Incoming from Local (24h)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Casino</th>
                <th className="text-right px-3 py-2">Applied 24h</th>
                <th className="text-right px-3 py-2">Errors 24h</th>
                <th className="text-left px-3 py-2">Last applied</th>
                <th className="text-left px-3 py-2">Oldest error</th>
              </tr>
            </thead>
            <tbody>
              {inbox.map(i => (
                <tr key={i.casino_id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{casinoLabel(names, i.casino_id)}</td>
                  <td className="px-3 py-2 text-right font-mono">{i.total_24h}</td>
                  <td className="px-3 py-2 text-right">
                    {i.errors_24h > 0
                      ? <span className="text-destructive font-semibold">{i.errors_24h}</span>
                      : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(i.last_applied_at)}</td>
                  <td className="px-3 py-2 text-xs">
                    {i.oldest_error_at
                      ? <span className="text-destructive">{fmtTime(i.oldest_error_at)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {inbox.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-sm text-muted-foreground">No inbox activity in the last 24h</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outbox per table breakdown */}
      <div className="cms-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Outbox by Table — Pending Changes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Casino</th>
                <th className="text-left px-3 py-2">Table</th>
                <th className="text-right px-3 py-2">Pending</th>
                <th className="text-right px-3 py-2">Oldest (min)</th>
                <th className="text-left px-3 py-2">Since</th>
              </tr>
            </thead>
            <tbody>
              {outboxPerTable.map((t, idx) => {
                const stuck = (t.oldest_minutes ?? 0) > 10;
                return (
                  <tr key={`${t.casino_id}-${t.table_name}-${idx}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{casinoLabel(names, t.casino_id)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.table_name}</td>
                    <td className="px-3 py-2 text-right font-mono">{t.pending_count}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${stuck ? "text-warning font-semibold" : "text-muted-foreground"}`}>
                      {t.oldest_minutes != null ? Math.round(t.oldest_minutes) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(t.oldest_change_at)}</td>
                  </tr>
                );
              })}
              {outboxPerTable.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-sm text-muted-foreground">All tables in sync ✓</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    <td className="px-3 py-2 font-medium">{casinoLabel(names, s.casino_id)}</td>
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
                    <td className="px-3 py-2 font-medium">{casinoLabel(names, c.casino_id)}</td>
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
