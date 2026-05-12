/**
 * UserPermissionsDialog — per-user editor for the access matrix:
 *   (module × view × write × day_horizon).
 *
 * Each row shows the **role default** (badge) and three optional overrides.
 * If no override is set → row inherits role default.
 * Overrides are saved into `user_module_permissions` (NULL = inherit).
 */
import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MODULES, MODULE_GROUPS } from "@/lib/modules";
import {
  useUserEffectivePerms,
  useUserModuleOverrides,
  useSetUserModuleOverrides,
  type DayHorizon,
  type OverrideRow,
} from "@/hooks/use-module-permissions";
import { Save, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
}

const HORIZON_OPTIONS: DayHorizon[] = ["today", "7d", "30d", "all"];
const HORIZON_LABEL: Record<DayHorizon, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  all: "All",
};

interface Draft {
  // null = inherit role default; value = override
  can_view: boolean | null;
  can_write: boolean | null;
  day_horizon: DayHorizon | null;
}

export const UserPermissionsDialog = ({ open, onOpenChange, userId, userName }: Props) => {
  const { data: effective } = useUserEffectivePerms(userId);
  const { data: overrides } = useUserModuleOverrides(userId);
  const setPerms = useSetUserModuleOverrides();

  // Map: module_key → effective baseline (role merge)
  const baseline = useMemo(() => {
    const m = new Map<string, { can_view: boolean; can_write: boolean; day_horizon: DayHorizon }>();
    (effective ?? []).forEach(r => {
      const ov = (overrides ?? []).find(o => o.module_key === r.module_key);
      // baseline = effective minus any override (best-effort: if no override, effective IS baseline)
      if (!ov) {
        m.set(r.module_key, { can_view: r.can_view, can_write: r.can_write, day_horizon: r.day_horizon });
      } else {
        // For simplicity, baseline shown when override exists is same effective value
        // (the override field that's NULL inherits, others are explicit). We mark
        // explicit overrides via the drafts map — baseline tooltip purely informational.
        m.set(r.module_key, { can_view: r.can_view, can_write: r.can_write, day_horizon: r.day_horizon });
      }
    });
    return m;
  }, [effective, overrides]);

  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());

  useEffect(() => {
    if (!overrides) return;
    const next = new Map<string, Draft>();
    overrides.forEach(o => {
      next.set(o.module_key, {
        can_view: o.can_view,
        can_write: o.can_write,
        day_horizon: o.day_horizon,
      });
    });
    setDrafts(next);
  }, [overrides, open]);

  const grouped = useMemo(() => MODULE_GROUPS.map(g => ({
    group: g,
    items: MODULES.filter(m => m.group === g),
  })), []);

  const getDraft = (key: string): Draft =>
    drafts.get(key) ?? { can_view: null, can_write: null, day_horizon: null };

  const setDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts(prev => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { can_view: null, can_write: null, day_horizon: null };
      next.set(key, { ...cur, ...patch });
      return next;
    });
  };

  const clearOverride = (key: string) => {
    setDrafts(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const resetAll = () => setDrafts(new Map());

  const handleSave = async () => {
    if (!userId) return;
    const rows: OverrideRow[] = [];
    drafts.forEach((d, module_key) => {
      // Only persist rows that have at least one explicit value
      if (d.can_view === null && d.can_write === null && d.day_horizon === null) return;
      rows.push({
        module_key,
        can_view: d.can_view,
        can_write: d.can_write,
        day_horizon: d.day_horizon,
      });
    });
    await setPerms.mutateAsync({ userId, rows });
    onOpenChange(false);
  };

  const overrideCount = useMemo(() => {
    let n = 0;
    drafts.forEach(d => {
      if (d.can_view !== null || d.can_write !== null || d.day_horizon !== null) n++;
    });
    return n;
  }, [drafts]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Module Permissions — ${userName}`}
      description="Each module shows the role default. Override View, Write or Day depth per user. Empty override = inherit role default."
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reset all to role defaults
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {overrideCount === 0 ? "All modules inherit role defaults" : `${overrideCount} override(s) pending`}
          </span>
        </div>

        <div className="border-b border-border pb-2 hidden md:grid grid-cols-[1fr_64px_64px_120px_64px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          <span>Module</span>
          <span className="text-center">View</span>
          <span className="text-center">Write</span>
          <span className="text-center">Day depth</span>
          <span className="text-center">Reset</span>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{group}</p>
              <div className="space-y-1">
                {items.map(m => {
                  const base = baseline.get(m.key);
                  const draft = getDraft(m.key);
                  const hasOverride =
                    draft.can_view !== null || draft.can_write !== null || draft.day_horizon !== null;
                  const effView = draft.can_view ?? base?.can_view ?? false;
                  const effWrite = draft.can_write ?? base?.can_write ?? false;
                  const effHorizon = draft.day_horizon ?? base?.day_horizon ?? "today";

                  return (
                    <div
                      key={m.key}
                      className="grid grid-cols-[1fr_64px_64px_120px_64px] items-center gap-2 px-1 py-1 rounded hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm truncate">{m.label}</span>
                        {!hasOverride && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">default</Badge>
                        )}
                        {hasOverride && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">override</Badge>
                        )}
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={effView}
                          onCheckedChange={v => setDraft(m.key, { can_view: !!v })}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={effWrite}
                          disabled={!effView}
                          onCheckedChange={v => setDraft(m.key, { can_write: !!v })}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Select
                          value={effHorizon}
                          onValueChange={(v: DayHorizon) => setDraft(m.key, { day_horizon: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue>{HORIZON_LABEL[effHorizon]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {HORIZON_OPTIONS.map(o => (
                              <SelectItem key={o} value={o} className="text-xs">{HORIZON_LABEL[o]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1"
                          disabled={!hasOverride}
                          onClick={() => clearOverride(m.key)}
                          title="Reset to role default"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
          Financial visibility (player drop / cashout / lifetime totals) is locked by role and is not editable here.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={setPerms.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
};
