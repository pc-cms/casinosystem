import { useState, useMemo } from "react";
import { useGamingTables, useTransactions, useTableTracker } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import { useChipSnapshots } from "@/hooks/use-chips";
import { useChipBaseline, useOpenAllTables, baselineToMap } from "@/hooks/use-table-lifecycle";

import { getBusinessDate } from "@/lib/business-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { Play, Lock, LayoutGrid } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloseTableWizard } from "@/components/tables/CloseTableWizard";
import { liveTableResult, buildLatestTableSnapshot } from "@/lib/table-live-result";

const Tables = () => {
  const businessDay = getBusinessDate();
  const [date, setDate] = useState(businessDay);
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(date);
  const { data: shift } = useActiveShift();
  const { data: snapshots = [] } = useChipSnapshots(date);
  const { data: baseline = [] } = useChipBaseline();
  const openAllTables = useOpenAllTables();

  // Close Table wizard
  const [showCloseWizard, setShowCloseWizard] = useState(false);

  // Close Table wizard
  const [showCloseWizard, setShowCloseWizard] = useState(false);

  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);

  const closedTables = useMemo(() => tables.filter(t => t.status === "closed"), [tables]);
  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);
  const tablesWithResults = useMemo(() => tables.filter(t => t.closing_result !== null && t.status === "open"), [tables]);
  const hasResults = tablesWithResults.length > 0;

  const { data: trackerData = [] } = useTableTracker(date);

  const shiftTransactions = useMemo(() => {
    if (!shift) return transactions;
    return transactions.filter(t => t.shift_id === shift.id);
  }, [transactions, shift]);

  const snapshotIndex = useMemo(() => buildLatestTableSnapshot(snapshots as any), [snapshots]);

  const tableStats = useMemo(() => {
    const stats: Record<string, { dropR: number; dropV: number; result: number }> = {};
    tables.forEach(t => {
      const dropR = shiftTransactions
        .filter(tx => tx.table_id === t.id && (tx.type === "buy" || tx.type === "in"))
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const dropV = trackerData
        .filter(tr => tr.table_id === t.id)
        .reduce((s, tr) => s + Number(tr.value), 0);
      const result = liveTableResult({
        tableId: t.id,
        closingResult: t.closing_result as any,
        trackerData: trackerData as any,
        snapshotIndex,
        baselineMap,
      });
      stats[t.id] = { dropR, dropV, result };
    });
    return stats;
  }, [tables, shiftTransactions, trackerData, snapshotIndex, baselineMap]);

  // Chip Count operates only on TABLES (Pit only deals with tables)
  // Latest snapshot per table for prefill
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

  const countLocations = useMemo(() => {
    return openTables.map(t => ({
      key: `table-${t.id}`,
      label: t.name,
      type: "table" as const,
      id: t.id,
      denoms: t.denominations || [],
    }));
  }, [openTables]);

  // Default value for a (table, denom) input: latest snapshot → baseline (float)
  const getDefaultCount = (tableId: string, denom: number): number => {
    const snap = latestSnapshotPerTable[tableId]?.[denom];
    if (snap !== undefined) return snap;
    return baselineMap[tableId]?.[denom] ?? 0;
  };

  const handleOpenChipCount = () => {
    // Prefill from baseline / last snapshot so the first count of the shift shows the float
    const initial: Record<string, Record<number, number>> = {};
    countLocations.forEach(loc => {
      initial[loc.key] = {};
      loc.denoms.forEach(d => {
        initial[loc.key][d] = getDefaultCount(loc.id, d);
      });
    });
    setCounts(initial);
    setShowCount(true);
  };

  const handleSaveCount = () => {
    const rows: Array<{
      location_type: string; location_id: string | null;
      denomination: number; expected_quantity: number; actual_quantity: number;
    }> = [];
    countLocations.forEach(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id] || {};
      loc.denoms.forEach(d => {
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] ?? expected;
        rows.push({ location_type: loc.type, location_id: loc.id, denomination: d, expected_quantity: expected, actual_quantity: actual });
      });
    });
    batchSnapshot.mutate({ date, counts: rows }, {
      onSuccess: () => {
        setCounts({});
        setShowCount(false);
      },
    });
  };

  const handleOpenAll = () => {
    const ids = closedTables.map(t => t.id);
    openAllTables.mutate(ids);
  };

  // Live result preview per table inside Chip Count dialog
  const countResultPreview = useMemo(() => {
    return countLocations.map(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id] || {};
      let total = 0;
      loc.denoms.forEach(d => {
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] ?? expected;
        total += (actual - expected) * d;
      });
      return { id: loc.id, label: loc.label, total };
    });
  }, [countLocations, counts, baselineMap]);

  const gameTypeTotals = useMemo(() => {
    const totals: Record<string, { dropR: number; dropV: number; result: number; label: string }> = {};
    const gameLabels: Record<string, string> = { "American Roulette": "Total ARs", "Poker": "Total P", "Blackjack": "Total BJ" };
    tables.forEach(t => {
      const label = gameLabels[t.game] || `Total ${t.game}`;
      if (!totals[t.game]) totals[t.game] = { dropR: 0, dropV: 0, result: 0, label };
      const r = tableStats[t.id] || { dropR: 0, dropV: 0, result: 0 };
      totals[t.game].dropR += r.dropR;
      totals[t.game].dropV += r.dropV;
      totals[t.game].result += r.result;
    });
    return totals;
  }, [tables, tableStats]);

  const totalDropR = Object.values(tableStats).reduce((s, r) => s + r.dropR, 0);
  const totalDropV = Object.values(tableStats).reduce((s, r) => s + r.dropV, 0);
  const totalResult = Object.values(tableStats).reduce((s, r) => s + r.result, 0);

  const pokerGames = ["Poker", "Texas Holdem", "Omaha", "PLO"];
  const leftTables = tables.filter(t => !pokerGames.includes(t.game)).sort((a, b) => a.name.localeCompare(b.name));
  const rightTables = tables.filter(t => pokerGames.includes(t.game)).sort((a, b) => a.name.localeCompare(b.name));

  const renderTableCard = (table: typeof tables[0]) => {
    const r = tableStats[table.id] || { dropR: 0, dropV: 0, result: 0 };
    const isOpen = table.status === "open";
    const hasTableResult = table.closing_result !== null;

    return (
      <div key={table.id} className="cms-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isOpen ? "bg-success" : "bg-destructive"}`} />
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">{table.name}</h3>
              <p className="text-xs text-muted-foreground">{table.game}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isOpen ? "default" : "secondary"} className="text-[10px] uppercase">{table.status}</Badge>
            {hasTableResult && (
              <Badge variant={Number(table.closing_result) >= 0 ? "default" : "destructive"} className="text-[10px] font-mono">
                Result: {Number(table.closing_result) >= 0 ? "+" : ""}{formatCurrency(Number(table.closing_result))}
              </Badge>
            )}
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Drop R</p>
            <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(r.dropR)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Drop V</p>
            <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(r.dropV)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Result</p>
            <p className={`font-mono text-xs font-bold ${r.result >= 0 ? "text-success" : "text-destructive"}`}>
              {r.result >= 0 ? "+" : ""}{formatCurrency(r.result)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageShell>
      <PageHeader
        icon={LayoutGrid}
        title="Tables & Chip Accounting"
        subtitle="Float, Result & Tracking"
      >
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-44 font-mono h-9"
        />

        {closedTables.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleOpenAll} disabled={openAllTables.isPending} className="gap-1.5">
            <Play className="w-4 h-4" /> Open{closedTables.length < tables.length ? ` (${closedTables.length})` : " All"}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleOpenChipCount} disabled={openTables.length === 0} className="gap-1.5">
          <Coins className="w-4 h-4" /> Chip Count
        </Button>

        <Button size="sm" onClick={() => setShowCloseWizard(true)} disabled={openTables.length === 0} className="gap-1.5">
          <Lock className="w-4 h-4" /> Close Table
        </Button>

        {hasResults && tablesWithResults.length === openTables.length && (
          <Badge variant="outline" className="text-xs gap-1 border-success text-success">
            <Lock className="w-3 h-3" /> All counted — ready to close
          </Badge>
        )}
      </PageHeader>

      <>


      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${Object.keys(gameTypeTotals).length + 1}, minmax(0, 1fr))` }}>
        {Object.entries(gameTypeTotals).map(([game, t]) => (
          <div key={game} className="cms-panel p-2">
            <p className="text-[9px] uppercase text-muted-foreground tracking-wider">{t.label}</p>
            <p className={`font-mono text-sm font-bold ${t.result >= 0 ? "text-success" : "text-destructive"}`}>
              {t.result >= 0 ? "+" : ""}{formatCurrency(t.result)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">R: {formatCurrency(t.dropR)} · V: {formatCurrency(t.dropV)}</p>
          </div>
        ))}
        <div className="cms-panel p-2 border-primary/30">
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Total Casino</p>
          <p className={`font-mono text-sm font-bold ${totalResult >= 0 ? "text-success" : "text-destructive"}`}>
            {totalResult >= 0 ? "+" : ""}{formatCurrency(totalResult)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">R: {formatCurrency(totalDropR)} · V: {formatCurrency(totalDropV)}</p>
        </div>
      </div>

      {/* Chip Count inline panel — tables as rows, denominations as columns */}
      {showCount && (
        <div className="cms-panel mb-4 border-primary/30">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Chip Count — Tables (mid-shift snapshot)</h3>
              <p className="text-[10px] text-muted-foreground">Rows: tables · Columns: denominations</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveCount} disabled={batchSnapshot.isPending} className="gap-1.5">
                <Save className="w-4 h-4" /> {batchSnapshot.isPending ? "Saving…" : "Save Snapshot"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowCount(false)} title="Close">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {(() => {
            const visibleDenoms = CHIP_DENOMS.filter(d =>
              countLocations.some(loc => loc.denoms.includes(d))
            );
            return (
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse w-full table-fixed">
                  <colgroup>
                    <col style={{ width: "72px" }} />
                    {visibleDenoms.map(d => (
                      <col key={d} />
                    ))}
                    <col style={{ width: "96px" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted-foreground font-medium sticky left-0 bg-card z-10">
                        Table
                      </th>
                      {visibleDenoms.map(d => (
                        <th key={d} className="text-center py-2 px-0.5 font-medium">
                          <span className={`cms-chip text-[8px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>
                            {formatChipLabel(d)}
                          </span>
                        </th>
                      ))}
                      <th className="text-right py-2 px-2 text-muted-foreground font-medium">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {countLocations.map((loc, ri) => {
                      const locCounts = counts[loc.key] || {};
                      const tableBaseline = baselineMap[loc.id] || {};
                      let rowResult = 0;
                      visibleDenoms.forEach(d => {
                        if (!loc.denoms.includes(d)) return;
                        const expected = tableBaseline[d] || 0;
                        const actual = locCounts[d] ?? expected;
                        rowResult += (actual - expected) * d;
                      });
                      return (
                        <tr key={loc.key} className={`border-b border-border last:border-0 ${ri % 2 === 1 ? "bg-muted/10" : ""}`}>
                          <td className={`py-1 px-2 font-medium text-card-foreground sticky left-0 z-10 ${ri % 2 === 1 ? "bg-card/95" : "bg-card"}`}>
                            {loc.label}
                          </td>
                          {visibleDenoms.map(d => {
                            if (!loc.denoms.includes(d)) {
                              return <td key={d} className="px-1 py-0.5 text-center text-muted-foreground/30">—</td>;
                            }
                            const bsl = tableBaseline[d] || 0;
                            return (
                              <td key={d} className="px-1 py-0.5">
                                <input
                                  type="number" min="0"
                                  value={locCounts[d] ?? ""}
                                  onChange={e => {
                                    const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                    setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: isNaN(val) ? 0 : val } }));
                                  }}
                                  className="w-full h-7 rounded text-[11px] font-mono text-center border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-card-foreground"
                                  placeholder={String(bsl)}
                                />
                              </td>
                            );
                          })}
                          <td className={`px-2 py-1 text-right font-mono text-xs font-bold ${rowResult >= 0 ? "text-success" : "text-destructive"}`}>
                            {rowResult >= 0 ? "+" : ""}{formatCurrency(rowResult)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-primary/30 bg-muted/30">
                      <td className="py-2 px-2 text-xs font-bold uppercase text-card-foreground sticky left-0 bg-muted/30 z-10">
                        Total
                      </td>
                      <td colSpan={visibleDenoms.length} />
                      <td className={`px-2 py-2 text-right font-mono text-sm font-bold ${countResultPreview.reduce((s, r) => s + r.total, 0) >= 0 ? "text-success" : "text-destructive"}`}>
                        {countResultPreview.reduce((s, r) => s + r.total, 0) >= 0 ? "+" : ""}
                        {formatCurrency(countResultPreview.reduce((s, r) => s + r.total, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {hasResults && (
        <div className="cms-panel p-4 mb-4 border-success/30">
          <p className="text-xs font-semibold text-card-foreground mb-2">📊 Table Results (waiting for Cashier to close)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {tablesWithResults.map(t => (
              <div key={t.id} className="p-2 rounded bg-muted/30 text-center">
                <p className="text-xs font-medium text-card-foreground">{t.name}</p>
                <p className={`font-mono text-sm font-bold ${Number(t.closing_result) >= 0 ? "text-success" : "text-destructive"}`}>
                  {Number(t.closing_result) >= 0 ? "+" : ""}{formatCurrency(Number(t.closing_result))}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Total chip result: <span className="font-mono font-bold">{formatCurrency(tablesWithResults.reduce((s, t) => s + Number(t.closing_result || 0), 0))}</span>
          </p>
        </div>
      )}

      {/* Two-column Table Cards */}
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

      {/* Close Table Wizard */}
      <CloseTableWizard
        open={showCloseWizard}
        onClose={() => setShowCloseWizard(false)}
        tables={tables as any}
        date={date}
      />
      </>
    </PageShell>
  );
};

export default Tables;
