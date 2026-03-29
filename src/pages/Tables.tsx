import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useGamingTables, useTransactions } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import { useChipSnapshots, useBatchChipSnapshot } from "@/hooks/use-chips";
import { useChipBaseline, useOpenAllTables, useSetTableResults, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency } from "@/lib/currency";
import { Save, BarChart3, Lock } from "lucide-react";
import ChipDenomInput from "@/components/ChipDenomInput";
import ActivePlayers from "@/components/pit/ActivePlayers";
import ClientTracker from "@/components/pit/ClientTracker";
import { useTableTracker, useSetTableTrackerValue } from "@/hooks/use-casino-data";
import { formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";

// ========== TABLE TRACKER ==========
const generateSlots = () => {
  const slots: string[] = [];
  for (let h = 18; h <= 28; h++) {
    if (h === 29) break;
    const hour = h % 24;
    slots.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return slots;
};
const TRACKER_SLOTS = generateSlots();
const getCurrentSlot = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:00`;
};

const Tables = () => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "tables";

  return (
    <div>
      {activeTab === "tables" && <TablesContent />}
      {activeTab === "tracker" && <TrackerContent />}
      {activeTab === "players" && (
        <div>
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-foreground">Active Players</h1>
            <p className="text-sm text-muted-foreground">Players currently in the hall</p>
          </div>
          <ActivePlayers />
        </div>
      )}
      {activeTab === "client-tracker" && (
        <div>
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-foreground">Client Tracker</h1>
            <p className="text-sm text-muted-foreground">Track player sessions and total bet</p>
          </div>
          <ClientTracker />
        </div>
      )}
    </div>
  );
};

// ========== TRACKER CONTENT ==========
const TrackerContent = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const { data: tables = [] } = useGamingTables();
  const { data: trackerData = [] } = useTableTracker(date);
  const setTrackerValue = useSetTableTrackerValue();
  const currentSlot = getCurrentSlot();

  const getValue = useCallback((tableId: string, slot: string) => {
    const entry = trackerData.find((d: any) => d.table_id === tableId && d.time_slot === slot);
    return entry ? Number(entry.value) : 0;
  }, [trackerData]);

  const handleSave = useCallback((tableId: string, slot: string, raw: string) => {
    const num = parseSpacedNumber(raw);
    if (isNaN(num) || num < 0) return;
    setTrackerValue.mutate({ table_id: tableId, date, time_slot: slot, value: num });
  }, [date, setTrackerValue]);

  const tableSlotTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    tables.forEach(t => { totals[t.id] = TRACKER_SLOTS.reduce((s, slot) => s + getValue(t.id, slot), 0); });
    return totals;
  }, [tables, getValue]);

  const slotTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    TRACKER_SLOTS.forEach(slot => { totals[slot] = tables.reduce((s, t) => s + getValue(t.id, slot), 0); });
    return totals;
  }, [tables, getValue]);

  const grandTotal = Object.values(tableSlotTotals).reduce((s, v) => s + v, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Table Tracker</h1>
          <p className="text-sm text-muted-foreground">Hourly table results</p>
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
      </div>
      <div className="cms-panel overflow-x-auto">
        <div className="min-w-[1000px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-0 bg-card z-10 min-w-[120px]">Table</th>
                {TRACKER_SLOTS.map(slot => {
                  const isCurrent = slot === currentSlot && date === today;
                  return (
                    <th key={slot} className={`text-center px-1 py-2 min-w-[80px] text-xs font-mono ${isCurrent ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground"}`}>
                      {slot}
                    </th>
                  );
                })}
                <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[90px]">Result</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table, idx) => (
                <tr key={table.id} className={`border-b border-border ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                  <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>{table.name}</td>
                  {TRACKER_SLOTS.map(slot => {
                    const val = getValue(table.id, slot);
                    const isCurrent = slot === currentSlot && date === today;
                    return (
                      <td key={slot} className={`px-0.5 py-0.5 ${isCurrent ? "bg-primary/10" : ""}`}>
                        <input type="text" defaultValue={val ? formatInputWithSpaces(String(val)) : ""} key={`${table.id}-${slot}-${val}`}
                          onChange={e => { e.target.value = formatInputWithSpaces(e.target.value); }}
                          onBlur={e => handleSave(table.id, slot, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="w-full h-7 rounded text-[10px] font-mono text-center border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary text-card-foreground"
                          placeholder="0" />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    {table.closing_result !== null ? (
                      <span className={`text-[10px] font-mono font-bold ${Number(table.closing_result) >= 0 ? "text-green-500" : "text-destructive"}`}>
                        {Number(table.closing_result) >= 0 ? "+" : ""}{formatCurrency(Number(table.closing_result))}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="px-3 py-2 text-xs font-bold text-card-foreground sticky left-0 bg-muted/20 z-10">TOTAL</td>
                {TRACKER_SLOTS.map(slot => (
                  <td key={slot} className="px-1 py-2 text-center">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">{slotTotals[slot] ? formatCurrency(slotTotals[slot]) : ""}</span>
                  </td>
                ))}
                <td className="px-2 py-2 text-center">
                  <span className="text-xs font-mono font-bold text-primary">
                    {tables.some(t => t.closing_result !== null)
                      ? formatCurrency(tables.reduce((s, t) => s + Number(t.closing_result || 0), 0))
                      : ""}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ========== TABLES CONTENT ==========
const TablesContent = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date] = useState(today);
  const { data: tables = [] } = useGamingTables();
  const { data: baseline = [] } = useChipBaseline();
  const batchSnapshot = useBatchChipSnapshot();
  const setTableResults = useSetTableResults();

  const [counts, setCounts] = useState<Record<string, Record<number, number>>>({});
  const [showCount, setShowCount] = useState(false);
  const [countMode, setCountMode] = useState<"save" | "result">("save");

  // Baseline map: { tableId: { denom: qty } }
  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);

  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);
  const tablesWithResults = useMemo(() => tables.filter(t => t.closing_result !== null && t.status === "open"), [tables]);
  const hasResults = tablesWithResults.length > 0;

  // Locations for chip count dialog (only tables)
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

  // Handle opening chip count
  const handleOpenChipCount = (mode: "save" | "result") => {
    setCountMode(mode);
    setCounts({});
    setShowCount(true);
  };

  // Handle save chip count (snapshot only)
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
          // Also save closing_chips + closing_result per table
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
          setTableResults.mutate(results, {
            onSuccess: () => setShowResultSummary(true),
          });
        }
      },
    });
  };

  // Handle saving result directly (if already counted)
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

    // Also save snapshot
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
      onSuccess: () => { setCounts({}); setShowCount(false); setShowResultSummary(true); },
    });
  };

  // Open all closed tables
  const handleOpenAll = () => {
    const ids = closedTables.map(t => t.id);
    openAllTables.mutate(ids);
  };

  const hasAnyCount = Object.keys(counts).length > 0;

  // Compute result summary per table for the dialog
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




  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tables</h1>
          <p className="text-sm text-muted-foreground">Close tables · Record chip results</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Result — only when tables are open and no result set yet */}
          {openTables.length > 0 && !hasResults && (
            <Button variant="default" size="sm" onClick={() => handleOpenChipCount("result")} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
              <BarChart3 className="w-4 h-4" /> Result
            </Button>
          )}

          {/* Result ready indicator */}
          {hasResults && (
            <Badge variant="outline" className="text-xs gap-1 border-green-500 text-green-500">
              <Lock className="w-3 h-3" /> Results set — waiting for Cashier
            </Badge>
          )}
        </div>
      </div>

      {/* Result Summary Banner */}
      {hasResults && (
        <div className="cms-panel p-4 mb-4 border-green-500/30">
          <p className="text-xs font-semibold text-card-foreground mb-2">📊 Table Results (waiting for Cashier to close)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {tablesWithResults.map(t => (
              <div key={t.id} className="p-2 rounded bg-muted/30 text-center">
                <p className="text-xs font-medium text-card-foreground">{t.name}</p>
                <p className={`font-mono text-sm font-bold ${Number(t.closing_result) >= 0 ? "text-green-500" : "text-destructive"}`}>
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

      {!hasResults && openTables.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">No open tables to close</p>
      )}

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

          {/* Result summary when in result mode */}
          {countMode === "result" && hasAnyCount && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-card-foreground">Result per Table (Actual − Baseline)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {resultSummary.map(r => (
                  <div key={r.id} className="cms-panel p-2">
                    <p className="text-xs font-medium text-card-foreground mb-1">{r.label}</p>
                    <p className={`font-mono text-sm font-bold ${r.total >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {r.total >= 0 ? "+" : ""}{formatCurrency(r.total)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="cms-panel p-2 text-center border-primary/30">
                <p className="text-[9px] uppercase text-muted-foreground">Total Chip Result</p>
                <p className={`font-mono text-lg font-bold ${resultSummary.reduce((s, r) => s + r.total, 0) >= 0 ? "text-green-500" : "text-destructive"}`}>
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

    </div>
  );
};

export default Tables;
