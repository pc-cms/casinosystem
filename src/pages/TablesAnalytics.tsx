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

/** EAT hour-minute as decimal (0..24); slots from 18:00..29:30 (= 05:30 next day). */
const eatDecimalHours = (iso: string): number => {
  const d = new Date(iso);
  // Format in EAT and parse back to numeric H/M (avoids local TZ confusion).
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return h + m / 60;
};

/** Build the list of 30-minute slot labels for the live-game window 18:00 → 05:00. */
const buildSlots = (): { label: string; key: number }[] => {
  const slots: { label: string; key: number }[] = [];
  // 18:00 → 23:30 then 00:00 → 05:00 (treated as 24..29 internally for ordering)
  for (let mins = 18 * 60; mins <= 29 * 60; mins += 30) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    slots.push({
      label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      key: mins,
    });
  }
  return slots;
};

/** Map an EAT decimal hour to its 30-min bucket key (in minutes). Returns null if outside the window. */
const slotKeyFor = (decH: number): number | null => {
  // Live window: 18.0 .. 05.5 EAT. Hours 0..5.5 belong to "next day" → +24.
  let h = decH;
  if (h < 6) h += 24;
  if (h < 18 || h > 29.5) return null;
  const totalMins = h * 60;
  // Floor to nearest 30 minutes
  return Math.floor(totalMins / 30) * 30;
};

/** Round a value's absolute size up to a "nice" step (5, 10, 50, 100, 500, 1k, 5k, 10k, ...). */
const niceMax = (v: number): number => {
  if (v <= 0) return 10;
  // Find the order of magnitude
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / pow; // 1..10
  let step: number;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * pow;
};

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

  const slots = useMemo(buildSlots, []);

  // For each (table, 30-min slot) we want the LATEST per-table result observed in that slot.
  // Sources, in order of priority for a given slot: latest snapshot in window > tracker entry.
  const dataBySlot = useMemo(() => {
    // tableId -> slotKey -> { value, ts }
    const map: Record<string, Record<number, { value: number; ts: string }>> = {};
    const put = (tableId: string, slotKey: number, value: number, ts: string) => {
      if (!map[tableId]) map[tableId] = {};
      const cur = map[tableId][slotKey];
      if (!cur || ts > cur.ts) map[tableId][slotKey] = { value, ts };
    };

    // 1) Snapshots → group by created_at (one save event), compute per-table delta
    const groups: Record<string, Record<string, { actual: Record<number, number>; expected: Record<number, number> }>> = {};
    snapshots.forEach((s: any) => {
      if (s.location_type !== "table" || !s.location_id) return;
      const ts = s.created_at;
      if (!groups[ts]) groups[ts] = {};
      if (!groups[ts][s.location_id]) groups[ts][s.location_id] = { actual: {}, expected: {} };
      groups[ts][s.location_id].actual[Number(s.denomination)] = Number(s.actual_quantity);
      groups[ts][s.location_id].expected[Number(s.denomination)] = Number(s.expected_quantity);
    });
    Object.entries(groups).forEach(([ts, perTableDenoms]) => {
      const slotKey = slotKeyFor(eatDecimalHours(ts));
      if (slotKey == null) return;
      Object.entries(perTableDenoms).forEach(([tableId, denoms]) => {
        const value = chipSnapshotResult(denoms.actual, denoms.expected);
        put(tableId, slotKey, value, ts);
      });
    });

    // 2) Tracker (Number Count) entries — slot is "HH:00", value is the per-hour result
    tracker.forEach((t: any) => {
      const [h, m] = String(t.time_slot).split(":").map(Number);
      // Map slot HH:MM into our internal minutes (00..05 → next day → +24h)
      let normH = h;
      if (normH < 6) normH += 24;
      const slotKey = normH * 60 + (m || 0);
      if (slotKey < 18 * 60 || slotKey > 29 * 60) return;
      // Treat tracker timestamp as the slot itself (lowest priority)
      const ts = `tracker-${t.time_slot}-${t.id || ""}`;
      put(t.table_id, slotKey, Number(t.value), ts);
    });

    return map;
  }, [snapshots, tracker]);

  const chartData = useMemo(() => {
    return slots.map(slot => {
      const row: any = { label: slot.label };
      activeTables.forEach(tbl => {
        const cell = dataBySlot[tbl.id]?.[slot.key];
        row[tbl.id] = cell ? cell.value : null;
      });
      return row;
    });
  }, [slots, activeTables, dataBySlot]);

  // Y axis: round abs(max) up to a nice step (>= 10), symmetric around 0.
  const yDomain = useMemo<[number, number]>(() => {
    let maxAbs = 0;
    chartData.forEach(row => {
      activeTables.forEach(tbl => {
        const v = row[tbl.id];
        if (v != null && Number.isFinite(Number(v))) {
          const a = Math.abs(Number(v));
          if (a > maxAbs) maxAbs = a;
        }
      });
    });
    const top = niceMax(Math.max(maxAbs, 10));
    return [-top, top];
  }, [chartData, activeTables]);

  return (
    <PageShell>
      <PageHeader
        icon={LineChartIcon}
        title="Table Analytics"
        subtitle="Per-table result over time · 30-min slots from Chip Counts (priority) and Number Counts"
        date={restrictedToToday ? effectiveDate : false}
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

      <PageSection card title="Per-table result · 30-min slots (18:00 → 05:00)">
        <div className="h-[420px] w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => formatCurrency(v)}
                width={88}
                domain={yDomain}
                allowDataOverflow={false}
              />
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
                  dot={{ r: 3 }}
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
