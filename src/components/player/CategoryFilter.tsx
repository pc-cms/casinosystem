import CategoryBadge, { ALL_CATEGORIES, type PlayerCategory } from "./CategoryBadge";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  selected: Set<PlayerCategory>;
  onChange: (next: Set<PlayerCategory>) => void;
}

const ACTIVE_TINT: Record<PlayerCategory, string> = {
  diamond: "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-500/40",
  platinum: "bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-500/40",
  gold: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 ring-1 ring-inset ring-yellow-500/40",
  normal: "bg-muted text-foreground ring-1 ring-inset ring-border",
};

const LABEL: Record<PlayerCategory, string> = {
  diamond: "D",
  platinum: "P",
  gold: "G",
  normal: "N",
};

const CategoryFilter = ({ selected, onChange }: CategoryFilterProps) => {
  const toggle = (cat: PlayerCategory) => {
    const next = new Set(selected);
    if (next.has(cat)) {
      if (next.size > 1) next.delete(cat);
    } else {
      next.add(cat);
    }
    onChange(next);
  };
  const allSelected = selected.size === ALL_CATEGORIES.length;

  return (
    <div className="flex items-center rounded-md border border-border overflow-hidden h-8">
      <button
        type="button"
        onClick={() => onChange(new Set(ALL_CATEGORIES))}
        className={cn(
          "px-2.5 h-full text-[11px] uppercase tracking-wide font-semibold transition-colors",
          allSelected ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"
        )}
      >
        All
      </button>
      {ALL_CATEGORIES.map((cat) => {
        const active = selected.has(cat);
        return (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            title={cat}
            className={cn(
              "px-2.5 h-full text-[11px] uppercase tracking-wide font-semibold transition-colors border-l border-border",
              active ? ACTIVE_TINT[cat] : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            {LABEL[cat]}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;
