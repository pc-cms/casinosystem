/**
 * RecentExchangeActivity — compact 10-row sync activity preview for the
 * Admin → Peers tab. Click "View all" to open the dedicated /admin/sync-log
 * page with filters and pagination.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity } from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";

type Direction = "pull" | "push" | "clone" | "heartbeat" | "handshake";
type Status = "ok" | "warn" | "error";

interface LogRow {
  id: number;
  peer_name: string | null;
  direction: Direction;
  status: Status;
  row_count: number;
  error_text: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const PREVIEW_LIMIT = 12;

export const RecentExchangeActivity = () => {
  const { data: rows = [] } = useQuery({
    queryKey: ["sync-exchange-logs-preview"],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("sync_exchange_logs" as any)
        .select("id, peer_name, direction, status, row_count, error_text, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(PREVIEW_LIMIT);
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Recent Sync Activity</h3>
            <p className="text-xs text-muted-foreground">Last {PREVIEW_LIMIT} events. Full log in dedicated view.</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/sync-log" className="gap-1.5">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>

      <table className="w-full text-xs">
        <tbody className="font-mono">
          {rows.map(r => {
            const meta = (r.meta ?? {}) as Record<string, any>;
            const cursor = meta.cursor ?? meta.push_cursor ?? meta.pull_cursor ?? "";
            return (
              <tr key={r.id} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap w-[140px]">
                  {fmtDateTime(r.created_at)}
                </td>
                <td className="px-2 py-1 truncate max-w-[160px]">{r.peer_name ?? "—"}</td>
                <td className="px-2 py-1 uppercase text-[10px] text-muted-foreground w-[80px]">{r.direction}</td>
                <td className="px-2 py-1 w-[60px]">
                  <Badge
                    variant={r.status === "ok" ? "secondary" : r.status === "warn" ? "outline" : "destructive"}
                    className="text-[9px] uppercase"
                  >{r.status}</Badge>
                </td>
                <td className="px-2 py-1 text-right w-[50px]">{r.row_count || ""}</td>
                <td className="px-2 py-1 text-muted-foreground truncate">
                  {r.error_text
                    ? <span className="text-destructive">{r.error_text}</span>
                    : (cursor !== "" ? `cur ${cursor}` : "")}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No exchange events yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
