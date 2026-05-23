/**
 * ActivePlayersList — compact list of currently active players for the cashier
 * to quickly select when no player is chosen.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Users, User } from "lucide-react";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import { LazyImage } from "@/components/LazyImage";
import type { Tables } from "@/integrations/supabase/types";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";

interface Props {
  players: Tables<"players">[];
  tables: Tables<"gaming_tables">[];
  onSelect: (playerId: string) => void;
}

const ActivePlayersList = ({ players, tables, onSelect }: Props) => {
  const { casinoId } = useAuth();
  
  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const today = serverBusinessDate || getBusinessDate();
  const windowStartUTC = businessDayHourUTC(today, 13);

  const { data: sessions = [] } = useQuery({
    queryKey: ["active-sessions-cage", casinoId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_sessions")
        .select("player_id, table_id, started_at")
        .eq("casino_id", casinoId!)
        .is("stopped_at", null)
        .gte("started_at", windowStartUTC)
        .order("started_at", { ascending: false });
      return data || [];
    },
    enabled: !!casinoId,
    refetchInterval: 30000,
  });

  const playerMap = new Map(players.map(p => [p.id, p]));
  const tableMap = new Map(tables.map(t => [t.id, t]));

  const activeRows = sessions
    .map(s => ({ session: s, player: playerMap.get(s.player_id) }))
    .filter(r => !!r.player);

  return (
    <div className="cms-panel h-full flex flex-col">
      <div className="cms-header flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        Active Players ({activeRows.length})
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border min-h-0">
        {activeRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No checked-in players. Reception must check the player in first.
          </div>
        ) : (
          activeRows.map(({ session, player }) => {
            const table = session.table_id ? tableMap.get(session.table_id) : null;
            return (
              <button
                key={session.player_id + session.started_at}
                onClick={() => onSelect(player!.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
                  {player!.photo_url ? (
                    <LazyImage src={player!.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-card-foreground truncate">
                      {player!.first_name} {player!.last_name}
                    </span>
                    <CategoryBadge category={(player!.category || "normal") as PlayerCategory} />
                  </div>
                  {player!.nickname && (
                    <p className="text-[10px] text-muted-foreground truncate">"{player!.nickname}"</p>
                  )}
                </div>
                {table && (
                  <span className="font-mono text-xs font-bold text-primary shrink-0">
                    {table.name}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
      
    </div>
  );
};

export default ActivePlayersList;
