/**
 * ApplyErrorsPanel — rows the sync engine couldn't apply (schema mismatch,
 * FK violations, etc.). Persisted in sync_apply_errors. Admins can mark as
 * resolved or retry by deleting from outbox.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format-date";

interface ApplyError {
  id: number;
  peer_name: string | null;
  source_outbox_id: number | null;
  table_name: string;
  op: string | null;
  pk: Record<string, unknown> | null;
  error_code: string;
  error_text: string | null;
  attempts: number;
  last_seen_at: string;
  resolved_at: string | null;
}

export const ApplyErrorsPanel = () => {
  const qc = useQueryClient();
  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["sync-apply-errors"],
    queryFn: async (): Promise<ApplyError[]> => {
      const { data, error } = await supabase
        .from("sync_apply_errors" as any)
        .select("*")
        .is("resolved_at", null)
        .order("last_seen_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ApplyError[];
    },
    refetchInterval: 10_000,
  });

  const resolve = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("sync_resolve_apply_error" as any, { p_id: id, p_resolution: "admin_resolve" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sync-apply-errors"] }); toast.success("Marked resolved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveAll = useMutation({
    mutationFn: async () => {
      const ids = rows.map(r => r.id);
      if (!ids.length) return 0;
      const { error } = await supabase.from("sync_apply_errors" as any)
        .update({ resolved_at: new Date().toISOString(), resolution: "bulk_resolve" } as any)
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["sync-apply-errors"] }); toast.success(`Resolved ${n}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Apply Errors</h3>
            <p className="text-xs text-muted-foreground">
              Rows the sync engine could not apply. Fix the schema mismatch / FK issue, then resolve.
            </p>
          </div>
        </div>
        {rows.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => resolveAll.mutate()} disabled={resolveAll.isPending || isFetching}>
            Resolve all {rows.length}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No unresolved errors.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase">
                <th className="text-left px-2 py-2 font-medium">Time</th>
                <th className="text-left px-2 py-2 font-medium">Peer</th>
                <th className="text-left px-2 py-2 font-medium">Table</th>
                <th className="text-left px-2 py-2 font-medium">Op</th>
                <th className="text-left px-2 py-2 font-medium">Code</th>
                <th className="text-left px-2 py-2 font-medium">Detail</th>
                <th className="text-right px-2 py-2 font-medium">Try</th>
                <th className="text-right px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.last_seen_at)}</td>
                  <td className="px-2 py-1.5">{r.peer_name ?? "—"}</td>
                  <td className="px-2 py-1.5">{r.table_name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.op}</td>
                  <td className="px-2 py-1.5"><Badge variant="destructive" className="text-[10px]">{r.error_code}</Badge></td>
                  <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[360px]" title={r.error_text ?? ""}>{r.error_text ?? ""}</td>
                  <td className="px-2 py-1.5 text-right">{r.attempts}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => resolve.mutate(r.id)} disabled={resolve.isPending}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
