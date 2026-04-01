import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, CheckCircle2, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const InCasino = () => {
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: visits = [] } = useQuery({
    queryKey: ["casino_visits", casinoId, today],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select("*, players(first_name, last_name, nickname, photo_url, status)")
        .eq("casino_id", casinoId)
        .eq("date", today)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    refetchInterval: 10000,
  });

  // Split: still in vs checked out (awaiting confirm or already confirmed)
  const stillIn = useMemo(() => visits.filter(v => !v.checked_out_at).sort((a, b) => {
    const pA = (a.players as any);
    const pB = (b.players as any);
    const nameA = `${pA?.first_name || ""} ${pA?.last_name || ""}`.toLowerCase();
    const nameB = `${pB?.first_name || ""} ${pB?.last_name || ""}`.toLowerCase();
    return nameA.localeCompare(nameB);
  }), [visits]);
  const checkedOut = useMemo(() => visits.filter(v => !!v.checked_out_at).sort((a, b) => {
    const pA = (a.players as any);
    const pB = (b.players as any);
    const nameA = `${pA?.first_name || ""} ${pA?.last_name || ""}`.toLowerCase();
    const nameB = `${pB?.first_name || ""} ${pB?.last_name || ""}`.toLowerCase();
    return nameA.localeCompare(nameB);
  }), [visits]);

  const confirmExit = useMutation({
    mutationFn: async (visitId: string) => {
      if (!casinoId) throw new Error("No casino");
      // We mark checked_out_at to confirm exit
      const visit = visits.find(v => v.id === visitId);
      if (!visit) throw new Error("Visit not found");
      if (visit.checked_out_at) {
        // Already checked out — this confirms removal (no extra action needed, 
        // they just disappear from the list on next day or we can filter)
        return;
      }
      const { error } = await supabase
        .from("casino_visits")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", visitId);
      if (error) throw error;
      await logAction(casinoId, "player", "PLAYER_EXIT_CONFIRMED", { visit_id: visitId, player_id: visit.player_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      toast.success("Exit confirmed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Guests</h1>
        <p className="text-sm text-muted-foreground">
          {stillIn.length} currently inside · {checkedOut.length} checked out today
        </p>
      </div>

      {/* Currently IN */}
      {stillIn.length === 0 && checkedOut.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No visitors today</div>
      ) : (
        <div className="space-y-4">
          {stillIn.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Currently Inside</h3>
              <div className="cms-panel divide-y divide-border">
                {stillIn.map(visit => {
                  const p = visit.players as any;
                  if (!p) return null;
                  return (
                    <div key={visit.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {p.photo_url ? (
                          <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.first_name} {p.last_name}
                          {p.nickname && <span className="text-muted-foreground ml-1">({p.nickname})</span>}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>In at {format(new Date(visit.checked_in_at), "HH:mm")}</span>
                          <span>· {formatDistanceToNow(new Date(visit.checked_in_at), { addSuffix: false })}</span>
                        </div>
                      </div>
                      <Badge className="bg-primary/15 text-primary border-primary/30 shrink-0 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {visit.position?.toUpperCase() || "HALL"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs shrink-0 gap-1"
                        onClick={() => confirmExit.mutate(visit.id)}
                        disabled={confirmExit.isPending}
                      >
                        <LogOut className="w-3 h-3" /> Check Out
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checked out today */}
          {checkedOut.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Checked Out</h3>
              <div className="cms-panel divide-y divide-border opacity-70">
                {checkedOut.map(visit => {
                  const p = visit.players as any;
                  if (!p) return null;
                  return (
                    <div key={visit.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {p.photo_url ? (
                          <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.first_name} {p.last_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>In: {format(new Date(visit.checked_in_at), "HH:mm")}</span>
                          <span>→ Out: {format(new Date(visit.checked_out_at!), "HH:mm")}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs gap-1">
                        <LogOut className="w-3 h-3" /> OUT
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InCasino;
