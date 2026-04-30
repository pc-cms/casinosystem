import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTagDef } from "@/lib/player-tags";

interface FlagBadgesProps {
  tags: string[];
  compact?: boolean;
}

const FlagBadges = ({ tags, compact = false }: FlagBadgesProps) => {
  if (tags.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex gap-1 flex-wrap items-center">
        {tags.map(tag => {
          const def = getTagDef(tag);
          const label = def?.emoji ?? tag;
          const hint = def?.hint ?? tag;
          return (
            <Tooltip key={tag}>
              <TooltipTrigger asChild>
                <span
                  aria-label={hint}
                  className={`${compact ? "text-sm" : "text-base"} leading-none cursor-default`}
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

