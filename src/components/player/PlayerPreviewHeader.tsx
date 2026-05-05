import { useNavigate } from "react-router-dom";
import { X, ExternalLink, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, usePlayerVisits } from "@/hooks/use-player-profile";
import { useSelectedPlayer } from "@/hooks/use-selected-player";
import CategoryBadge from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Props {
  playerId?: string | null;
  onClose?: () => void;
  className?: string;
}

/** This-month CASH IN (drop) and RESULT for one player. Player-format: result = (cashout) − (drop). */
const useThisMonthPlayerStats = (playerId: string | undefined | null) => {
  return useQuery({
    queryKey: ["player-month-stats", playerId, new Date().toISOString().slice(0, 7)],
    queryFn: async () => {
      if (!playerId) return { cashIn: 0, result: 0 };
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount")
        .eq("player_id", playerId)
        .gte("created_at", start)
        .in("type", ["buy", "in", "cashout", "out"]);
      if (error) throw error;
      let cashIn = 0, cashOut = 0;
      for (const t of (data || []) as any[]) {
        const a = Number(t.amount) || 0;
        if (t.type === "buy" || t.type === "in") cashIn += a;
        else cashOut += a;
      }
      return { cashIn, result: cashOut - cashIn };
    },
    enabled: !!playerId,
    staleTime: 30_000,
  });
};

export const PlayerPreviewHeader = ({ playerId: playerIdProp, onClose, className }: Props) => {
  const ctx = useSelectedPlayer();
  const playerId = playerIdProp !== undefined ? playerIdProp : ctx.playerId;
  const { data: player, isLoading } = usePlayer(playerId || undefined);
  const { data: visits = [] } = usePlayerVisits(playerId || undefined);
  const { data: monthStats } = useThisMonthPlayerStats(playerId);
  const nav = useNavigate();
  const { roles } = useAuth();
  const showFinancials = canSeePlayerFinancials(roles || []);

  if (!playerId) return null;

  const handleClose = () => {
    onClose ? onClose() : ctx.clear();
  };

  const isBlacklisted = player?.status === "blacklist";
  const tags = ((player as any)?.player_tags || []).map((t: any) => t.tag);
  const visitsCount = visits.length;
  const result = monthStats?.result ?? 0;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 mb-3 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3 shadow-sm",
        className
      )}
    >
      {isLoading || !player ? (
        <div className="flex items-center gap-3 h-14">
          <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={`${player.first_name} ${player.last_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold truncate">
                {player.first_name} {player.last_name}
                {player.nickname && (
                  <span className="ml-1 text-muted-foreground font-normal">
                    "{player.nickname}"
                  </span>
                )}
              </span>
              <CategoryBadge category={(player.category as any) || "normal"} />
              {isBlacklisted && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                  Blacklist
                </span>
              )}
              {tags.length > 0 && <FlagBadges tags={tags} compact />}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
              {player.id_number && (
                <span className="font-mono">ID: {player.id_number}</span>
              )}
              {player.phone && <span className="font-mono">{player.phone}</span>}
              <span className="font-mono">Visits: <span className="text-foreground font-semibold">{visitsCount}</span></span>
              {showFinancials && (
                <>
                  <span className="font-mono">
                    Cash In (mo): <span className="text-foreground font-semibold">{formatCurrency(monthStats?.cashIn ?? 0)}</span>
                  </span>
                  <span className="font-mono">
                    Result (mo):{" "}
                    <span className={cn("font-semibold", result > 0 ? "cms-amount-positive" : result < 0 ? "cms-amount-negative" : "text-foreground")}>
                      {result > 0 ? "+" : ""}{formatCurrency(result)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => nav(`/players/${player.id}`)}
              className="gap-1"
            >
              Open profile <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
