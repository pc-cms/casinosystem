import { useMemo, useState } from "react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { LineChart as LineChartIcon } from "lucide-react";
import { getBusinessDate } from "@/lib/business-day";
import { useGamingTables, useTableTracker } from "@/hooks/use-casino-data";
import { useChipSnapshots } from "@/hooks/use-chips";
import { useChipBaseline, baselineToMap } from "@/hooks/use-table-lifecycle";
import { formatCurrency } from "@/lib/currency";
const CHART_COLORS = [
  "#2563eb", "#10b981", "#f59e0b", "#7c3aed", "#e11d48",
  "#0891b2", "#ea580c", "#c026d3", "#65a30d", "#4f46e5",
  "#0d9488", "#db2777", "#ca8a04", "#0284c7", "#dc2626",
];
const tableColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";

const SLOTS = (() => {
  const out: string[] = [];
  for (let h = 18; h <= 28; h++) {
    out.push(`${String(h % 24).padStart(2, "0")}:00`);
  }
  return out;
})();

const TablesAnalytics = () => {
  const today = getBusinessDate();
  const [date, setDate] = useState(today);

  const { data: tables = [] } = useGamingTables();
  const { data: tracker = [] } = useTableTracker(date);
  const { data: snapshots = [] } = useChipSnapshots(date);
  const { data: baseline = [] } = useChipBaseline();
  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);

  const activeTables = useMemo(
    () => tables.filter(t => !(t as any).is_archived),
    [tables]
  );

  // Snapshot-based per-slot delta (chip count saves grouped by rounded hour)
  const snapshotByTableSlot = useMemo(() => {
    // For each (tableId, slot) pick the latest snapshot group total in that hour.
    const map: Record<string, Record<string, number>> = {};
    const groups: Record<string, Record<string, number>> = {}; // ts -> tableId -> delta
    snapshots.forEach((s: any) => {
      if (s.location_type !== "table" || !s.location_id) return;
      const ts = s.created_at;
      if (!groups[ts]) groups[ts] = {};
      const expected = baselineMap[s.location_id]?.[Number(s.denomination)] ?? Number(s.expected_quantity || 0);
      const delta = (Number(s.actual_quantity) - expected) * Number(s.denomination);
      groups[ts][s.location_id] = (groups[ts][s.location_id] || 0) + delta;
    });
    Object.entries(groups).forEach(([ts, perTable]) => {
      // compute rounded hour slot in EAT
      const d = new Date(ts);
      const hh = parseInt(d.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }), 10);
      const mm = parseInt(d.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", minute: "2-digit" }), 10);
      let targetH: number | null = null;
      if (mm >= 50) targetH = (hh + 1) % 24;
      else if (mm <= 10) targetH = hh;
      else targetH = hh; // for analytics, snap to current hour anyway
      const slot = `${String(targetH).padStart(2, "0")}:00`;
      Object.entries(perTable).forEach(([tableId, val]) => {
        if (!map[tableId]) map[tableId] = {};
        map[tableId][slot] = val; // latest within hour wins (Object iteration order ~ insertion)
      });
    });
    return map;
  }, [snapshots, baselineMap]);

  // Tracker (Number Count) per (table, slot)
  const trackerByTableSlot = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    tracker.forEach((t: any) => {
      if (!map[t.table_id]) map[t.table_id] = {};
      map[t.table_id][t.time_slot] = Number(t.value);
    });
    return map;
  }, [tracker]);

  // Build chart data: cumulative (tracker preferred, else snapshot delta) per slot per table
  const chartData = useMemo(() => {
    return SLOTS.map(slot => {
      const row: any = { slot };
      activeTables.forEach(tbl => {
        const trackerVal = trackerByTableSlot[tbl.id]?.[slot];
        const snapVal = snapshotByTableSlot[tbl.id]?.[slot];
        // Prefer snapshot (chip count) when present (source of truth), else tracker
        const v = snapVal ?? trackerVal ?? null;
        row[tbl.id] = v;
      });
      return row;
    });
  }, [activeTables, trackerByTableSlot, snapshotByTableSlot]);

  // Cumulative line per table for "vs all session"
  const cumulativeData = useMemo(() => {
    const cums: Record<string, number> = {};
    return chartData.map(row => {
      const out: any = { slot: row.slot };
      activeTables.forEach(tbl => {
        const v = row[tbl.id];
        if (v != null) cums[tbl.id] = (cums[tbl.id] || 0) + Number(v);
        out[tbl.id] = cums[tbl.id] ?? null;
      });
      return out;
    });
  }, [chartData, activeTables]);

  return (
    <PageShell>
      <PageHeader
        icon={LineChartIcon}
        title="Table Analytics"
        subtitle="Per-hour dynamics for the shift · combines Chip Counts (priority) and Number Counts"
        date={date}
      >
        <Input
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value || today)}
          className="w-44 font-mono h-9"
        />
      </PageHeader>

      <PageSection card title="Per-hour result (per table)">
        <div className="h-[360px] w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="slot" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={80} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v: any) => formatCurrency(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activeTables.map((tbl, i) => (
                <Line
                  key={tbl.id}
                  type="monotone"
                  dataKey={tbl.id}
                  name={tbl.name}
                  stroke={tableColor(i)}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </PageSection>

      <PageSection card title="Cumulative result (per table)">
        <div className="h-[360px] w-full">
          <ResponsiveContainer>
            <LineChart data={cumulativeData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="slot" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={80} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v: any) => formatCurrency(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activeTables.map((tbl, i) => (
                <Line
                  key={tbl.id}
                  type="monotone"
                  dataKey={tbl.id}
                  name={tbl.name}
                  stroke={tableColor(i)}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </PageSection>
    </PageShell>
  );
};

export default TablesAnalytics;
