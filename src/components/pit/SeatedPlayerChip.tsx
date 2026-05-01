import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatNumberSpaces } from "@/lib/currency";
import type { PlayerCategory } from "@/components/player/CategoryBadge";

const CATEGORY_DOT: Record<PlayerCategory, string> = {
  diamond: "bg-blue-500",
  platinum: "bg-purple-500",
  gold: "bg-yellow-500",
  normal: "bg-muted-foreground/40",
};

export interface SeatedPlayer {
  id: string;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  category: PlayerCategory;
  avgBet: number;
  startedAt: Date | null;
  dropR: number;
  result: number;
}

interface Props {
  player: SeatedPlayer;
  draggable?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const formatTime = (d: Date | null) => {
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const initials = (p: SeatedPlayer) => {
  const f = p.first_name?.[0] ?? "";
  const l = p.last_name?.[0] ?? "";
  return `${f}${l}`.toUpperCase();
};

const SeatedPlayerChip = ({ player, draggable = false, compact = false, onClick }: Props) => {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/cms-player-id", player.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            draggable={draggable}
            onDragStart={draggable ? onDragStart : undefined}
            onClick={onClick}
            className={cn(
              "group flex items-center gap-1.5 rounded-md border border-border bg-background/60 hover:bg-muted/70 transition-colors text-left",
              compact ? "px-1.5 py-0.5" : "px-2 py-1",
              draggable && "cursor-grab active:cursor-grabbing"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", CATEGORY_DOT[player.category])} />
            <span className={cn("font-mono font-semibold text-card-foreground truncate", compact ? "text-[10px]" : "text-[11px]")}>
              {compact ? initials(player) : `${player.first_name} ${player.last_name[0] ?? ""}.`}
            </span>
            {player.avgBet > 0 && (
              <span className={cn("font-mono text-muted-foreground shrink-0", compact ? "text-[9px]" : "text-[10px]")}>
                {formatNumberSpaces(player.avgBet)}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold">
              {player.first_name} {player.last_name}
              {player.nickname && <span className="text-muted-foreground"> "{player.nickname}"</span>}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              Avg bet: {formatNumberSpaces(player.avgBet)} · Since {formatTime(player.startedAt)}
            </p>
            {player.dropR > 0 && (
              <p className="font-mono text-[10px] text-muted-foreground">
                Drop R: {formatNumberSpaces(player.dropR)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SeatedPlayerChip;
