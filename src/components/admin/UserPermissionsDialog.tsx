/**
 * UserPermissionsDialog — checkbox matrix granting per-module visibility to a user.
 * Empty selection = revert to role defaults (no overrides).
 */
import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MODULES, MODULE_GROUPS, type ModuleKey } from "@/lib/modules";
import { useUserModulePermissions, useSetUserModulePermissions } from "@/hooks/use-module-permissions";
import { Save, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
}

export const UserPermissionsDialog = ({ open, onOpenChange, userId, userName }: Props) => {
  const { data: serverAllowed } = useUserModulePermissions(userId);
  const setPerms = useSetUserModulePermissions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasOverrides, setHasOverrides] = useState(false);

  useEffect(() => {
    if (serverAllowed) {
      setSelected(new Set(serverAllowed));
      setHasOverrides(serverAllowed.size > 0);
    }
  }, [serverAllowed, open]);

  const grouped = useMemo(() => {
    return MODULE_GROUPS.map(g => ({
      group: g,
      items: MODULES.filter(m => m.group === g),
    }));
  }, []);

  const toggle = (key: ModuleKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setHasOverrides(true);
  };

  const selectAll = () => {
    setSelected(new Set(MODULES.map(m => m.key)));
    setHasOverrides(true);
  };

  const clearAll = () => {
    setSelected(new Set());
    setHasOverrides(true);
  };

  const resetToRoleDefaults = () => {
    setSelected(new Set());
    setHasOverrides(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    const allowed = hasOverrides ? (Array.from(selected) as ModuleKey[]) : [];
    await setPerms.mutateAsync({ userId, allowed });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Module Permissions — ${userName}`}
      description="Pick which modules this user can see. Leave empty (or click 'Use role defaults') to revert to role-based visibility."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>Select all</Button>
          <Button variant="outline" size="sm" onClick={clearAll}>Clear all</Button>
          <Button variant="outline" size="sm" onClick={resetToRoleDefaults}>
            <RotateCcw className="w-3 h-3 mr-1" /> Use role defaults
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {hasOverrides ? `${selected.size} / ${MODULES.length} allowed` : "Role defaults active"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {grouped.map(({ group, items }) => (
            <div key={group} className="border border-border rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{group}</p>
              <div className="space-y-1.5">
                {items.map(m => (
                  <label
                    key={m.key}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1"
                  >
                    <Checkbox
                      checked={hasOverrides && selected.has(m.key)}
                      onCheckedChange={() => toggle(m.key)}
                      disabled={!hasOverrides ? false : undefined}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
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
