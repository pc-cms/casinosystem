import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Maximize2, Minimize2, History } from "lucide-react";
import { useChipSnapshots, useBatchChipSnapshot } from "@/hooks/use-chips";
import { useChipBaseline, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useGamingTables, useSetTableTrackerValue } from "@/hooks/use-casino-data";
import { CHIP_DENOMS, formatChipLabel, formatCurrency } from "@/lib/currency";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useChipColors, resolveChipColor } from "@/hooks/use-chip-colors";
import { nowEAT } from "@/lib/business-day";

/** Compute the Number-Count tracker slot for a Chip Count taken at the given EAT time.
 *  Window: HH:50–HH+1:10 → slot HH+1:00. Otherwise null (no auto-write).
 *  Slots are constrained to 18:00..04:00 (live-game window). */
const slotForChipCount = (now: Date): string | null => {
  const h = now.getHours();
  const m = now.getMinutes();
  let targetH: number;
  if (m >= 50) targetH = (h + 1) % 24;
  else if (m <= 10) targetH = h;
  else return null;
  // Allowed slots: 18..23 and 00..04
  const allowed = (targetH >= 18 && targetH <= 23) || (targetH >= 0 && targetH <= 4);
  if (!allowed) return null;
  return `${String(targetH).padStart(2, "0")}:00`;
};

interface ChipCountPanelProps {
  date: string;
}

/**
 * Chip Count grid — tables as rows, denominations as columns.
 * Tablet-optimized: compact cells, sticky first column, single horizontal scroll.
 */
export const ChipCountPanel = ({ date }: ChipCountPanelProps) => {
  const { data: tables = [] } = useGamingTables();
  const { data: snapshots = [] } = useChipSnapshots(date);
  const { data: baseline = [] } = useChipBaseline();
  const { data: chipColorOverrides } = useChipColors();
  const batchSnapshot = useBatchChipSnapshot();

  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);
  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);

  const countLocations = useMemo(() => {
    return openTables.map(t => ({
      key: `table-${t.id}`,
      label: t.name,
      type: "table" as const,
      id: t.id,
      denoms: t.denominations || [],
    }));
  }, [openTables]);

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

  const getDefault = (tableId: string, denom: number): number => {
    const snap = latestSnapshotPerTable[tableId]?.[denom];
    if (snap !== undefined) return snap;
    return baselineMap[tableId]?.[denom] ?? 0;
  };

  const [counts, setCounts] = useState<Record<string, Record<number, number>>>({});
  const [fullscreen, setFullscreen] = useState(false);

  // Initialize / refresh prefill when underlying data changes
  useEffect(() => {
    const initial: Record<string, Record<number, number>> = {};
    countLocations.forEach(loc => {
      initial[loc.key] = {};
      loc.denoms.forEach(d => {
        initial[loc.key][d] = getDefault(loc.id, d);
      });
    });
    setCounts(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countLocations.length, snapshots.length, baseline.length]);

  const visibleDenoms = useMemo(
    () => CHIP_DENOMS.filter(d => countLocations.some(loc => loc.denoms.includes(d))),
    [countLocations]
  );

  const rowResults = useMemo(() => {
    return countLocations.map(loc => {
      const locCounts = counts[loc.key] || {};
      const tableBaseline = baselineMap[loc.id] || {};
      let total = 0;
      visibleDenoms.forEach(d => {
        if (!loc.denoms.includes(d)) return;
        const expected = tableBaseline[d] || 0;
        const actual = locCounts[d] ?? expected;
        total += (actual - expected) * d;
      });
      return { key: loc.key, total };
    });
  }, [countLocations, counts, baselineMap, visibleDenoms]);

  const grandTotal = rowResults.reduce((s, r) => s + r.total, 0);

  const setTrackerValue = useSetTableTrackerValue();

  const handleSave = () => {
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
    batchSnapshot.mutate({ date, counts: rows });

    // Auto-write per-table row result into Number Count tracker for the rounded slot
    // (HH:50–HH+1:10 → slot HH+1:00 / HH:00).
    const slot = slotForChipCount(nowEAT());
    if (slot) {
      countLocations.forEach((loc, ri) => {
        const total = rowResults[ri]?.total ?? 0;
        setTrackerValue.mutate({ table_id: loc.id, date, time_slot: slot, value: total });
      });
    }
  };

  if (openTables.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No open tables</p>;
  }

  const renderGrid = (full: boolean) => {
    // Unified chip token (cms-chip-token / -lg). Cells are sized for max 3 digits since
    // there are never more than 500 chips of one denomination on a single table.
    const t = full
      ? {
          chipClass: "cms-chip-token cms-chip-token-lg",
          inputH: "h-9",
          inputText: "text-sm",
          firstColW: "64px",
          chipColW: "60px",
          resultColW: "170px",
          rowPadX: "px-1",
          rowPadY: "py-1.5",
          headerPadY: "py-2",
          totalText: "text-base",
          resultText: "text-sm",
        }
      : {
          chipClass: "cms-chip-token",
          inputH: "h-8",
          inputText: "text-xs",
          firstColW: "56px",
          chipColW: "52px",
          resultColW: "140px",
          rowPadX: "px-1",
          rowPadY: "py-1",
          headerPadY: "py-2",
          totalText: "text-sm",
          resultText: "text-xs",
        };

    return (
      <div className={`rounded-md border border-border bg-card ${full ? "h-full flex flex-col" : ""}`}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Chip Count</h3>
            <p className="text-[10px] text-muted-foreground">Rows: tables · Columns: denominations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFullscreen(f => !f)}
              className="gap-1.5 h-8"
              title={fullscreen ? "Exit fullscreen" : "Open fullscreen"}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{fullscreen ? "Exit" : "Fullscreen"}</span>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={batchSnapshot.isPending} className="gap-1.5 h-8">
              <Save className="w-4 h-4" /> {batchSnapshot.isPending ? "Saving…" : "Save Snapshot"}
            </Button>
          </div>
        </div>
        <div className={`overflow-auto ${full ? "flex-1" : ""}`}>
          <table className="border-collapse w-full">
            <colgroup>
              <col style={{ width: t.firstColW }} />
              {visibleDenoms.map(d => (
                <col key={d} style={{ width: t.chipColW }} />
              ))}
              <col style={{ width: t.resultColW }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <th className={`text-left ${t.headerPadY} px-2 text-muted-foreground font-medium sticky left-0 bg-card z-10 text-xs uppercase tracking-wider`}>
                  Table
                </th>
                {visibleDenoms.map(d => {
                  const c = resolveChipColor(d, chipColorOverrides);
                  return (
                    <th key={d} className={`text-center ${t.headerPadY} px-0.5 font-medium`}>
                      <span
                        className={t.chipClass}
                        style={{ backgroundColor: c.bg, color: c.text }}
                      >
                        {formatChipLabel(d)}
                      </span>
                    </th>
                  );
                })}
                <th className={`text-right ${t.headerPadY} px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider`}>Result</th>
              </tr>
            </thead>
            <tbody>
              {countLocations.map((loc, ri) => {
                const locCounts = counts[loc.key] || {};
                const tableBaseline = baselineMap[loc.id] || {};
                const rowResult = rowResults[ri]?.total ?? 0;
                return (
                  <tr key={loc.key} className={`border-b border-border last:border-0 ${ri % 2 === 1 ? "bg-muted/10" : ""}`}>
                    <td
                      className={`${t.rowPadY} px-2 font-semibold text-card-foreground sticky left-0 z-10 whitespace-nowrap ${full ? "text-sm" : "text-xs"} ${ri % 2 === 1 ? "bg-card/95" : "bg-card"}`}
                    >
                      {loc.label}
                    </td>
                    {visibleDenoms.map(d => {
                      if (!loc.denoms.includes(d)) {
                        return <td key={d} className={`${t.rowPadX} ${t.rowPadY} text-center text-muted-foreground/30`}>·</td>;
                      }
                      const bsl = tableBaseline[d] || 0;
                      const current = locCounts[d] ?? getDefault(loc.id, d);
                      return (
                        <td key={d} className={`${t.rowPadX} ${t.rowPadY}`}>
                          <input
                            type="number" min="0" max="999" maxLength={3}
                            value={Number.isNaN(current as any) ? "" : current}
                            onFocus={e => {
                              // Remember previous value on the element for blur-restore on misclicks
                              (e.target as any).dataset.prev = String(current);
                              e.target.value = "";
                              setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: NaN as any } }));
                              requestAnimationFrame(() => e.target.select());
                            }}
                            onChange={e => {
                              if (e.target.value === "") {
                                setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: NaN as any } }));
                                return;
                              }
                              let val = parseInt(e.target.value, 10);
                              if (isNaN(val)) return;
                              if (val > 999) val = 999;
                              if (val < 0) val = 0;
                              setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: val } }));
                            }}
                            onBlur={e => {
                              const raw = e.target.value;
                              if (raw === "" || isNaN(parseInt(raw, 10))) {
                                const prev = Number((e.target as any).dataset.prev ?? current);
                                setCounts(c => ({ ...c, [loc.key]: { ...(c[loc.key] || {}), [d]: prev } }));
                              }
                            }}
                            className={`no-spin w-full ${t.inputH} ${t.inputText} rounded font-mono text-center border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-card-foreground`}
                            placeholder={String(bsl)}
                          />
                        </td>
                      );
                    })}
                    <td className={`px-2 ${t.rowPadY} text-right font-mono ${t.resultText} font-bold whitespace-nowrap ${rowResult >= 0 ? "text-success" : "text-destructive"}`}>
                      {rowResult >= 0 ? "+" : ""}{formatCurrency(rowResult)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-primary/30 bg-muted/30">
                <td className={`py-2 px-2 ${t.totalText} font-bold uppercase text-card-foreground sticky left-0 bg-muted/30 z-10`}>
                  Total
                </td>
                <td colSpan={visibleDenoms.length} />
                <td className={`px-2 py-2 text-right font-mono ${t.totalText} font-bold whitespace-nowrap ${grandTotal >= 0 ? "text-success" : "text-destructive"}`}>
                  {grandTotal >= 0 ? "+" : ""}{formatCurrency(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ===== Snapshot history (per save = group of rows sharing created_at) =====
  const history = useMemo(() => {
    const groups: Record<string, { ts: string; perTable: Record<string, number>; total: number }> = {};
    snapshots.forEach((s: any) => {
      if (s.location_type !== "table" || !s.location_id) return;
      const ts = s.created_at;
      if (!groups[ts]) groups[ts] = { ts, perTable: {}, total: 0 };
      const expected = baselineMap[s.location_id]?.[Number(s.denomination)] ?? Number(s.expected_quantity || 0);
      const delta = (Number(s.actual_quantity) - expected) * Number(s.denomination);
      groups[ts].perTable[s.location_id] = (groups[ts].perTable[s.location_id] || 0) + delta;
      groups[ts].total += delta;
    });
    return Object.values(groups).sort((a, b) => b.ts.localeCompare(a.ts));
  }, [snapshots, baselineMap]);

  return (
    <>
      {renderGrid(false)}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[96vh] p-0 sm:rounded-lg overflow-hidden flex flex-col">
          {renderGrid(true)}
        </DialogContent>
      </Dialog>

      {history.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <History className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-card-foreground">Snapshot history · {date}</h4>
            <span className="text-[10px] text-muted-foreground ml-auto">{history.length} saves</span>
          </div>
          <div className="overflow-auto max-h-[280px]">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Time</th>
                  {countLocations.map(loc => (
                    <th key={loc.id} className="text-right px-2 py-1.5 font-medium text-muted-foreground text-[10px]">{loc.label}</th>
                  ))}
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g, i) => {
                  const time = new Date(g.ts).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={g.ts} className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                      <td className="px-2 py-1 font-mono text-card-foreground">{time}</td>
                      {countLocations.map(loc => {
                        const v = g.perTable[loc.id];
                        if (v === undefined) return <td key={loc.id} className="px-2 py-1 text-right text-muted-foreground/30">·</td>;
                        return (
                          <td key={loc.id} className={`px-2 py-1 text-right font-mono ${v >= 0 ? "text-success" : "text-destructive"}`}>
                            {v >= 0 ? "+" : ""}{formatCurrency(v)}
                          </td>
                        );
                      })}
                      <td className={`px-2 py-1 text-right font-mono font-bold ${g.total >= 0 ? "text-success" : "text-destructive"}`}>
                        {g.total >= 0 ? "+" : ""}{formatCurrency(g.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
