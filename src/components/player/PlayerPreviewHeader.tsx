import { useState, useEffect, useRef } from "react";
import PlayerPhotoLightbox from "@/components/player/PlayerPhotoLightbox";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, User, ArrowDownToLine, ArrowUpFromLine, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, usePlayerVisits, usePlayerNotes } from "@/hooks/use-player-profile";
import { useSelectedPlayer } from "@/hooks/use-selected-player";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { businessDayHourUTC } from "@/lib/business-day";
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

/** Today's (current business day) CASH IN (drop) and RESULT for one player.
 *  Player-format: result = (cashout) − (drop). */
const useTodayPlayerStats = (playerId: string | undefined | null, businessDate: string | undefined) => {
  return useQuery({
    queryKey: ["player-day-stats", playerId, businessDate],
    queryFn: async () => {
      if (!playerId || !businessDate) return { cashIn: 0, result: 0 };
      const start = businessDayHourUTC(businessDate, 13);
      const end = businessDayHourUTC(businessDate, 13 + 24);
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount")
        .eq("player_id", playerId)
        .gte("created_at", start)
        .lt("created_at", end)
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
    enabled: !!playerId && !!businessDate,
    staleTime: 30_000,
  });
};

/** Numeric input that displays "10 000" formatting and stores raw integer. */
const NumberInput = ({
  value, onChange, placeholder, ariaLabel, className,
}: { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel: string; className?: string }) => {
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
      className={cn("font-mono text-xl font-bold tabular-nums text-right h-12", className)}
    />
  );
};

const LEVEL_TINT: Record<string, string> = {
  diamond: "bg-blue-100 dark:bg-[hsl(220_50%_18%)] border-blue-200 dark:border-blue-500/40",
  platinum: "bg-purple-100 dark:bg-[hsl(270_40%_18%)] border-purple-200 dark:border-purple-500/40",
  gold: "bg-yellow-100 dark:bg-[hsl(45_50%_18%)] border-yellow-200 dark:border-yellow-500/40",
  normal: "bg-card border-border",
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
  const [photoOpen, setPhotoOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Expose header height as CSS var so downstream sticky elements (table headers,
  // totals row) can offset themselves and stay visible while scrolling.
  useEffect(() => {
    if (!playerId) {
      document.documentElement.style.setProperty("--ppheader-h", "0px");
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty("--ppheader-h", `${el.offsetHeight}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--ppheader-h", "0px");
    };
  }, [playerId]);

  const isBlacklisted = player?.status === "blacklist";
  const { data: notes = [] } = usePlayerNotes(playerId || undefined, isBlacklisted);

  if (!playerId) return null;

  const handleClose = () => { onClose ? onClose() : ctx.clear(); };

  const blacklistReason = isBlacklisted
    ? (notes.find((n: any) => n.note_type === "blacklist")?.content || "").replace(/^Added to blacklist\.\s*Reason:\s*/i, "")
    : "";
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

  const tint = LEVEL_TINT[(player?.category as string) || "normal"] ?? LEVEL_TINT.normal;

  return (
    <div
      ref={rootRef}
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-4 border-b border-border px-4 py-4 shadow-sm",
        tint,
        className
      )}
    >
      {isLoading || !player ? (
        <div className="flex items-center gap-4 h-32">
          <div className="h-32 w-32 rounded-2xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-56 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-5">
          {/* Photo — click opens lightbox */}
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="View photo"
            className="h-32 w-32 rounded-2xl overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition"
          >
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={`${player.first_name} ${player.last_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-14 w-14 text-muted-foreground" />
            )}
          </button>

          {/* Visits + Open Profile (left of identity, with divider) */}
          <div className="shrink-0 flex flex-col justify-center items-center gap-2 pr-5 border-r border-border self-stretch">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">Visits</span>
            <span className="text-foreground font-bold text-3xl tabular-nums leading-none">{visitsCount}</span>
            <Button
              size="sm"
              onClick={() => nav(`/players/${player.id}`)}
              className="gap-1 mt-1"
            >
              Profile <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Identity block: Name+Nick / Cash In + Result / Tags */}
          <div className="min-w-0 flex-1 flex flex-col justify-between gap-1.5 py-0.5">
            {/* Row 1 — Name + Nick + Category */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <CategoryBadge category={(player.category as any) || "normal"} size="md" />
              <span className="text-2xl font-bold truncate">
                {player.first_name} {player.last_name}
              </span>
              {player.nickname && (
                <span className="text-xl text-muted-foreground font-normal truncate">"{player.nickname}"</span>
              )}
              {isBlacklisted && (
                <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                  Blacklist
                </span>
              )}
              {isBlacklisted && blacklistReason && (
                <span className="text-xs text-destructive truncate max-w-[520px]" title={blacklistReason}>
                  — {blacklistReason}
                </span>
              )}
            </div>

            {/* Row 2 — Cash In (m) / Result (m) */}
            {showFinancials && (
              <div className="flex items-baseline gap-6 font-mono">
                <span className="text-sm text-muted-foreground">
                  Cash In (m):{" "}
                  <span className="text-foreground font-bold text-lg">{formatCurrency(monthStats?.cashIn ?? 0)}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  Result (m):{" "}
                  <span className={cn("font-bold text-lg", result > 0 ? "cms-amount-positive" : result < 0 ? "cms-amount-negative" : "text-foreground")}>
                    {result > 0 ? "+" : ""}{formatCurrency(result)}
                  </span>
                </span>
              </div>
            )}

            {/* Row 3 — Tags (big emojis) */}
            <div className="min-h-[28px] flex items-center">
              {tags.length > 0 ? (
                <div className="flex gap-2 flex-wrap items-center text-2xl leading-none">
                  <FlagBadges tags={tags} />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/60">No tags</span>
              )}
            </div>
          </div>


          {/* Chip IN/OUT — bigger, centered */}
          {canAdjust && (
            <div className="shrink-0 flex flex-col justify-center gap-2.5 w-[460px] border-l border-border pl-5 self-stretch">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <ArrowDownToLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-success pointer-events-none" />
                  <NumberInput
                    ariaLabel="Chip IN"
                    placeholder="Chip IN (+)"
                    value={chipIn}
                    onChange={setChipIn}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <ArrowUpFromLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive pointer-events-none" />
                  <NumberInput
                    ariaLabel="Chip OUT"
                    placeholder="Chip OUT (−)"
                    value={chipOut}
                    onChange={setChipOut}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Comment…"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => { if (e.key === "Enter") submitAdj(); }}
                  className="flex-1 h-10"
                />
                <Button
                  onClick={submitAdj}
                  disabled={createAdj.isPending || (!chipIn && !chipOut)}
                  className="gap-1 h-10 px-5"
                >
                  <Check className="w-4 h-4" /> OK
                </Button>
              </div>
            </div>
          )}

          {/* Right-side: Close button only */}
          <div className="shrink-0 flex flex-col items-end justify-start py-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      <PlayerPhotoLightbox
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        src={player?.photo_url}
        alt={player ? `${player.first_name} ${player.last_name}` : undefined}
      />
    </div>
  );
};

