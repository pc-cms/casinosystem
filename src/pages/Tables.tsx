import { useState, useMemo } from "react";
import { useGamingTables, useTransactions } from "@/hooks/use-casino-data";
import { useChipSnapshots, useBatchChipSnapshot, getExpectedChips, getInitialTotal } from "@/hooks/use-chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency, CHIP_DISTRIBUTION } from "@/lib/currency";
import { AlertTriangle, CheckCircle2, Save, Coins } from "lucide-react";

const Tables = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(date);
  const { data: snapshots = [] } = useChipSnapshots(date);
  const batchSnapshot = useBatchChipSnapshot();

  // Chip count state: { [locationKey]: { [denom]: actual_count } }
  const [counts, setCounts] = useState<Record<string, Record<number, number>>>({});
  const [showCount, setShowCount] = useState(false);

  const expected = useMemo(() => getExpectedChips(tables), [tables]);
  const initialTotal = useMemo(() => getInitialTotal(tables), [tables]);

  // Location keys: each table, cashier, safe
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

  // Calculate totals per denomination across all locations
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

  // Has existing snapshot for today
  const hasSnapshotToday = snapshots.length > 0;

  const handleSaveCount = () => {
    const rows: Array<{
      location_type: string;
      location_id: string | null;
      denomination: number;
      expected_quantity: number;
      actual_quantity: number;
    }> = [];

    locations.forEach(loc => {
      const locCounts = counts[loc.key] || {};
      loc.denoms.forEach(d => {
        const actual = locCounts[d] || 0;
        rows.push({
          location_type: loc.type,
          location_id: loc.id,
          denomination: d,
          expected_quantity: loc.chipsPerDenom,
          actual_quantity: actual,
        });
      });
    });

    batchSnapshot.mutate({ date, counts: rows }, {
      onSuccess: () => {
        setCounts({});
        setShowCount(false);
      },
    });
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

      {/* Table Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tables.map(table => {
          const tableTxs = transactions.filter(t => t.table_id === table.id);
          const totalDrop = tableTxs.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0);
          const totalCashout = tableTxs.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0);
          const result = totalDrop - totalCashout;

          return (
            <div key={table.id} className="cms-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${table.status === "open" ? "bg-green-500" : "bg-destructive"}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{table.name}</h3>
                    <p className="text-xs text-muted-foreground">{table.game}</p>
                  </div>
                </div>
                <Badge variant={table.status === "open" ? "default" : "secondary"} className="text-[10px] uppercase">{table.status}</Badge>
              </div>
              <div className="px-4 py-3 grid grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Float</p>
                  <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(Number(table.float_amount))}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Drop</p>
                  <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(totalDrop)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Cashout</p>
                  <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(totalCashout)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Result</p>
                  <p className={`font-mono text-sm font-bold ${result >= 0 ? "text-green-500" : "text-destructive"}`}>
                    {result >= 0 ? "+" : ""}{formatCurrency(result)}
                  </p>
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
                            <Input
                              type="number"
                              min={0}
                              value={locCounts[d] || ""}
                              onChange={e => setCounts(c => ({
                                ...c,
                                [loc.key]: { ...(c[loc.key] || {}), [d]: Number(e.target.value) || 0 }
                              }))}
                              className="font-mono w-14 h-7 text-xs"
                              placeholder={String(exp)}
                            />
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

            {/* MISS Summary */}
            {hasAnyCount && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-card-foreground mb-2">MISS Summary (per denomination)</p>
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
                            <td className="py-1.5 px-2">
                              <span className={`cms-chip text-[8px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{exp}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{act}</td>
                            <td className={`py-1.5 px-2 text-right font-mono font-bold ${miss === 0 ? "text-green-500" : miss > 0 ? "text-destructive" : "text-orange-500"}`}>
                              {miss > 0 ? "+" : ""}{miss}
                            </td>
                            <td className={`py-1.5 px-2 text-right font-mono ${miss === 0 ? "text-green-500" : "text-destructive"}`}>
                              {miss !== 0 ? `${miss > 0 ? "+" : ""}${formatCurrency(miss * d)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={3} className="py-2 px-2 font-semibold text-card-foreground">Total</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-card-foreground">
                          {Object.values(missPerDenom).reduce((s, v) => s + v, 0)}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>
                          {totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* System totals */}
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
                    <p className={`font-mono text-xs font-bold ${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>
                      {totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}
                    </p>
                  </div>
                </div>

                {hasIncident && (
                  <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-destructive">INCIDENT DETECTED</p>
                      <p className="text-xs text-destructive/80">Total chips counted ({formatCurrency(totalActualValue)}) exceed initial system total ({formatCurrency(initialTotal)}). This must be investigated before closing.</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveCount}
                  disabled={batchSnapshot.isPending || !hasAnyCount}
                  className="w-full mt-4 gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {batchSnapshot.isPending ? "Saving…" : "Record Chip Count"}
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
                        <td className="py-1.5 px-2">
                          <span className={`cms-chip text-[8px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{totalExp}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-card-foreground">{totalAct}</td>
                        <td className={`py-1.5 px-2 text-right font-mono font-bold ${miss === 0 ? "text-green-500" : "text-destructive"}`}>
                          {miss > 0 ? "+" : ""}{miss}
                        </td>
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
