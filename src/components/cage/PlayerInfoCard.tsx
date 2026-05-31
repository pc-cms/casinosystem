/**
 * PlayerInfoCard — large player display for cashier screen.
 * Shows: big photo, nickname, category badge, current table.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowDownToLine, ArrowUpFromLine, User } from "lucide-react";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { splitTagsBySource } from "@/lib/player-tags";
import { LazyImage } from "@/components/LazyImage";
import type { Tables } from "@/integrations/supabase/types";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { formatCurrency } from "@/lib/currency";

interface Props {
  player: Tables<"players"> | null;
  tables: Tables<"gaming_tables">[];
  /** Current-shift transactions, used to show this player's IN/OUT history inline. */
  shiftTransactions?: Tables<"transactions">[];
}

const isInTx = (t: string) => t === "buy" || t === "in";

const PlayerInfoCard = ({ player, tables, shiftTransactions = [] }: Props) => {
  const { casinoId } = useAuth();
  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const today = serverBusinessDate || getBusinessDate();
  const windowStartUTC = businessDayHourUTC(today, 7);

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

  // Tags (floor + cctv) for the inline rows under IN/OUT.
  const { data: tagRows = [] } = useQuery({
    queryKey: ["player-info-card-tags", player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data } = await supabase
        .from("player_tags")
        .select("tag, source")
        .eq("player_id", player.id);
      return (data || []) as Array<{ tag: string; source: string | null }>;
    },
    enabled: !!player,
    staleTime: 30_000,
  });
  const { floor: floorTags, cctv: cctvTags } = useMemo(() => splitTagsBySource(tagRows), [tagRows]);

  const tableName = useMemo(() => {
    if (!currentSession?.table_id) return null;
    return tables.find(t => t.id === currentSession.table_id)?.name || null;
  }, [currentSession, tables]);

  if (!player) return null;

  const isBlacklisted = player.status === "blacklist";

  const playerTxs = useMemo(
    () => shiftTransactions
      .filter(t => t.player_id === player.id)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [shiftTransactions, player.id],
  );
  const tableNameFor = (id: string | null) =>
    (id && tables.find(t => t.id === id)?.name) || "—";

  return (
    <div className={`cms-panel p-4 h-full flex flex-col items-center text-center ${isBlacklisted ? "border-destructive" : ""}`}>
      {/* Big photo */}
      <div className="w-40 h-40 rounded-lg overflow-hidden bg-muted flex items-center justify-center mb-3 ring-1 ring-border shrink-0">
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
      <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
        <CategoryBadge category={(player.category || "normal") as PlayerCategory} />
        {isBlacklisted && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive text-destructive-foreground">
            BLACKLIST
          </span>
        )}
      </div>

      {/* Current table */}
      <div className="mt-3 pt-3 border-t border-border w-full">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Current Table</p>
        <p className="font-mono text-base font-bold mt-1 text-card-foreground">
          {tableName || <span className="text-muted-foreground font-normal">Not seated</span>}
        </p>
      </div>

      {/* Player transactions for current shift (no result, just the log) */}
      <div className="mt-3 pt-3 border-t border-border w-full text-left flex-1 min-h-0 flex flex-col">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5 px-0.5">
          Shift Transactions ({playerTxs.length})
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1">
          {playerTxs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">No IN/OUT yet this shift.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {playerTxs.map(tx => {
                  const isIn = isInTx(tx.type);
                  return (
                    <tr key={tx.id} className="border-b border-border/40 last:border-0">
                      <td className="px-1 py-1 w-6">
                        {isIn ? (
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpFromLine className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </td>
                      <td className="px-1 py-1 text-[10px] font-mono text-muted-foreground">
                        {tableNameFor(tx.table_id)}
                      </td>
                      <td className={`px-1 py-1 text-right font-mono text-xs font-semibold ${isIn ? "cms-amount-positive" : "cms-amount-negative"}`}>
                        {isIn ? "+" : "−"}{formatCurrency(Number(tx.amount))}
                      </td>
                      <td className="px-1 py-1 text-right font-mono text-[10px] text-muted-foreground w-12">
                        {new Date(tx.created_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tags — two rows (floor + cctv), 25 px emojis. Wraps cleanly on narrow screens. */}
      <div className="mt-3 pt-3 border-t border-border w-full text-left space-y-1.5">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-mono w-10 shrink-0 pt-1">
            Tags
          </span>
          <div className="flex-1 min-w-0">
            {floorTags.length > 0
              ? <FlagBadges tags={floorTags} size="lg15" />
              : <span className="text-[11px] text-muted-foreground/60">—</span>}
          </div>
        </div>
        {cctvTags.length > 0 && (
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-mono w-10 shrink-0 pt-1">
              CCTV
            </span>
            <div className="flex-1 min-w-0">
              <FlagBadges tags={cctvTags} size="lg15" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerInfoCard;
