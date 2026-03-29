import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useGamingTables, useTransactions, useCloseTable, useReopenTable } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import { useChipSnapshots, useBatchChipSnapshot, getExpectedChips, getInitialTotal } from "@/hooks/use-chips";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency, CHIP_DISTRIBUTION } from "@/lib/currency";
import { AlertTriangle, Save, Coins, X, RotateCcw } from "lucide-react";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import ChipDenomInput from "@/components/ChipDenomInput";

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

  const handleCloseTable = () => {
    if (!closingTable) return;
    const r = tableResults[closingTable.id] || { drop: 0, cashout: 0, result: 0 };
    closeTable.mutate({
      table_id: closingTable.id,
      closing_chips: {},
    }, {
      onSuccess: () => {
        setClosingTable(null);
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

  // Group tables by game type
  const gameGroups = useMemo(() => {
    const groups: Record<string, typeof tables> = {};
    tables.forEach(t => {
      const key = t.game;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [tables]);

  // Game-type totals
  const gameTypeTotals = useMemo(() => {
    const totals: Record<string, { drop: number; cashout: number; result: number; label: string }> = {};
    const gameLabels: Record<string, string> = {
      "American Roulette": "Total ARs",
      "Poker": "Total P",
      "Blackjack": "Total BJ",
    };
    tables.forEach(t => {
      const label = gameLabels[t.game] || `Total ${t.game}`;
      if (!totals[t.game]) totals[t.game] = { drop: 0, cashout: 0, result: 0, label };
      const r = tableResults[t.id] || { drop: 0, cashout: 0, result: 0 };
      totals[t.game].drop += r.drop;
      totals[t.game].cashout += r.cashout;
      totals[t.game].result += r.result;
    });
    return totals;
  }, [tables, tableResults]);

  const totalDrop = Object.values(tableResults).reduce((s, r) => s + r.drop, 0);
  const totalCashout = Object.values(tableResults).reduce((s, r) => s + r.cashout, 0);
  const totalResult = totalDrop - totalCashout;

  // Separate AR/BJ tables (left column) from Poker (right column)
  const pokerGames = ["Poker", "Texas Holdem", "Omaha", "PLO"];
  const leftTables = tables.filter(t => !pokerGames.includes(t.game)).sort((a, b) => a.name.localeCompare(b.name));
  const rightTables = tables.filter(t => pokerGames.includes(t.game)).sort((a, b) => a.name.localeCompare(b.name));

  const renderTableCard = (table: typeof tables[0]) => {
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
              <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => setClosingTable(table)}>
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
        <div className="px-4 py-3 grid grid-cols-4 gap-2">
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
      </div>
    );
  };

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

      {/* Game-type Summary */}
      <div className={`grid gap-2 mb-4`} style={{ gridTemplateColumns: `repeat(${Object.keys(gameTypeTotals).length + 1}, minmax(0, 1fr))` }}>
        {Object.entries(gameTypeTotals).map(([game, t]) => (
          <div key={game} className="cms-panel p-2">
            <p className="text-[9px] uppercase text-muted-foreground tracking-wider">{t.label}</p>
            <p className={`font-mono text-sm font-bold ${t.result >= 0 ? "text-green-500" : "text-destructive"}`}>
              {t.result >= 0 ? "+" : ""}{formatCurrency(t.result)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              D: {formatCurrency(t.drop)} · C: {formatCurrency(t.cashout)}
            </p>
          </div>
        ))}
        <div className="cms-panel p-2 border-primary/30">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Total Casino</p>
          <p className={`font-mono text-sm font-bold ${totalResult >= 0 ? "text-green-500" : "text-destructive"}`}>
            {totalResult >= 0 ? "+" : ""}{formatCurrency(totalResult)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            D: {formatCurrency(totalDrop)} · C: {formatCurrency(totalCashout)}
          </p>
        </div>
      </div>

      {/* Two-column Table Cards: Left = AR/BJ, Right = Poker */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 border-b border-border pb-1">AR / BJ</h3>
          {leftTables.map(renderTableCard)}
          {leftTables.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No AR/BJ tables</p>}
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 border-b border-border pb-1">Poker</h3>
          {rightTables.map(renderTableCard)}
          {rightTables.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No Poker tables</p>}
        </div>
      </div>
      {tables.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No tables configured</p>}

      {/* Table Close Dialog */}
      {closingTable && (() => {
        const r = tableResults[closingTable.id] || { drop: 0, cashout: 0, result: 0 };
        return (
          <Dialog open onOpenChange={() => setClosingTable(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Close {closingTable.name}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Confirm closing this table. Result is based on transactions (Drop − Cashout).
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Drop</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(r.drop)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Cashout</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(r.cashout)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Result</p>
                  <p className={`font-mono text-xs font-bold ${r.result >= 0 ? "text-green-500" : "text-destructive"}`}>
                    {r.result >= 0 ? "+" : ""}{formatCurrency(r.result)}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setClosingTable(null)}>Cancel</Button>
                <Button onClick={handleCloseTable} disabled={closeTable.isPending}>
                  {closeTable.isPending ? "Closing…" : "Close Table"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

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
              const placeholders: Record<number, number> = {};
              loc.denoms.forEach(d => { placeholders[d] = loc.chipsPerDenom; });
              return (
                <div key={loc.key}>
                  <p className="text-xs font-semibold text-card-foreground mb-2 flex items-center gap-2">
                    {loc.label}
                    <span className="text-[10px] text-muted-foreground font-normal">({loc.chipsPerDenom} expected per denom)</span>
                  </p>
                  <ChipDenomInput
                    values={locCounts}
                    onChange={v => setCounts(c => ({ ...c, [loc.key]: v }))}
                    denoms={loc.denoms}
                    showValue={false}
                    placeholder={placeholders}
                  />
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
