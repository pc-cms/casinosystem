import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, User, ArrowDownToLine, ArrowUpFromLine, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, usePlayerVisits } from "@/hooks/use-player-profile";
import { useSelectedPlayer } from "@/hooks/use-selected-player";
import CategoryBadge from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { formatCurrency, formatNumberSpaces } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useCreatePlayerChipAdjustment } from "@/hooks/use-player-chip-adjustments";

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

/** Numeric input that displays "10 000" formatting and stores raw integer. */
const NumberInput = ({
  value, onChange, placeholder, ariaLabel,
}: { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel: string }) => {
  const display = value ? formatNumberSpaces(Number(value.replace(/\D/g, "")) || 0) : "";
  return (
    <Input
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        onChange(raw);
      }}
      className="font-mono text-lg font-bold tabular-nums text-right"
    />
  );
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
  const canAdjust = (roles || []).some((r) => r === "pit" || r === "manager");

  const [chipIn, setChipIn] = useState("");
  const [chipOut, setChipOut] = useState("");
  const [note, setNote] = useState("");
  const createAdj = useCreatePlayerChipAdjustment();

  if (!playerId) return null;

  const handleClose = () => { onClose ? onClose() : ctx.clear(); };

  const isBlacklisted = player?.status === "blacklist";
  const tags = ((player as any)?.player_tags || []).map((t: any) => t.tag);
  const visitsCount = visits.length;
  const result = monthStats?.result ?? 0;

  const submitAdj = () => {
    const inN = Number(chipIn) || 0;
    const outN = Number(chipOut) || 0;
    if (inN <= 0 && outN <= 0) return;
    createAdj.mutate(
      { player_id: playerId, chip_in: inN, chip_out: outN, note: note.trim() },
      { onSuccess: () => { setChipIn(""); setChipOut(""); setNote(""); } }
    );
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-4 shadow-sm",
        className
      )}
    >
      {isLoading || !player ? (
        <div className="flex items-center gap-4 h-32">
          <div className="h-32 w-32 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-56 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-5">
          {/* Photo — 2x larger */}
          <div className="h-32 w-32 rounded-2xl overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={`${player.first_name} ${player.last_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-14 w-14 text-muted-foreground" />
            )}
          </div>

          {/* Identity + financials */}
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold truncate">
                {player.first_name} {player.last_name}
                {player.nickname && (
                  <span className="ml-2 text-muted-foreground font-normal">"{player.nickname}"</span>
                )}
              </span>
              <CategoryBadge category={(player.category as any) || "normal"} />
              {isBlacklisted && (
                <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                  Blacklist
                </span>
              )}
              {tags.length > 0 && <FlagBadges tags={tags} compact />}
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground flex-wrap">
              {player.id_number && <span className="font-mono">ID: {player.id_number}</span>}
              {player.phone && <span className="font-mono">{player.phone}</span>}
              <span className="font-mono">Visits: <span className="text-foreground font-semibold">{visitsCount}</span></span>
              {showFinancials && (
                <>
                  <span className="font-mono">
                    Cash In (mo): <span className="text-foreground font-semibold">{formatCurrency(monthStats?.cashIn ?? 0)}</span>
                  </span>
                  <span className="font-mono text-base">
                    RESULT:{" "}
                    <span className={cn("font-bold text-xl", result > 0 ? "cms-amount-positive" : result < 0 ? "cms-amount-negative" : "text-foreground")}>
                      {result > 0 ? "+" : ""}{formatCurrency(result)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Chip IN/OUT inline form */}
          {canAdjust && (
            <div className="shrink-0 flex flex-col justify-center gap-2 min-w-[420px] border-l border-border pl-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <ArrowDownToLine className="w-4 h-4 text-success shrink-0" />
                  <NumberInput
                    ariaLabel="Chip IN"
                    placeholder="Chip IN (+)"
                    value={chipIn}
                    onChange={setChipIn}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUpFromLine className="w-4 h-4 text-destructive shrink-0" />
                  <NumberInput
                    ariaLabel="Chip OUT"
                    placeholder="Chip OUT (−)"
                    value={chipOut}
                    onChange={setChipOut}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Comment…"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => { if (e.key === "Enter") submitAdj(); }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={submitAdj}
                  disabled={createAdj.isPending || (!chipIn && !chipOut)}
                  className="gap-1"
                >
                  <Check className="w-4 h-4" /> OK
                </Button>
              </div>
            </div>
          )}

          {/* Right-side actions */}
          <div className="shrink-0 flex flex-col items-end justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              size="sm"
              onClick={() => nav(`/players/${player.id}`)}
              className="gap-1"
            >
              Open profile <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
