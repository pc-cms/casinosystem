/**
 * PlayerInfoCard — large player display for cashier screen.
 * Shows: big photo, nickname, category badge, current table.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { User } from "lucide-react";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import { LazyImage } from "@/components/LazyImage";
import type { Tables } from "@/integrations/supabase/types";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";

interface Props {
  player: Tables<"players"> | null;
  tables: Tables<"gaming_tables">[];
}

const PlayerInfoCard = ({ player, tables }: Props) => {
  const { casinoId } = useAuth();
  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const today = serverBusinessDate || getBusinessDate();
  const windowStartUTC = businessDayHourUTC(today, 13);

  const { data: currentSession } = useQuery({
    queryKey: ["player-current-session", player?.id, today],
    queryFn: async () => {
      if (!player) return null;
      const { data } = await supabase
        .from("client_sessions")
        .select("table_id")
        .eq("casino_id", casinoId!)
        .eq("player_id", player.id)
        .is("stopped_at", null)
        .gte("started_at", windowStartUTC)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!player && !!casinoId,
    staleTime: 1000 * 30,
  });

  const tableName = useMemo(() => {
    if (!currentSession?.table_id) return null;
    return tables.find(t => t.id === currentSession.table_id)?.name || null;
  }, [currentSession, tables]);

  if (!player) return null;

  const isBlacklisted = player.status === "blacklist";

  return (
    <div className={`cms-panel p-4 h-full flex flex-col items-center text-center ${isBlacklisted ? "border-destructive" : ""}`}>
      {/* Big photo */}
      <div className="w-48 h-48 rounded-lg overflow-hidden bg-muted flex items-center justify-center mb-3 ring-1 ring-border">
        {player.photo_url ? (
          <LazyImage src={player.photo_url} alt={`${player.first_name} ${player.last_name}`} className="w-full h-full object-cover" />
        ) : (
          <User className="w-20 h-20 text-muted-foreground" />
        )}
      </div>

      {/* Name + nickname */}
      <h3 className="text-lg font-semibold text-card-foreground leading-tight">
        {player.first_name} {player.last_name}
      </h3>
      {player.nickname && (
        <p className="text-sm text-muted-foreground italic mt-0.5">"{player.nickname}"</p>
      )}

      {/* Badges row */}
      <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
        <CategoryBadge category={(player.category || "normal") as PlayerCategory} />
        {isBlacklisted && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive text-destructive-foreground">
            BLACKLIST
          </span>
        )}
      </div>

      {/* Current table */}
      <div className="mt-4 pt-3 border-t border-border w-full">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Current Table</p>
        <p className="font-mono text-base font-bold mt-1 text-card-foreground">
          {tableName || <span className="text-muted-foreground font-normal">Not seated</span>}
        </p>
      </div>
    </div>
  );
};

export default PlayerInfoCard;
