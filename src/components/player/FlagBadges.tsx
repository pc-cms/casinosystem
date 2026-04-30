import { Badge } from "@/components/ui/badge";
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
      <div className="flex gap-1 flex-wrap">
        {tags.map(tag => {
          const def = getTagDef(tag);
          const label = def?.emoji ?? tag;
          const hint = def?.hint ?? tag;
          return (
            <Tooltip key={tag}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`${def?.className ?? ""} ${compact ? "text-[10px] px-1 py-0 leading-none" : "text-xs px-1.5 py-0 leading-none"} cursor-default`}
                >
                  <span aria-label={hint}>{label}</span>
                </Badge>
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
