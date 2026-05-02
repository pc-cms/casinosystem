import { useMemo, useState } from "react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { LineChart as LineChartIcon, Lock } from "lucide-react";
import { getBusinessDate } from "@/lib/business-day";
import { useGamingTables, useTableTracker } from "@/hooks/use-casino-data";
import { useChipSnapshots } from "@/hooks/use-chips";
import { useChipBaseline, baselineToMap } from "@/hooks/use-table-lifecycle";
import { formatCurrency } from "@/lib/currency";
import { useBusinessDayFilter } from "@/hooks/use-business-day-filter";
import { chipSnapshotResult } from "@/lib/table-live-result";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";

const CHART_COLORS = [
  "#2563eb", "#10b981", "#f59e0b", "#7c3aed", "#e11d48",
  "#0891b2", "#ea580c", "#c026d3", "#65a30d", "#4f46e5",
  "#0d9488", "#db2777", "#ca8a04", "#0284c7", "#dc2626",
];
const tableColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

const formatTimeEAT = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const TablesAnalytics = () => {
  const today = getBusinessDate();
  const { restrictedToToday } = useBusinessDayFilter();
  const [date, setDate] = useState(today);
  const effectiveDate = restrictedToToday ? today : date;

  const { data: tables = [] } = useGamingTables();
  const { data: tracker = [] } = useTableTracker(effectiveDate);
  const { data: snapshots = [] } = useChipSnapshots(effectiveDate);
  const { data: baseline = [] } = useChipBaseline();
  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);

  const activeTables = useMemo(
    () => tables.filter(t => !(t as any).is_archived),
    [tables]
  );

  // ───── Build time series from EVERY snapshot save group (not rounded to hours) ─────
  // Each unique created_at = one save event = one X point.
  // Per-table value = delta from baseline at that snapshot.
  const snapshotPoints = useMemo(() => {
    const groups: Record<string, Record<string, { actual: Record<number, number>; expected: Record<number, number> }>> = {};
    snapshots.forEach((s: any) => {
      if (s.location_type !== "table" || !s.location_id) return;
      const ts = s.created_at;
      if (!groups[ts]) groups[ts] = {};
      if (!groups[ts][s.location_id]) groups[ts][s.location_id] = { actual: {}, expected: {} };
      groups[ts][s.location_id].actual[Number(s.denomination)] = Number(s.actual_quantity);
      groups[ts][s.location_id].expected[Number(s.denomination)] = Number(s.expected_quantity);
    });
    return Object.entries(groups)
      .map(([ts, perTableDenoms]) => ({
        ts,
        perTable: Object.fromEntries(
          Object.entries(perTableDenoms).map(([tableId, denoms]) => [tableId, chipSnapshotResult(denoms.actual, denoms.expected)])
        ) as Record<string, number>,
      }))
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [snapshots]);

  // Tracker (Number Count) entries — one point per (table, slot)
  const trackerPoints = useMemo(() => {
    // Group by time_slot -> tableId -> value (latest wins)
    const bySlot: Record<string, Record<string, number>> = {};
    tracker.forEach((t: any) => {
      if (!bySlot[t.time_slot]) bySlot[t.time_slot] = {};
      bySlot[t.time_slot][t.table_id] = Number(t.value);
    });
    // Convert slot "HH:MM" → fake timestamp on effectiveDate at that hour (EAT)
    return Object.entries(bySlot)
      .map(([slot, perTable]) => {
        // slot is "HH:00". Slots 00-04 belong to next calendar day.
        const [h, m] = slot.split(":").map(Number);
        const dayOffset = h <= 4 ? 1 : 0;
        const base = new Date(`${effectiveDate}T00:00:00+03:00`);
        base.setUTCDate(base.getUTCDate() + dayOffset);
        base.setUTCHours(h - 3, m, 0, 0); // EAT = UTC+3
        return { ts: base.toISOString(), perTable, isTracker: true };
      })
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [tracker, effectiveDate]);

  // Combined points: snapshots are source of truth; if no snapshot at a given moment,
  // include tracker points to keep coverage. Each point = its own X value (timestamp).
  const allPoints = useMemo(() => {
    return [...snapshotPoints, ...trackerPoints].sort((a, b) => a.ts.localeCompare(b.ts));
  }, [snapshotPoints, trackerPoints]);

  const chartData = useMemo(() => {
    return allPoints.map(p => {
      const row: any = { ts: p.ts, label: formatTimeEAT(p.ts) };
      activeTables.forEach(tbl => {
        const v = p.perTable[tbl.id];
        row[tbl.id] = v != null ? v : null;
      });
      return row;
    });
  }, [allPoints, activeTables]);

  const cumulativeData = useMemo(() => {
    const cums: Record<string, number> = {};
    return chartData.map(row => {
      const out: any = { ts: row.ts, label: row.label };
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
        subtitle="Per-snapshot dynamics for the shift · combines Chip Counts (priority) and Number Counts"
        date={effectiveDate}
      >
        {restrictedToToday ? (
          <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-mono text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Today only
          </div>
        ) : (
          <Input
            type="date"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value || today)}
            className="w-44 font-mono h-9"
          />
        )}
      </PageHeader>

      <PageSection card title="Per-snapshot result (per table)">
        <div className="h-[360px] w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
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
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
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
