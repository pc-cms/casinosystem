/**
 * ServersPanel — Primary / Replica role management within a single casino.
 * Shows every casino_server row, lets super_admin Promote a Replica to Primary
 * (RPC enforces uniqueness — only one Primary per casino).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Server, Crown } from "lucide-react";
import { toast } from "sonner";
import { useCasino } from "@/lib/casino-context";

interface ServerRow {
  id: string;
  casino_id: string;
  node_id: string | null;
  display_name: string | null;
  local_url: string | null;
  role: "primary" | "replica";
}

export const ServersPanel = () => {
  const { activeCasinoId } = useCasino();
  const qc = useQueryClient();

  const { data: servers = [] } = useQuery({
    queryKey: ["casino-servers", activeCasinoId],
    queryFn: async (): Promise<ServerRow[]> => {
      let q = supabase.from("casino_servers" as any).select("*").order("role", { ascending: true });
      if (activeCasinoId) q = q.eq("casino_id", activeCasinoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ServerRow[];
    },
    enabled: !!activeCasinoId,
  });

  const promote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("sync_promote_server" as any, { p_server_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["casino-servers"] }); toast.success("Promoted to Primary"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="cms-panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Server className="w-4 h-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Servers (Primary / Replica)</h3>
          <p className="text-xs text-muted-foreground">
            Exactly one Primary per casino. All clients (cashier, pit, reception) write to the Primary.
            Replicas mirror in both directions. Promote a Replica only when the Primary is offline.
          </p>
        </div>
      </div>

      {servers.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No servers registered yet. On the Ubuntu box, run:<br />
          <span className="font-mono">curl -fsSL https://casinosystem.app/cms | sudo bash</span><br />
          then choose <span className="font-mono">Install → Cloud-connected</span>.
        </p>
      ) : (
        <div className="space-y-2">
          {servers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded border border-border">
              <div className="flex items-center gap-3 min-w-0">
                {s.role === "primary"
                  ? <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  : <Server className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{s.display_name || "Unnamed server"}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{s.local_url || s.node_id || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={s.role === "primary" ? "default" : "secondary"} className="text-[10px] uppercase">
                  {s.role}
                </Badge>
                {s.role === "replica" && (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => {
                      const typed = window.prompt(
                        `Promote "${s.display_name}" to PRIMARY?\n\n` +
                        `All clients will switch writes to this server.\n` +
                        `Only do this when mirror_status = ok and the current Primary is offline or being decommissioned.\n\n` +
                        `Type PROMOTE (uppercase) to confirm:`
                      );
                      if (typed !== "PROMOTE") return;
                      promote.mutate(s.id);
                    }}
                    disabled={promote.isPending}
                  >
                    Promote to Primary
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
