import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Maximize2, Minimize2 } from "lucide-react";
import { useChipSnapshots, useBatchChipSnapshot } from "@/hooks/use-chips";
import { useChipBaseline, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useGamingTables } from "@/hooks/use-casino-data";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency } from "@/lib/currency";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  };

  if (openTables.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No open tables</p>;
  }

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Chip Count</h3>
          <p className="text-[10px] text-muted-foreground">Rows: tables · Columns: denominations</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={batchSnapshot.isPending} className="gap-1.5 h-8">
          <Save className="w-4 h-4" /> {batchSnapshot.isPending ? "Saving…" : "Save Snapshot"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full table-fixed">
          <colgroup>
            <col style={{ width: "84px" }} />
            {visibleDenoms.map(d => (
              <col key={d} />
            ))}
            <col style={{ width: "100px" }} />
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
              <th className="text-right py-2 px-2 text-muted-foreground font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {countLocations.map((loc, ri) => {
              const locCounts = counts[loc.key] || {};
              const tableBaseline = baselineMap[loc.id] || {};
              const rowResult = rowResults[ri]?.total ?? 0;
              return (
                <tr key={loc.key} className={`border-b border-border last:border-0 ${ri % 2 === 1 ? "bg-muted/10" : ""}`}>
                  <td className={`py-1 px-2 font-medium text-card-foreground sticky left-0 z-10 ${ri % 2 === 1 ? "bg-card/95" : "bg-card"}`}>
                    {loc.label}
                  </td>
                  {visibleDenoms.map(d => {
                    if (!loc.denoms.includes(d)) {
                      return <td key={d} className="px-1 py-0.5 text-center text-muted-foreground/30">·</td>;
                    }
                    const bsl = tableBaseline[d] || 0;
                    return (
                      <td key={d} className="px-0.5 py-0.5">
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
              <td className={`px-2 py-2 text-right font-mono text-sm font-bold ${grandTotal >= 0 ? "text-success" : "text-destructive"}`}>
                {grandTotal >= 0 ? "+" : ""}{formatCurrency(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
