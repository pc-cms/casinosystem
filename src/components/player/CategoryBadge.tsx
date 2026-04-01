import { cn } from "@/lib/utils";

export type PlayerCategory = "diamond" | "platinum" | "gold" | "guest";

const CATEGORY_CONFIG: Record<PlayerCategory, { letter: string; label: string; classes: string }> = {
  diamond: { letter: "D", label: "Diamond", classes: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  platinum: { letter: "P", label: "Platinum", classes: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  gold: { letter: "G", label: "Gold", classes: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  guest: { letter: "G", label: "Guest", classes: "bg-muted text-muted-foreground border-border" },
};

export const CATEGORY_PRIORITY: Record<PlayerCategory, number> = {
  diamond: 0,
  platinum: 1,
  gold: 2,
  guest: 3,
};

export const ALL_CATEGORIES: PlayerCategory[] = ["diamond", "platinum", "gold", "guest"];

interface CategoryBadgeProps {
  category: PlayerCategory;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const CategoryBadge = ({ category, size = "sm", showLabel = false, className }: CategoryBadgeProps) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.guest;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-bold shrink-0",
        size === "sm" ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]",
        config.classes,
        className
      )}
      title={config.label}
    >
      {showLabel ? config.label : config.letter}
    </span>
  );
};

export default CategoryBadge;
