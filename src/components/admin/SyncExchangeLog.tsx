/**
 * SyncExchangeLog — Cloud-side audit of every data exchange with paired
 * local backup nodes. Populated by cms-sync via peer-mesh /log endpoint.
 *
 * Read access: super_admin, finance_manager (enforced via RLS).
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { fmtDateTime } from "@/lib/date-format";

type Direction = "pull" | "push" | "clone" | "heartbeat" | "handshake";
type Status = "ok" | "warn" | "error";

interface LogRow {
  id: number;
  peer_link_id: string | null;
  peer_name: string | null;
  direction: Direction;
  status: Status;
  table_name: string | null;
  row_count: number;
  batch_id: string | null;
  error_text: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const StatusPill = ({ s }: { s: Status }) => {
  const map: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
    ok: "secondary",
    warn: "outline",
    error: "destructive",
  };
  return <Badge variant={map[s]} className="text-[10px] uppercase">{s}</Badge>;
};

export const SyncExchangeLog = () => {
  const [direction, setDirection] = useState<"all" | Direction>("all");
  const [status, setStatus] = useState<"all" | Status>("all");

  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: ["sync-exchange-logs", direction, status],
    queryFn: async (): Promise<LogRow[]> => {
      let q = supabase
        .from("sync_exchange_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (direction !== "all") q = q.eq("direction", direction);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Exchange Log</h3>
          <p className="text-xs text-muted-foreground">
            Live record of every sync exchange with paired backup nodes — last 300 events, 30-day retention.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              <SelectItem value="pull">Pull</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="heartbeat">Heartbeat</SelectItem>
              <SelectItem value="handshake">Handshake</SelectItem>
              <SelectItem value="clone">Clone</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground uppercase">
              <th className="text-left px-2 py-2 font-medium">Time</th>
              <th className="text-left px-2 py-2 font-medium">Peer</th>
              <th className="text-left px-2 py-2 font-medium">Direction</th>
              <th className="text-left px-2 py-2 font-medium">Status</th>
              <th className="text-right px-2 py-2 font-medium">Rows</th>
              <th className="text-left px-2 py-2 font-medium">Cursor / Error</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => {
              const meta = (r.meta ?? {}) as Record<string, any>;
              const cursor = meta.cursor ?? meta.push_cursor ?? meta.pull_cursor ?? "";
              return (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                  <td className="px-2 py-1.5">{r.peer_name ?? "—"}</td>
                  <td className="px-2 py-1.5 uppercase text-[10px] text-muted-foreground">{r.direction}</td>
                  <td className="px-2 py-1.5"><StatusPill s={r.status} /></td>
                  <td className="px-2 py-1.5 text-right">{r.row_count || ""}</td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[420px]">
                    {r.error_text ? <span className="text-destructive">{r.error_text}</span> : (cursor !== "" ? `cur ${cursor}` : "")}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No exchange events yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
