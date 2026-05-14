/**
 * Inline editor for player Status (category) and Tags.
 *
 * Permissions:
 *  - Status: super_admin / manager / floor_manager / finance_manager
 *  - Floor tags: same as Status
 *  - CCTV tags: surveillance only (super_admin can also write)
 *
 * Tags are split into two layers (`floor` and `cctv`). Surveillance writes to
 * the `cctv` layer; other authorized roles write to the `floor` layer.
 */
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";
import { ALL_CATEGORIES, type PlayerCategory } from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { PLAYER_TAGS, splitTagsBySource } from "@/lib/player-tags";
import {
  useUpdatePlayerCategory,
  useTogglePlayerTag,
} from "@/hooks/use-player-profile";
import { cn } from "@/lib/utils";

interface Props {
  playerId: string;
  category: PlayerCategory;
  /** Raw player_tags rows (with `source`). */
  tagRows: Array<{ tag: string; source?: string | null }>;
  /** Render variant: "full" shows two editable rows + status select; "row" only the floor row inline. */
  variant?: "full" | "row";
}

const ROLE_FLOOR = ["super_admin", "manager", "floor_manager", "finance_manager"];
const ROLE_CCTV = ["super_admin", "surveillance"];

export const useTagPermissions = () => {
  const { roles = [] } = useAuth();
  const canFloor = roles.some((r) => ROLE_FLOOR.includes(r));
  const canCctv = roles.some((r) => ROLE_CCTV.includes(r));
  const canStatus = canFloor; // same set
  const isSurveillance = roles.includes("surveillance") && !roles.includes("super_admin");
  // Surveillance edits CCTV exclusively, even if listed as super_admin too they can do both.
  const defaultSource: "floor" | "cctv" = isSurveillance ? "cctv" : "floor";
  return { canFloor, canCctv, canStatus, defaultSource, isSurveillance };
};

const PlayerStatusTagsEditor = ({ playerId, category, tagRows, variant = "full" }: Props) => {
  const { canFloor, canCctv, canStatus } = useTagPermissions();
  const updateCategory = useUpdatePlayerCategory();
  const toggleTag = useTogglePlayerTag();

  const { floor, cctv } = useMemo(() => splitTagsBySource(tagRows), [tagRows]);
  const floorSet = useMemo(() => new Set(floor), [floor]);
  const cctvSet = useMemo(() => new Set(cctv), [cctv]);

  const renderTagRow = (label: string, source: "floor" | "cctv", active: Set<string>, canEdit: boolean) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono w-12 shrink-0">
        {label}
      </span>
      {canEdit ? (
        <TooltipProvider delayDuration={150}>
          <div className="flex gap-1 flex-wrap items-center">
            {PLAYER_TAGS.map((t) => {
              const isOn = active.has(t.key);
              return (
                <Tooltip key={t.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={isOn}
                      aria-label={t.hint}
                      disabled={toggleTag.isPending}
                      onClick={() =>
                        toggleTag.mutate({
                          player_id: playerId,
                          tag: t.key,
                          source,
                          enabled: !isOn,
                        })
                      }
                      className={cn(
                        "text-lg leading-none rounded-md border px-1.5 py-0.5 transition",
                        isOn
                          ? "border-primary/50 bg-primary/10 opacity-100"
                          : "border-border opacity-40 hover:opacity-90 hover:bg-muted",
                      )}
                    >
                      {t.emoji}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isOn ? `Remove · ${t.hint}` : `Add · ${t.hint}`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      ) : active.size > 0 ? (
        <FlagBadges tags={Array.from(active)} size="lg15" />
      ) : (
        <span className="text-xs text-muted-foreground/60">—</span>
      )}
    </div>
  );

  if (variant === "row") {
    // Compact one-row variant (used inside a tight header). Falls back to a
    // muted placeholder when nothing exists and the viewer cannot edit.
    return renderTagRow("Tags", "floor", floorSet, canFloor);
  }

  return (
    <div className="space-y-2">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono w-12 shrink-0">
          Status
        </span>
        {canStatus ? (
          <Select
            value={category}
            onValueChange={(v) =>
              updateCategory.mutate({ player_id: playerId, category: v as PlayerCategory })
            }
            disabled={updateCategory.isPending}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="text-xs capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs capitalize text-card-foreground">{category}</span>
        )}
      </div>

      {renderTagRow("Tags", "floor", floorSet, canFloor)}
      {renderTagRow("CCTV", "cctv", cctvSet, canCctv)}
    </div>
  );
};

export default PlayerStatusTagsEditor;
