/**
 * TableManagement — Manager UI to toggle gaming tables Active/Inactive
 * (archive/restore) and rename them inline.
 *
 * Inactive (archived) tables are hidden from all operational views
 * (Pit ActivePlayers, Tables, Cage, etc.) but kept in DB for historical data.
 */
import { useState } from "react";
import { useGamingTables, useArchiveTable, useRenameTable } from "@/hooks/use-tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, X, Pencil, LayoutGrid } from "lucide-react";

const TableManagement = () => {
  const { data: tables = [], isLoading } = useGamingTables(true); // include archived
  const archiveTable = useArchiveTable();
  const renameTable = useRenameTable();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setDraftName(current);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
  };
  const commitEdit = (id: string, original: string) => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === original) {
      cancelEdit();
      return;
    }
    renameTable.mutate(
      { tableId: id, name: trimmed },
      { onSuccess: () => cancelEdit() }
    );
  };

  const sorted = [...tables].sort((a, b) => {
    // Active first, then by name
    if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const activeCount = tables.filter(t => !t.is_archived).length;
  const inactiveCount = tables.length - activeCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" /> Gaming Tables
          </h2>
          <p className="text-xs text-muted-foreground">
            Toggle tables Active / Inactive and rename. Inactive tables are hidden everywhere except here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-success/30 text-success">
            {activeCount} Active
          </Badge>
          {inactiveCount > 0 && (
            <Badge variant="outline" className="border-muted text-muted-foreground">
              {inactiveCount} Inactive
            </Badge>
          )}
        </div>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Game</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-[120px]">Status</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-[140px]">Active</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => {
              const isEditing = editingId === t.id;
              const isInactive = t.is_archived;
              return (
                <tr
                  key={t.id}
                  className={`border-b border-border last:border-0 ${isInactive ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          value={draftName}
                          onChange={e => setDraftName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitEdit(t.id, t.name);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8 text-sm font-mono max-w-[200px]"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => commitEdit(t.id, t.name)}
                          disabled={renameTable.isPending}
                          aria-label="Save"
                        >
                          <Check className="w-4 h-4 text-success" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={cancelEdit}
                          aria-label="Cancel"
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(t.id, t.name)}
                        className="group flex items-center gap-2 text-left font-mono font-semibold text-card-foreground hover:text-primary transition-colors"
                        title="Click to rename"
                      >
                        <span>{t.name}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{t.game}</td>
                  <td className="px-4 py-2">
                    {isInactive ? (
                      <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
                        Inactive
                      </Badge>
                    ) : t.status === "closed" ? (
                      <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
                        Closed (shift)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                        Open
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Switch
                      checked={!isInactive}
                      disabled={archiveTable.isPending}
                      onCheckedChange={(checked) =>
                        archiveTable.mutate({ tableId: t.id, archive: !checked })
                      }
                      aria-label={isInactive ? "Activate table" : "Deactivate table"}
                    />
                  </td>
                </tr>
              );
            })}
            {tables.length === 0 && !isLoading && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                  No tables configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        💡 Inactive tables stay in the database (historical data preserved) but disappear from the Pit, Cashier and Active Players views.
      </p>
    </div>
  );
};

export default TableManagement;
