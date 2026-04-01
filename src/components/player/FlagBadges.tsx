import { Badge } from "@/components/ui/badge";

const FLAG_COLORS: Record<string, string> = {
  VIP: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "High Roller": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Watchlist: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Watch List": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Aggressive: "bg-red-500/15 text-red-400 border-red-500/30",
  Suspicious: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface FlagBadgesProps {
  tags: string[];
  compact?: boolean;
}

const FlagBadges = ({ tags, compact = false }: FlagBadgesProps) => {
  if (tags.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {tags.map(tag => (
        <Badge
          key={tag}
          variant="outline"
          className={`${FLAG_COLORS[tag] || ""} ${compact ? "text-[8px] px-1 py-0" : "text-[9px] px-1.5 py-0"}`}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
};

export default FlagBadges;
