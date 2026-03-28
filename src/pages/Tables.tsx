import { useState, useMemo } from "react";
import { useGamingTables, useTransactions, useCloseTable, useReopenTable } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import { useChipSnapshots, useBatchChipSnapshot, getExpectedChips, getInitialTotal } from "@/hooks/use-chips";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency, CHIP_DISTRIBUTION } from "@/lib/currency";
import { AlertTriangle, CheckCircle2, Save, Coins, X, RotateCcw } from "lucide-react";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";

const Tables = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(date);
  const { data: shift } = useActiveShift();
  const { data: snapshots = [] } = useChipSnapshots(date);
  const batchSnapshot = useBatchChipSnapshot();
  const closeTable = useCloseTable();
  const reopenTable = useReopenTable();
  const { isManager } = useAuth();

  // Table close dialog
  const [closingTable, setClosingTable] = useState<any | null>(null);
  const [closingChips, setClosingChips] = useState<Record<number, number>>({});
  const [pendingReopen, setPendingReopen] = useState<string | null>(null);

  // Chip count state
  const [counts, setCounts] = useState<Record<string, Record<number, number>>>({});
  const [showCount, setShowCount] = useState(false);

  const expected = useMemo(() => getExpectedChips(tables), [tables]);
  const initialTotal = useMemo(() => getInitialTotal(tables), [tables]);

  const shiftTransactions = useMemo(() => {
    if (!shift) return transactions;
    return transactions.filter(t => t.shift_id === shift.id);
  }, [transactions, shift]);

  // Per-table results
  const tableResults = useMemo(() => {
    const results: Record<string, { drop: number; cashout: number; result: number; txCount: number }> = {};
    tables.forEach(t => {
      const tableTxs = shiftTransactions.filter(tx => tx.table_id === t.id);
      const drop = tableTxs.filter(tx => tx.type === "buy").reduce((s, tx) => s + Number(tx.amount), 0);
      const cashout = tableTxs.filter(tx => tx.type === "cashout").reduce((s, tx) => s + Number(tx.amount), 0);
      results[t.id] = { drop, cashout, result: drop - cashout, txCount: tableTxs.length };
    });
    return results;
  }, [tables, shiftTransactions]);

  // Table close: calculate result from chip difference
  const closingTableFloat = useMemo(() => {
    if (!closingTable) return 0;
    return Number(closingTable.float_amount) || 0;
  }, [closingTable]);

  const closingChipTotal = useMemo(() => {
    return Object.entries(closingChips).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  }, [closingChips]);

  // table_result = closing_float_value - opening_float_value
  // If chips at table > opening float → table won (positive result for casino)
  // If chips at table < opening float → table lost (negative result for casino)
  const closingResult = closingChipTotal - closingTableFloat;

  const handleCloseTable = () => {
    if (!closingTable) return;
    closeTable.mutate({
      table_id: closingTable.id,
      closing_chips: closingChips,
      result: closingResult,
    }, {
      onSuccess: () => {
        setClosingTable(null);
        setClosingChips({});
      },
    });
  };

  // Chip count locations
  const locations = useMemo(() => {
    const locs: Array<{ key: string; label: string; type: string; id: string | null; denoms: number[]; chipsPerDenom: number }> = [];
    tables.forEach(t => {
      const cpd = t.game === "American Roulette" ? CHIP_DISTRIBUTION.roulette : CHIP_DISTRIBUTION.card;
      locs.push({ key: `table-${t.id}`, label: t.name, type: "table", id: t.id, denoms: t.denominations || [], chipsPerDenom: cpd });
    });
    locs.push({ key: "cashier", label: "Cashier", type: "cashier", id: null, denoms: [...CHIP_DENOMS], chipsPerDenom: CHIP_DISTRIBUTION.cashier });
    locs.push({ key: "safe", label: "Manager Safe", type: "safe", id: null, denoms: [...CHIP_DENOMS], chipsPerDenom: CHIP_DISTRIBUTION.safe });
    return locs;
  }, [tables]);

  const actualTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { totals[d] = 0; });
    Object.values(counts).forEach(locCounts => {
      Object.entries(locCounts).forEach(([d, q]) => {
        totals[Number(d)] = (totals[Number(d)] || 0) + (q || 0);
      });
    });
    return totals;
  }, [counts]);

  const missPerDenom = useMemo(() => {
    const miss: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { miss[d] = (actualTotals[d] || 0) - (expected[d] || 0); });
    return miss;
  }, [actualTotals, expected]);

  const totalActualValue = Object.entries(actualTotals).reduce((s, [d, q]) => s + Number(d) * q, 0);
  const totalMissValue = totalActualValue - initialTotal;
  const hasIncident = totalActualValue > initialTotal;
  const hasAnyCount = Object.values(counts).some(lc => Object.values(lc).some(v => v > 0));
  const hasSnapshotToday = snapshots.length > 0;

  const handleSaveCount = () => {
    const rows: Array<{
      location_type: string; location_id: string | null;
      denomination: number; expected_quantity: number; actual_quantity: number;
    }> = [];
    locations.forEach(loc => {
      const locCounts = counts[loc.key] || {};
      loc.denoms.forEach(d => {
        const actual = locCounts[d] || 0;
        rows.push({ location_type: loc.type, location_id: loc.id, denomination: d, expected_quantity: loc.chipsPerDenom, actual_quantity: actual });
      });
    });
    batchSnapshot.mutate({ date, counts: rows }, { onSuccess: () => { setCounts({}); setShowCount(false); } });
  };

  // Totals across all tables
  const totalDrop = Object.values(tableResults).reduce((s, r) => s + r.drop, 0);
  const totalCashout = Object.values(tableResults).reduce((s, r) => s + r.cashout, 0);
  const totalResult = totalDrop - totalCashout;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tables & Chip Accounting</h1>
          <p className="text-sm text-muted-foreground">Float, Result & MISS Tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
          <Button variant={showCount ? "destructive" : "default"} size="sm" onClick={() => setShowCount(!showCount)} className="gap-1.5">
            <Coins className="w-4 h-4" /> {showCount ? "Cancel Count" : "Chip Count"}
          </Button>
        </div>
      </div>

      {/* Aggregate Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="cms-panel p-2">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Total Drop</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(totalDrop)}</p>
        </div>
        <div className="cms-panel p-2">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Total Cashout</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(totalCashout)}</p>
        </div>
        <div className="cms-panel p-2">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Table Result</p>
          <p className={`font-mono text-sm font-bold ${totalResult >= 0 ? "text-green-500" : "text-destructive"}`}>
            {totalResult >= 0 ? "+" : ""}{formatCurrency(totalResult)}
          </p>
        </div>
        <div className="cms-panel p-2">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Initial Chip Total</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(initialTotal)}</p>
        </div>
      </div>

      {/* Table Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tables.map(table => {
          const r = tableResults[table.id] || { drop: 0, cashout: 0, result: 0, txCount: 0 };
          const isOpen = table.status === "open";

          return (
            <div key={table.id} className="cms-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOpen ? "bg-green-500" : "bg-destructive"}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{table.name}</h3>
                    <p className="text-xs text-muted-foreground">{table.game}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isOpen ? "default" : "secondary"} className="text-[10px] uppercase">{table.status}</Badge>
                  {isOpen && shift && (
                    <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => { setClosingTable(table); setClosingChips({}); }}>
                      <X className="w-3 h-3" /> Close
                    </Button>
                  )}
                  {!isOpen && isManager && (
                    <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setPendingReopen(table.id)}>
                      <RotateCcw className="w-3 h-3" /> Reopen
                    </Button>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 grid grid-cols-5 gap-2">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Float</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(Number(table.float_amount))}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Drop</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(r.drop)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Cashout</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(r.cashout)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Result</p>
                  <p className={`font-mono text-xs font-bold ${r.result >= 0 ? "text-green-500" : "text-destructive"}`}>
                    {r.result >= 0 ? "+" : ""}{formatCurrency(r.result)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Txns</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{r.txCount}</p>
                </div>
              </div>
              <div className="px-4 py-2 border-t border-border flex gap-1.5 flex-wrap">
                {table.denominations?.map(d => (
                  <span key={d} className={`cms-chip text-[10px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span>
                ))}
              </div>
            </div>
          );
        })}
        {tables.length === 0 && <p className="text-muted-foreground text-sm col-span-2 text-center py-8">No tables configured</p>}
      </div>

      {/* Table Close Dialog */}
      {closingTable && (
        <Dialog open onOpenChange={() => { setClosingTable(null); setClosingChips({}); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Close {closingTable.name}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Count chips remaining on the table. Result = Closing chips − Opening float ({formatCurrency(closingTableFloat)}).
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {(closingTable.denominations || []).map((d: number) => (
                  <div key={d} className="flex items-center gap-1">
                    <span className={`cms-chip text-[8px] min-w-[36px] text-center ${CHIP_COLORS[d] || ""}`}>{formatChipLabel(d)}</span>
                    <Input type="number" min={0} value={closingChips[d] || ""}
                      onChange={e => setClosingChips(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                      className="font-mono w-14 h-7 text-xs" placeholder="0"
                      onKeyDown={e => { if (e.key === "Enter") handleCloseTable(); }} />
                  </div>
                ))}
              </div>

              {/* Result preview */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Opening Float</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingTableFloat)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Closing Chips</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingChipTotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Table Result</p>
                  <p className={`font-mono text-xs font-bold ${closingResult >= 0 ? "text-green-500" : "text-destructive"}`}>
                    {closingResult >= 0 ? "+" : ""}{formatCurrency(closingResult)}
                  </p>
                </div>
              </div>

              {closingResult > 0 && (
                <p className="text-[10px] text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Table won — {formatCurrency(closingResult)} more chips than start.
                </p>
              )}
              {closingResult < 0 && (
                <p className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Table lost — {formatCurrency(Math.abs(closingResult))} fewer chips than start.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setClosingTable(null); setClosingChips({}); }}>Cancel</Button>
              <Button onClick={handleCloseTable} disabled={closeTable.isPending || closingChipTotal === 0}>
                {closeTable.isPending ? "Closing…" : `Close Table · Result: ${closingResult >= 0 ? "+" : ""}${formatCurrency(closingResult)}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manager override for reopen */}
      <ManagerOverrideDialog
        open={!!pendingReopen}
        onClose={() => setPendingReopen(null)}
        onConfirm={(managerId) => {
          if (pendingReopen) {
            reopenTable.mutate(pendingReopen);
            setPendingReopen(null);
          }
        }}
        title="Reopen Table"
        description="Manager authentication required to reopen a closed table."
        actionType="TABLE_REOPEN"
        actionDetails={{ table_id: pendingReopen }}
      />

      {/* Chip Count Mode */}
      {showCount && (
        <div className="cms-panel mb-6">
          <div className="cms-header flex items-center justify-between">
            <span>Chip Count — Per Location</span>
            {hasIncident && (
              <span className="flex items-center gap-1 text-destructive text-xs font-bold">
                <AlertTriangle className="w-4 h-4" /> INCIDENT: Chips exceed initial total
              </span>
            )}
          </div>
          <div className="p-4 space-y-6">
            {locations.map(loc => {
              const locCounts = counts[loc.key] || {};
              return (
                <div key={loc.key}>
                  <p className="text-xs font-semibold text-card-foreground mb-2 flex items-center gap-2">
                    {loc.label}
                    <span className="text-[10px] text-muted-foreground font-normal">({loc.chipsPerDenom} expected per denom)</span>
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                    {loc.denoms.map(d => {
                      const actual = locCounts[d] || 0;
                      const exp = loc.chipsPerDenom;
                      const diff = actual - exp;
                      const hasValue = actual > 0;
                      return (
                        <div key={d} className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span className={`cms-chip text-[8px] min-w-[36px] text-center ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>
                              {formatChipLabel(d)}
                            </span>
                            <Input type="number" min={0} value={locCounts[d] || ""}
                              onChange={e => setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: Number(e.target.value) || 0 } }))}
                              className="font-mono w-14 h-7 text-xs" placeholder={String(exp)} />
                          </div>
                          {hasValue && diff !== 0 && (
                            <p className={`text-[9px] font-mono text-center ${diff > 0 ? "text-destructive" : "text-orange-500"}`}>
                              {diff > 0 ? "+" : ""}{diff}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {hasAnyCount && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-card-foreground mb-2">MISS Summary</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Denom</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Expected</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Actual</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">MISS</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHIP_DENOMS.map(d => {
                        const exp = expected[d] || 0;
                        const act = actualTotals[d] || 0;
                        const miss = missPerDenom[d] || 0;
                        if (exp === 0 && act === 0) return null;
                        return (
                          <tr key={d} className="border-b border-border last:border-0">
                            <td className="py-1.5 px-2"><span className={`cms-chip text-[8px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span></td>
                            <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{exp}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{act}</td>
                            <td className={`py-1.5 px-2 text-right font-mono font-bold ${miss === 0 ? "text-green-500" : "text-destructive"}`}>{miss > 0 ? "+" : ""}{miss}</td>
                            <td className={`py-1.5 px-2 text-right font-mono ${miss === 0 ? "text-green-500" : "text-destructive"}`}>{miss !== 0 ? `${miss > 0 ? "+" : ""}${formatCurrency(miss * d)}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={3} className="py-2 px-2 font-semibold text-card-foreground">Total</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-card-foreground">{Object.values(missPerDenom).reduce((s, v) => s + v, 0)}</td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="cms-panel p-2 text-center">
                    <p className="text-[9px] uppercase text-muted-foreground">Initial Total</p>
                    <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(initialTotal)}</p>
                  </div>
                  <div className="cms-panel p-2 text-center">
                    <p className="text-[9px] uppercase text-muted-foreground">Counted Total</p>
                    <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(totalActualValue)}</p>
                  </div>
                  <div className={`cms-panel p-2 text-center ${hasIncident ? "border-destructive/50" : totalMissValue === 0 ? "border-green-500/30" : ""}`}>
                    <p className="text-[9px] uppercase text-muted-foreground">MISS</p>
                    <p className={`font-mono text-xs font-bold ${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</p>
                  </div>
                </div>

                {hasIncident && (
                  <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-destructive">INCIDENT DETECTED</p>
                      <p className="text-xs text-destructive/80">Total chips counted ({formatCurrency(totalActualValue)}) exceed initial system total ({formatCurrency(initialTotal)}).</p>
                    </div>
                  </div>
                )}

                <Button onClick={handleSaveCount} disabled={batchSnapshot.isPending || !hasAnyCount} className="w-full mt-4 gap-1.5">
                  <Save className="w-4 h-4" /> {batchSnapshot.isPending ? "Saving…" : "Record Chip Count"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Previous Snapshots */}
      {hasSnapshotToday && !showCount && (
        <div className="cms-panel">
          <div className="cms-header">Today's Chip Count</div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">Denom</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Expected</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Actual</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">MISS</th>
                  </tr>
                </thead>
                <tbody>
                  {CHIP_DENOMS.map(d => {
                    const denomSnaps = snapshots.filter(s => s.denomination === d);
                    if (denomSnaps.length === 0) return null;
                    const totalExp = denomSnaps.reduce((s, sn) => s + sn.expected_quantity, 0);
                    const totalAct = denomSnaps.reduce((s, sn) => s + sn.actual_quantity, 0);
                    const miss = totalAct - totalExp;
                    return (
                      <tr key={d} className="border-b border-border last:border-0">
                        <td className="py-1.5 px-2"><span className={`cms-chip text-[8px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span></td>
                        <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{totalExp}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{totalAct}</td>
                        <td className={`py-1.5 px-2 text-right font-mono font-bold ${miss === 0 ? "text-green-500" : "text-destructive"}`}>{miss > 0 ? "+" : ""}{miss}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Recorded at {snapshots[0] && new Date(snapshots[0].created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tables;
