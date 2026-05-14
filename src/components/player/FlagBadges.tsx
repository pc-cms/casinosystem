import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTagDef } from "@/lib/player-tags";
import { cn } from "@/lib/utils";

export type FlagBadgeSize = "sm" | "base" | "lg15" | "xl";

interface FlagBadgesProps {
  tags: string[];
  /** New size prop. Defaults to "base" (text-base ≈ 16px). */
  size?: FlagBadgeSize;
  /** Legacy boolean — true == "sm". Kept for back-compat. */
  compact?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<FlagBadgeSize, string> = {
  sm: "text-sm",
  base: "text-base",
  lg15: "text-[15px]",
  xl: "text-2xl",
};

const FlagBadges = ({ tags, size, compact = false, className }: FlagBadgesProps) => {
  if (tags.length === 0) return null;
  const resolved: FlagBadgeSize = size ?? (compact ? "sm" : "base");
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex gap-1 flex-wrap items-center", className)}>
        {tags.map(tag => {
          const def = getTagDef(tag);
          const label = def?.emoji ?? tag;
          const hint = def?.hint ?? tag;
          return (
            <Tooltip key={tag}>
              <TooltipTrigger asChild>
                <span
                  aria-label={hint}
                  className={cn(SIZE_CLASS[resolved], "leading-none cursor-default")}
                >
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{hint}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default FlagBadges;
