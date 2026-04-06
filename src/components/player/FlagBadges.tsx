import { Badge } from "@/components/ui/badge";

const FLAG_COLORS: Record<string, string> = {
  VIP: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
  "High Roller": "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
  Watchlist: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30",
  "Watch List": "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30",
  Aggressive: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
  Suspicious: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30",
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
