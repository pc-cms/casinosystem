/**
 * CloseTableWizard — modal that walks Pit through every open table one by one.
 *
 * Flow:
 *  - Per-table inputs are prefilled from the latest chip_snapshot for that table
 *    in the current shift; if no snapshot, from chip_baseline (the float).
 *  - Save writes gaming_tables.closing_chips/closing_result + an audit snapshot.
 *  - Saved tables get a green "Closed" check and can be reopened only via Manager Access.
 *  - Footer "Tables Close" is enabled only when EVERY open table has a closing_result;
 *    pressing it sets gaming_tables.status='closed' for all of them at once.
 */
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, ChevronLeft, ChevronRight, ShieldAlert, X } from "lucide-react";
import { formatChipLabel, formatCurrency } from "@/lib/currency";
import { useChipColors, resolveChipColor } from "@/hooks/use-chip-colors";
import { useChipBaseline, useSetSingleTableResult, useReopenSingleTable, useCloseAllTables, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useChipSnapshots } from "@/hooks/use-chips";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type GamingTable = {
  id: string;
  name: string;
  game: string;
  status: string;
  denominations: number[];
  closing_chips: any;
  closing_result: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tables: GamingTable[];
  date: string;
};

export const CloseTableWizard = ({ open, onClose, tables, date }: Props) => {
  // Only OPEN tables enter the wizard (closed tables are already done)
  const wizardTables = useMemo(
    () => tables.filter(t => t.status === "open").sort((a, b) => a.name.localeCompare(b.name)),
    [tables]
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [counts, setCounts] = useState<Record<string, Record<number, number>>>({}); // local per-table counts
  const [showOverride, setShowOverride] = useState(false);

  const { data: baseline = [] } = useChipBaseline();
  const { data: snapshots = [] } = useChipSnapshots(date);
  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);
  const setSingleResult = useSetSingleTableResult();
  const reopenSingle = useReopenSingleTable();
  const closeAll = useCloseAllTables();

  // Reset cursor when wizard opens
  useEffect(() => {
    if (open) setCurrentIdx(0);
  }, [open]);

  const current = wizardTables[currentIdx];

  // Latest snapshot per table for the current date
  const latestSnapshotPerTable = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    const sorted = [...snapshots].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    sorted.forEach((s: any) => {
      if (s.location_type !== "table" || !s.location_id) return;
      if (!map[s.location_id]) map[s.location_id] = {};
      map[s.location_id][Number(s.denomination)] = Number(s.actual_quantity);
    });
    return map;
  }, [snapshots]);

  // Effective counts for current table (local edits > closing_chips draft > snapshot > baseline)
  const getInitialCounts = (table: GamingTable): Record<number, number> => {
    const out: Record<number, number> = {};
    const tableBaseline = baselineMap[table.id] || {};
    const snap = latestSnapshotPerTable[table.id] || {};
    const draft = (table.closing_chips || {}) as Record<string, number>;
    (table.denominations || []).forEach(d => {
      if (draft[String(d)] !== undefined) out[d] = Number(draft[String(d)]);
      else if (snap[d] !== undefined) out[d] = snap[d];
      else out[d] = tableBaseline[d] || 0;
    });
    return out;
  };

  const currentCounts = current
    ? counts[current.id] ?? getInitialCounts(current)
    : {};

  const setCount = (denom: number, val: number) => {
    if (!current) return;
    setCounts(c => ({
      ...c,
      [current.id]: { ...currentCounts, [denom]: val },
    }));
  };

  const calcResult = (table: GamingTable, c: Record<number, number>): number => {
    const tb = baselineMap[table.id] || {};
    let total = 0;
    (table.denominations || []).forEach(d => {
      const expected = tb[d] || 0;
      const actual = c[d] ?? 0;
      total += (actual - expected) * d;
    });
    return total;
  };

  const isCounted = (table: GamingTable) => table.closing_result !== null && table.closing_result !== undefined;

  const allCounted = wizardTables.length > 0 && wizardTables.every(isCounted);

  const handleSave = async (advance: boolean) => {
    if (!current) return;
    const tb = baselineMap[current.id] || {};
    const chipMap: Record<string, number> = {};
    const snapshotRows: any[] = [];
    (current.denominations || []).forEach(d => {
      const expected = tb[d] || 0;
      const actual = currentCounts[d] ?? 0;
      chipMap[String(d)] = actual;
      snapshotRows.push({
        location_type: "table",
        location_id: current.id,
        denomination: d,
        expected_quantity: expected,
        actual_quantity: actual,
        date,
      });
    });
    const result = calcResult(current, currentCounts);

    setSingleResult.mutate(
      { table_id: current.id, closing_chips: chipMap, closing_result: result, snapshot_rows: snapshotRows },
      {
        onSuccess: () => {
          toast.success(`${current.name} saved`);
          // Clear local edits for this table since it's now persisted
          setCounts(c => { const cp = { ...c }; delete cp[current.id]; return cp; });
          if (advance && currentIdx < wizardTables.length - 1) {
            setCurrentIdx(i => i + 1);
          }
        },
      }
    );
  };

  const handleReopenConfirmed = (_managerId: string) => {
    if (!current) return;
    reopenSingle.mutate(current.id, {
      onSuccess: () => {
        toast.info(`${current.name} reopened — recount required`);
        setShowOverride(false);
      },
    });
  };

  const handleTablesClose = () => {
    if (!allCounted) return;
    const ids = wizardTables.map(t => t.id);
    closeAll.mutate(ids, {
      onSuccess: () => {
        toast.success("All tables closed — handed over to Cashier");
        onClose();
      },
    });
  };

  const liveResult = current ? calcResult(current, currentCounts) : 0;
  const tableBaseline = current ? baselineMap[current.id] || {} : {};

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Close Tables
                <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                  {wizardTables.filter(isCounted).length} / {wizardTables.length} counted
                </Badge>
              </DialogTitle>
              <Button
                onClick={handleTablesClose}
                disabled={!allCounted || closeAll.isPending}
                size="sm"
                className="gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                {closeAll.isPending ? "Closing…" : "Tables Close"}
              </Button>
            </div>
          </DialogHeader>

          {wizardTables.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No open tables to close</p>
          ) : (
            <div className="grid grid-cols-[200px_1fr] gap-4">
              {/* LEFT — table list */}
              <div className="space-y-1 border-r border-border pr-3 max-h-[60vh] overflow-y-auto">
                {wizardTables.map((t, i) => {
                  const counted = isCounted(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setCurrentIdx(i)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                        i === currentIdx
                          ? "bg-primary/10 text-primary font-medium border border-primary/30"
                          : "hover:bg-muted/40 text-card-foreground"
                      )}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {counted ? (
                          <Check className="w-3.5 h-3.5 text-success shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                        )}
                        <span className="truncate">{t.name}</span>
                      </span>
                      {counted && (
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            Number(t.closing_result) >= 0 ? "text-success" : "text-destructive"
                          )}
                        >
                          {Number(t.closing_result) >= 0 ? "+" : ""}
                          {formatCurrency(Number(t.closing_result))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* RIGHT — current table detail */}
              {current && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-card-foreground">{current.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{current.game}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                        disabled={currentIdx === 0}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {currentIdx + 1} / {wizardTables.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCurrentIdx(i => Math.min(wizardTables.length - 1, i + 1))}
                        disabled={currentIdx === wizardTables.length - 1}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Inputs grid */}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Denom</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Float (Baseline)</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">Actual Count</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Diff Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(current.denominations || []).map(d => {
                        const expected = tableBaseline[d] || 0;
                        const actual = currentCounts[d] ?? 0;
                        const diff = (actual - expected) * d;
                        return (
                          <tr key={d} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 px-2">
                              <span className={`cms-chip text-[9px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>
                                {formatChipLabel(d)}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[11px] text-muted-foreground">
                              {expected}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0"
                                value={currentCounts[d] ?? ""}
                                onChange={e => {
                                  const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  setCount(d, isNaN(v) ? 0 : v);
                                }}
                                className="w-24 h-8 mx-auto block rounded text-[12px] font-mono text-center border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-card-foreground"
                                placeholder={String(expected)}
                              />
                            </td>
                            <td
                              className={cn(
                                "py-1.5 px-2 text-right font-mono text-[11px]",
                                diff > 0 && "text-success",
                                diff < 0 && "text-destructive",
                                diff === 0 && "text-muted-foreground"
                              )}
                            >
                              {diff > 0 ? "+" : ""}
                              {formatCurrency(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Live result */}
                  <div className="cms-panel p-3 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Result</span>
                    <span
                      className={cn(
                        "font-mono text-lg font-bold",
                        liveResult >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {liveResult >= 0 ? "+" : ""}
                      {formatCurrency(liveResult)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div>
                      {isCounted(current) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowOverride(true)}
                          className="gap-1.5 text-destructive hover:text-destructive"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> Reopen (Manager)
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
                        <X className="w-3.5 h-3.5" /> Close
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSave(false)}
                        disabled={setSingleResult.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(true)}
                        disabled={setSingleResult.isPending || currentIdx === wizardTables.length - 1}
                        className="gap-1.5"
                      >
                        Save & Next <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ManagerOverrideDialog
        open={showOverride}
        onClose={() => setShowOverride(false)}
        onConfirm={handleReopenConfirmed}
        title="Reopen Table — Manager Access"
        description={`Reopen ${current?.name ?? ""} for recount? This clears the saved closing result.`}
        actionType="TABLE_RESULT_REOPEN"
        actionDetails={{ table_id: current?.id, table_name: current?.name }}
      />
    </>
  );
};
