import { Button } from "@/components/ui/button";
import CategoryBadge, { ALL_CATEGORIES, type PlayerCategory } from "./CategoryBadge";

interface CategoryFilterProps {
  selected: Set<PlayerCategory>;
  onChange: (next: Set<PlayerCategory>) => void;
}

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
    <div className="flex items-center gap-1">
      <Button
        variant={allSelected ? "secondary" : "ghost"}
        size="sm"
        className="text-[10px] h-6 px-2"
        onClick={() => onChange(new Set(ALL_CATEGORIES))}
      >
        All
      </Button>
      {ALL_CATEGORIES.map(cat => (
        <button
          key={cat}
          onClick={() => toggle(cat)}
          className={`transition-opacity ${selected.has(cat) ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
        >
          <CategoryBadge category={cat} size="md" />
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
