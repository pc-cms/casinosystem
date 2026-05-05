import { useNavigate } from "react-router-dom";
import { X, ExternalLink, User } from "lucide-react";
import { usePlayer } from "@/hooks/use-player-profile";
import { useSelectedPlayer } from "@/hooks/use-selected-player";
import CategoryBadge from "@/components/player/CategoryBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { cn } from "@/lib/utils";

/**
 * PlayerPreviewHeader — Sticky preview shown above any list of players.
 *
 * Pattern: rather than open a modal on row click, lists call
 * `useSelectedPlayer().select(id)` and this header reflects the choice.
 * "Open profile" navigates to the full /players/:id page.
 *
 * Render once at the top of a list page. Hides itself when nothing is selected.
 */

interface Props {
  /** Optional override (e.g. on a screen that owns its own selection state). */
  playerId?: string | null;
  onClose?: () => void;
  className?: string;
}

export const PlayerPreviewHeader = ({ playerId: playerIdProp, onClose, className }: Props) => {
  const ctx = useSelectedPlayer();
  const playerId = playerIdProp !== undefined ? playerIdProp : ctx.playerId;
  const { data: player, isLoading } = usePlayer(playerId || undefined);
  const nav = useNavigate();
  const { roles } = useAuth();
  const showFinancials = canSeePlayerFinancials(roles || []);

  if (!playerId) return null;

  const handleClose = () => {
    onClose ? onClose() : ctx.clear();
  };

  const isBlacklisted = player?.status === "blacklist";

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
          {/* Photo */}
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

          {/* Identity + meta */}
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
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              {player.id_number && (
                <span className="font-mono">ID: {player.id_number}</span>
              )}
              {player.phone && <span className="font-mono">{player.phone}</span>}
              {showFinancials && (
                <span className="text-muted-foreground/70">
                  Open profile for full statistics
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
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
