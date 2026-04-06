import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useGamingTables, useTransactions, useTableTracker } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import { useChipSnapshots, useBatchChipSnapshot } from "@/hooks/use-chips";
import { useChipBaseline, useOpenAllTables, useSetTableResults, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency } from "@/lib/currency";
import { Save, Coins, Play, BarChart3, Lock, Users, Eye, Target } from "lucide-react";
import ChipDenomInput from "@/components/ChipDenomInput";
import ActivePlayers from "@/components/pit/ActivePlayers";
import ClientTracker from "@/components/pit/PlayerTracker";
import TableTracker from "@/pages/TableTracker";

const PIT_TABS = [
  { key: "tables", label: "Tables", icon: BarChart3 },
  { key: "activeplayers", label: "Active Players", icon: Users },
  { key: "tracker", label: "Player Tracker", icon: Eye },
  { key: "tabletracker", label: "Table Tracker", icon: Target },
] as const;

const Tables = () => {
  const { roles } = useAuth();
  const isPit = roles.includes("pit") || roles.includes("manager") || roles.includes("finance_manager");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "tables";
  const businessDay = getBusinessDate();
  const [date, setDate] = useState(businessDay);
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(date);
  const { data: shift } = useActiveShift();
  const { data: snapshots = [] } = useChipSnapshots(date);
  const { data: baseline = [] } = useChipBaseline();
  const batchSnapshot = useBatchChipSnapshot();
  const openAllTables = useOpenAllTables();
  const setTableResults = useSetTableResults();

  const [counts, setCounts] = useState<Record<string, Record<number, number>>>({});
  const [showCount, setShowCount] = useState(false);
  const [countMode, setCountMode] = useState<"save" | "result">("save");

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

  const tableStats = useMemo(() => {
    const stats: Record<string, { dropR: number; dropV: number; result: number }> = {};
    tables.forEach(t => {
      const dropR = shiftTransactions
        .filter(tx => tx.table_id === t.id && tx.type === "buy")
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const dropV = trackerData
        .filter(tr => tr.table_id === t.id)
        .reduce((s, tr) => s + Number(tr.value), 0);
      const result = t.closing_result !== null ? Number(t.closing_result) : dropV;
      stats[t.id] = { dropR, dropV, result };
    });
    return stats;
  }, [tables, shiftTransactions, trackerData]);

  const locations = useMemo(() => {
    const targetTables = countMode === "result" ? openTables : tables;
    return targetTables.map(t => ({
      key: `table-${t.id}`,
      label: t.name,
      type: "table" as const,
      id: t.id,
      denoms: t.denominations || [],
    }));
  }, [tables, openTables, countMode]);

  const handleOpenChipCount = (mode: "save" | "result") => {
    setCountMode(mode);
    setCounts({});
    setShowCount(true);
  };

  const handleSaveCount = () => {
    const rows: Array<{
      location_type: string; location_id: string | null;
      denomination: number; expected_quantity: number; actual_quantity: number;
    }> = [];
    locations.forEach(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id!] || {};
      loc.denoms.forEach(d => {
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] !== undefined ? locCounts[d] : expected;
        rows.push({ location_type: loc.type, location_id: loc.id, denomination: d, expected_quantity: expected, actual_quantity: actual });
      });
    });
    batchSnapshot.mutate({ date, counts: rows }, {
      onSuccess: () => {
        setCounts({});
        setShowCount(false);
        if (countMode === "result") {
          const results = locations.map(loc => {
            const locCounts = counts[loc.key] || {};
            const tableBaseline = baselineMap[loc.id!] || {};
            let resultValue = 0;
            const chipMap: Record<string, number> = {};
            loc.denoms.forEach(d => {
              const expected = tableBaseline[d] || 0;
              const actual = locCounts[d] !== undefined ? locCounts[d] : expected;
              chipMap[String(d)] = actual;
              resultValue += (actual - expected) * d;
            });
            return { table_id: loc.id!, closing_chips: chipMap, closing_result: resultValue };
          });
          setTableResults.mutate(results);
        }
      },
    });
  };

  const handleConfirmResult = () => {
    const results = locations.map(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id!] || {};
      let resultValue = 0;
      const chipMap: Record<string, number> = {};
      loc.denoms.forEach(d => {
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] !== undefined ? locCounts[d] : expected;
        chipMap[String(d)] = actual;
        resultValue += (actual - expected) * d;
      });
      return { table_id: loc.id!, closing_chips: chipMap, closing_result: resultValue };
    });

    const snapRows: Array<{
      location_type: string; location_id: string | null;
      denomination: number; expected_quantity: number; actual_quantity: number;
    }> = [];
    locations.forEach(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id!] || {};
      loc.denoms.forEach(d => {
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] !== undefined ? locCounts[d] : expected;
        snapRows.push({ location_type: loc.type, location_id: loc.id, denomination: d, expected_quantity: expected, actual_quantity: actual });
      });
    });

    batchSnapshot.mutate({ date, counts: snapRows });
    setTableResults.mutate(results, {
      onSuccess: () => { setCounts({}); setShowCount(false); },
    });
  };

  const handleOpenAll = () => {
    const ids = closedTables.map(t => t.id);
    openAllTables.mutate(ids);
  };

  const hasAnyCount = Object.keys(counts).length > 0;

  const resultSummary = useMemo(() => {
    if (countMode !== "result") return [];
    return locations.map(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id!] || {};
      let total = 0;
      const denoms = loc.denoms.map(d => {
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] !== undefined ? locCounts[d] : expected;
        const diff = actual - expected;
        total += diff * d;
        return { denom: d, expected, actual, diff };
      }).filter(r => r.expected > 0 || r.actual > 0);
      return { label: loc.label, id: loc.id, denoms, total };
    });
  }, [locations, counts, baselineMap, countMode]);

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tables & Chip Accounting</h1>
          <p className="text-sm text-muted-foreground">Float, Result & Tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />

          {closedTables.length > 0 && (
            <Button variant="default" size="sm" onClick={handleOpenAll} disabled={openAllTables.isPending} className="gap-1.5">
              <Play className="w-4 h-4" /> Open{closedTables.length < tables.length ? ` (${closedTables.length})` : " All"}
            </Button>
          )}

          <Button size="sm" onClick={() => handleOpenChipCount("save")} className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white border-0">
            <Coins className="w-4 h-4" /> Chip Count
          </Button>

          {openTables.length > 0 && !hasResults && (
            <Button variant="default" size="sm" onClick={() => handleOpenChipCount("result")} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
              <BarChart3 className="w-4 h-4" /> Result
            </Button>
          )}

          {hasResults && (
            <Badge variant="outline" className="text-xs gap-1 border-success text-success">
              <Lock className="w-3 h-3" /> Results set — waiting for Cashier
            </Badge>
          )}
        </div>
      </div>

      {/* Pit-role tabs */}
      {isPit && (
        <div className="flex gap-1 mb-4 border-b border-border pb-2">
          {PIT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSearchParams(tab.key === "tables" ? {} : { tab: tab.key })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "activeplayers" && isPit && <ActivePlayers />}
      {activeTab === "tracker" && isPit && <ClientTracker />}
      {activeTab === "tabletracker" && isPit && <TableTracker />}

      {activeTab === "tables" && (
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

      {/* Result Summary Banner */}
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

      {/* Chip Count / Result Dialog */}
      <Dialog open={showCount} onOpenChange={setShowCount}>
        <DialogContent className="max-w-none w-auto overflow-visible" style={{ maxHeight: 'none' }}>
          <DialogHeader>
            <DialogTitle>
              {countMode === "result" ? "📊 Record Result — Count chips on each table" : "Chip Count — Per Table"}
            </DialogTitle>
          </DialogHeader>

          <div>
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium sticky left-0 bg-background z-10 min-w-[70px]">Denom</th>
                  {locations.map(loc => (
                    <th key={loc.key} className="text-center py-2 px-3 text-muted-foreground font-medium min-w-[80px] whitespace-nowrap">
                      {loc.label}
                      {countMode === "result" && baselineMap[loc.id!] && (
                        <span className="block text-[8px] text-muted-foreground/60 font-normal">baseline</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHIP_DENOMS.map(d => {
                  const anyLocationHasDenom = locations.some(loc => loc.denoms.includes(d));
                  if (!anyLocationHasDenom) return null;
                  return (
                    <tr key={d} className="border-b border-border last:border-0">
                      <td className="py-1 px-2 sticky left-0 bg-background z-10">
                        <span className={`cms-chip text-[8px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span>
                      </td>
                      {locations.map(loc => {
                        if (!loc.denoms.includes(d)) {
                          return <td key={loc.key} className="px-1 py-0.5 text-center text-muted-foreground/30">—</td>;
                        }
                        const locCounts = counts[loc.key] || {};
                        const bsl = baselineMap[loc.id!]?.[d] || 0;
                        return (
                          <td key={loc.key} className="px-1 py-0.5">
                            <input
                              type="number" min="0"
                              value={locCounts[d] ?? ""}
                              onChange={e => {
                                const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: isNaN(val) ? 0 : val } }));
                              }}
                              className="w-16 h-7 rounded text-[11px] font-mono text-center border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-card-foreground mx-auto block"
                              placeholder={String(bsl)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {countMode === "result" && hasAnyCount && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-card-foreground">Result per Table (Actual − Baseline)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {resultSummary.map(r => (
                  <div key={r.id} className="cms-panel p-2">
                    <p className="text-xs font-medium text-card-foreground mb-1">{r.label}</p>
                    <p className={`font-mono text-sm font-bold ${r.total >= 0 ? "text-success" : "text-destructive"}`}>
                      {r.total >= 0 ? "+" : ""}{formatCurrency(r.total)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="cms-panel p-2 text-center border-primary/30">
                <p className="text-[9px] uppercase text-muted-foreground">Total Chip Result</p>
                <p className={`font-mono text-lg font-bold ${resultSummary.reduce((s, r) => s + r.total, 0) >= 0 ? "text-success" : "text-destructive"}`}>
                  {resultSummary.reduce((s, r) => s + r.total, 0) >= 0 ? "+" : ""}{formatCurrency(resultSummary.reduce((s, r) => s + r.total, 0))}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCount(false)}>Cancel</Button>
            {countMode === "save" && (
              <Button onClick={handleSaveCount} disabled={batchSnapshot.isPending || !hasAnyCount} className="gap-1.5">
                <Save className="w-4 h-4" /> {batchSnapshot.isPending ? "Saving…" : "Save Chip Count"}
              </Button>
            )}
            {countMode === "result" && (
              <Button onClick={handleConfirmResult} disabled={setTableResults.isPending || batchSnapshot.isPending || !hasAnyCount}
                className="gap-1.5 bg-orange-600 hover:bg-orange-700">
                <BarChart3 className="w-4 h-4" /> {setTableResults.isPending ? "Saving…" : "Confirm Result"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
};

export default Tables;
