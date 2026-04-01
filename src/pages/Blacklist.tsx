import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { User, Ban, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const Blacklist = () => {
  const { casinoId } = useAuth();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{ player: any; action: "blacklist" | "reactivate" } | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ["players", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("casino_id", casinoId)
        .order("last_name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });

  const blacklisted = useMemo(
    () => players.filter(p => p.status === "blacklist"),
    [players]
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "blacklist" }) => {
      const { error } = await supabase.from("players").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Player status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Blacklist</h1>
        <p className="text-sm text-muted-foreground">{blacklisted.length} blacklisted players</p>
      </div>

      {blacklisted.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No blacklisted players</div>
      ) : (
        <div className="cms-panel divide-y divide-border">
          {blacklisted.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center overflow-hidden shrink-0">
                {p.photo_url ? (
                  <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <Ban className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-muted-foreground">{p.nickname || "—"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setPendingAction({ player: p, action: "reactivate" })}
              >
                Reactivate
              </Button>
            </div>
          ))}
        </div>
      )}

      <ManagerOverrideDialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) {
            updateStatus.mutate({
              id: pendingAction.player.id,
              status: pendingAction.action === "blacklist" ? "blacklist" : "active",
            });
          }
          setPendingAction(null);
        }}
        title={pendingAction?.action === "blacklist" ? "Blacklist Player" : "Reactivate Player"}
        description="Manager authentication required to change blacklist status."
        actionType="CHANGE_PLAYER_STATUS"
        actionDetails={{
          player_id: pendingAction?.player?.id,
          player_name: pendingAction ? `${pendingAction.player.first_name} ${pendingAction.player.last_name}` : "",
          new_status: pendingAction?.action === "blacklist" ? "blacklist" : "active",
        }}
      />
    </div>
  );
};

export default Blacklist;
