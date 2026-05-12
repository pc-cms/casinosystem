/**
 * UserPermissionsDialog — per-user editor showing role baseline alongside
 * effective values. Override-rows that match the role default are auto-cleaned
 * on Save (so the user_module_permissions table stays minimal).
 */
import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODULES } from "@/lib/modules";
import {
  useUserModuleOverrides,
  useSetUserModuleOverrides,
  useRoleModuleDefaults,
  type DayHorizon,
  type OverrideRow,
} from "@/hooks/use-module-permissions";
import { PermissionMatrix } from "./PermissionMatrix";
import { Save, RotateCcw } from "lucide-react";
import { getPrimaryRole, getPrimaryRoleLabel } from "@/lib/role-access";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  /** All roles assigned to this user. Used to pick primary baseline. */
  userRoles?: string[];
}

interface Draft {
  can_view: boolean;
  can_write: boolean;
  day_horizon: DayHorizon;
}

export const UserPermissionsDialog = ({ open, onOpenChange, userId, userName, userRoles = [] }: Props) => {
  const primaryRole = getPrimaryRole(userRoles);
  const { data: roleDefaults } = useRoleModuleDefaults(primaryRole);
  const { data: overrides } = useUserModuleOverrides(userId);
  const setPerms = useSetUserModuleOverrides();

  // Map module_key -> baseline from role
  const baselineMap = useMemo(() => {
    const m = new Map<string, Draft>();
    (roleDefaults ?? []).forEach(r => {
      m.set(r.module_key, {
        can_view: r.can_view,
        can_write: r.can_write,
        day_horizon: r.day_horizon,
      });
    });
    return m;
  }, [roleDefaults]);

  const fallbackBaseline: Draft = { can_view: false, can_write: false, day_horizon: "today" };
  const getBaseline = (key: string): Draft => baselineMap.get(key) ?? fallbackBaseline;

  // Drafts hold the *effective* row per module (not just override deltas).
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());

  useEffect(() => {
    if (!overrides || !roleDefaults) return;
    const next = new Map<string, Draft>();
    MODULES.forEach(m => {
      const base = baselineMap.get(m.key) ?? fallbackBaseline;
      const ov = overrides.find(o => o.module_key === m.key);
      next.set(m.key, {
        can_view: ov?.can_view ?? base.can_view,
        can_write: ov?.can_write ?? base.can_write,
        day_horizon: ov?.day_horizon ?? base.day_horizon,
      });
    });
    setDrafts(next);
  }, [overrides, roleDefaults, baselineMap, open]);

  const getRow = (key: string): Draft => drafts.get(key) ?? getBaseline(key);

  const isOverridden = (key: string): boolean => {
    const d = drafts.get(key);
    if (!d) return false;
    const b = getBaseline(key);
    return d.can_view !== b.can_view || d.can_write !== b.can_write || d.day_horizon !== b.day_horizon;
  };

  const onChange = (key: string, patch: Partial<Draft>) => {
    setDrafts(prev => {
      const next = new Map(prev);
      const cur = next.get(key) ?? getBaseline(key);
      next.set(key, { ...cur, ...patch });
      return next;
    });
  };

  const resetRow = (key: string) => {
    setDrafts(prev => {
      const next = new Map(prev);
      next.set(key, { ...getBaseline(key) });
      return next;
    });
  };

  const resetAll = () => {
    const next = new Map<string, Draft>();
    MODULES.forEach(m => next.set(m.key, { ...getBaseline(m.key) }));
    setDrafts(next);
  };

  const overrideCount = useMemo(() => {
    let n = 0;
    drafts.forEach((_d, k) => { if (isOverridden(k)) n++; });
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, baselineMap]);

  const handleSave = async () => {
    if (!userId) return;
    const rows: OverrideRow[] = [];
    drafts.forEach((d, module_key) => {
      const b = getBaseline(module_key);
      // Only persist fields that differ from baseline
      const v_diff = d.can_view !== b.can_view;
      const w_diff = d.can_write !== b.can_write;
      const h_diff = d.day_horizon !== b.day_horizon;
      if (!v_diff && !w_diff && !h_diff) return;
      rows.push({
        module_key,
        can_view: v_diff ? d.can_view : null,
        can_write: w_diff ? d.can_write : null,
        day_horizon: h_diff ? d.day_horizon : null,
      });
    });
    await setPerms.mutateAsync({ userId, rows });
    onOpenChange(false);
  };

  const totalModules = roleDefaults?.filter(r => r.can_view).length ?? 0;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Module Permissions — ${userName}`}
      description="Left column shows what the role grants by default. Toggle View/Write or change Day depth to override per user. Rows that match role default are not stored."
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            Role: <span className="font-semibold">{getPrimaryRoleLabel(userRoles) || "—"}</span>
          </Badge>
          <span className="text-xs text-muted-foreground">
            {totalModules} modules from role · {overrideCount} override(s)
          </span>
          <Button variant="outline" size="sm" onClick={resetAll} className="ml-auto">
            <RotateCcw className="w-3 h-3 mr-1" /> Reset all to role defaults
          </Button>
        </div>

        <PermissionMatrix
          getRow={getRow}
          getBaseline={(k) => baselineMap.get(k) ?? null}
          isOverridden={isOverridden}
          onChange={onChange}
          onReset={resetRow}
        />

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
