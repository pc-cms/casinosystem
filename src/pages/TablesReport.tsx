import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useGamingTables } from "@/hooks/use-tables";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSection } from "@/components/layout/PageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { businessDayHourUTC } from "@/lib/business-day";

type Preset = "yesterday" | "week" | "month" | "custom";

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const today = () => isoDate(new Date());

type SnapshotRow = {
  business_date: string;
  snapshot: {
    table_tracker?: Array<{ table_id: string; time_slot: string; value: number | string }>;
    chip_snapshots?: Array<{ table_id: string; location_type?: string }>;
  };
};

type DayTableMetrics = {
  date: string;
  tableId: string;
  drop: number;
  result: number;
};

const useClosedDaysInRange = (from: string, to: string) => {
  const { casinoId, roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  return useQuery({
    queryKey: ["tables-report-closures", casinoId, isSuper, from, to],
    queryFn: async (): Promise<SnapshotRow[]> => {
      let q = supabase
        .from("business_day_closures")
        .select("business_date, snapshot")
        .gte("business_date", from)
        .lte("business_date", to)
        .order("business_date", { ascending: true });
      if (!isSuper && casinoId) q = q.eq("casino_id", casinoId);
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, SnapshotRow>();
      (data || []).forEach((r: any) => {
        map.set(r.business_date, { business_date: r.business_date, snapshot: r.snapshot || {} });
      });
      return Array.from(map.values()).sort((a, b) => a.business_date.localeCompare(b.business_date));
    },
    enabled: !!from && !!to,
  });
};

const useDropForRange = (from: string, to: string, dates: string[]) => {
  const { casinoId, roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  return useQuery({
    queryKey: ["tables-report-drop", casinoId, isSuper, from, to],
    queryFn: async (): Promise<Map<string, Map<string, number>>> => {
      const out = new Map<string, Map<string, number>>();
      if (dates.length === 0) return out;
      const fromIso = businessDayHourUTC(from, 18);
      const toIso = businessDayHourUTC(addDays(to, 1), 13);
      let q = supabase
        .from("transactions")
        .select("table_id, type, amount, created_at")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .in("type", ["buy", "in"]);
      if (!isSuper && casinoId) q = q.eq("casino_id", casinoId);
      const { data, error } = await q;
      if (error) throw error;
      const dateSet = new Set(dates);
      (data || []).forEach((t: any) => {
        if (!t.table_id) return;
        const created = new Date(t.created_at);
        const eatHour = parseInt(
          created.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }),
          10
        );
        const eatDate = created.toLocaleDateString("en-CA", { timeZone: "Africa/Dar_es_Salaam" });
        const bDate = eatHour < 13 ? addDays(eatDate, -1) : eatDate;
        if (!dateSet.has(bDate)) return;
        let inner = out.get(bDate);
        if (!inner) { inner = new Map(); out.set(bDate, inner); }
        inner.set(t.table_id, (inner.get(t.table_id) || 0) + Number(t.amount));
      });
      return out;
    },
    enabled: dates.length > 0,
  });
};

const slotOrder = (s: string) => {
  const [h] = s.split(":").map(Number);
  return h >= 18 ? h - 18 : h + 6;
};

const computeResultsFromSnapshot = (snap: SnapshotRow["snapshot"]): Map<string, number> => {
  const out = new Map<string, number>();
  const tracker = snap.table_tracker || [];
  const latest = new Map<string, { ord: number; value: number }>();
  for (const r of tracker) {
    const ord = slotOrder(r.time_slot);
    const cur = latest.get(r.table_id);
    if (!cur || ord > cur.ord) latest.set(r.table_id, { ord, value: Number(r.value) });
  }
  latest.forEach((v, k) => out.set(k, v.value));
  return out;
};

const TablesReport = () => {
  const [preset, setPreset] = useState<Preset>("yesterday");
  const yest = addDays(today(), -1);
  const [from, setFrom] = useState(yest);
  const [to, setTo] = useState(yest);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const t = today();
    if (p === "yesterday") { setFrom(addDays(t, -1)); setTo(addDays(t, -1)); }
    else if (p === "week") { setFrom(addDays(t, -7)); setTo(addDays(t, -1)); }
    else if (p === "month") { setFrom(addDays(t, -30)); setTo(addDays(t, -1)); }
  };

  const { data: tables = [] } = useGamingTables(true);
  const tableMap = useMemo(() => new Map(tables.map((t: any) => [t.id, t])), [tables]);

  const { data: closures = [], isLoading: closuresLoading } = useClosedDaysInRange(from, to);
  const dates = useMemo(() => closures.map(c => c.business_date), [closures]);
  const { data: dropMap = new Map(), isLoading: dropLoading } = useDropForRange(from, to, dates);

  const isLoading = closuresLoading || dropLoading;

  const cells = useMemo(() => {
    const m = new Map<string, Map<string, DayTableMetrics>>();
    for (const c of closures) {
      const inner = new Map<string, DayTableMetrics>();
      const results = computeResultsFromSnapshot(c.snapshot);
      const drops = dropMap.get(c.business_date) || new Map<string, number>();
      const tableIds = new Set<string>([...results.keys(), ...drops.keys()]);
      tableIds.forEach(tid => {
        inner.set(tid, {
          date: c.business_date,
          tableId: tid,
          drop: drops.get(tid) || 0,
          result: results.get(tid) || 0,
        });
      });
      m.set(c.business_date, inner);
    }
    return m;
  }, [closures, dropMap]);

  const summary = useMemo(() => {
    const agg = new Map<string, { drop: number; result: number }>();
    cells.forEach(inner => {
      inner.forEach((cell, tid) => {
        const cur = agg.get(tid) || { drop: 0, result: 0 };
        cur.drop += cell.drop;
        cur.result += cell.result;
        agg.set(tid, cur);
      });
    });
    const rows = Array.from(agg.entries())
      .map(([tid, v]) => {
        const t = tableMap.get(tid) as any;
        return {
          tableId: tid,
          name: t?.name || tid.slice(0, 6),
          game: t?.game || "—",
          drop: v.drop,
          result: v.result,
          hold: v.drop > 0 ? (v.result / v.drop) * 100 : 0,
        };
      })
      .sort((a, b) => (a.name as string).localeCompare(b.name as string));
    const totals = rows.reduce(
      (s, r) => ({ drop: s.drop + r.drop, result: s.result + r.result }),
      { drop: 0, result: 0 }
    );
    return { rows, totals, hold: totals.drop > 0 ? (totals.result / totals.drop) * 100 : 0 };
  }, [cells, tableMap]);

  const matrix = useMemo(() => {
    const tableIds = new Set<string>();
    cells.forEach(inner => inner.forEach((_, tid) => tableIds.add(tid)));
    const rows = Array.from(tableIds)
      .map(tid => {
        const t = tableMap.get(tid) as any;
        return { tableId: tid, name: t?.name || tid.slice(0, 6), game: t?.game || "—" };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [cells, tableMap]);

  const fmtSigned = (n: number) =>
    `${n >= 0 ? "+" : ""}${formatCurrency(n)}`;

  return (
    <PageShell>
      <PageHeader icon={BarChart3} title="Tables Report" subtitle="Drop & Result per table from closed business days" />

      <PageSection card={false}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider">Period</label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider">From</label>
            <Input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-muted-foreground tracking-wider">To</label>
            <Input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="w-40" />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {closures.length} closed day{closures.length === 1 ? "" : "s"}
          </div>
        </div>
      </PageSection>

      <Tabs defaultValue="summary" className="space-y-3">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="matrix">Matrix by date</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <PageSection card bodyClassName="p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Table", "Game", "Drop", "Result", "Hold %"].map((h, i) => (
                    <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-2 ${i < 2 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-6">Loading…</td></tr>
                ) : summary.rows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-6">No closed business days in range</td></tr>
                ) : summary.rows.map(r => (
                  <tr key={r.tableId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 text-sm font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.game}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(r.drop)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${r.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{fmtSigned(r.result)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${r.hold >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{r.drop > 0 ? `${r.hold.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
                {summary.rows.length > 0 && (
                  <tr className="border-t-2 border-primary/30 bg-muted/30">
                    <td colSpan={2} className="px-3 py-2 text-xs font-bold uppercase">Totals</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold">{formatCurrency(summary.totals.drop)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${summary.totals.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{fmtSigned(summary.totals.result)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${summary.hold >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{summary.totals.drop > 0 ? `${summary.hold.toFixed(1)}%` : "—"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </PageSection>
        </TabsContent>

        <TabsContent value="matrix">
          <PageSection card bodyClassName="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground uppercase sticky left-0 bg-card z-10">Table</th>
                  {dates.map(d => (
                    <th key={d} className="text-right px-2 py-2 text-muted-foreground font-mono whitespace-nowrap">{d.slice(5)}</th>
                  ))}
                  <th className="text-right px-3 py-2 text-muted-foreground uppercase">Total D / R</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={dates.length + 2} className="text-center text-muted-foreground text-sm py-6">Loading…</td></tr>
                ) : matrix.length === 0 ? (
                  <tr><td colSpan={dates.length + 2} className="text-center text-muted-foreground text-sm py-6">No data in range</td></tr>
                ) : matrix.map(row => {
                  let totalDrop = 0, totalRes = 0;
                  return (
                    <tr key={row.tableId} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 sticky left-0 bg-card z-10">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-[10px] text-muted-foreground">{row.game}</div>
                      </td>
                      {dates.map(d => {
                        const cell = cells.get(d)?.get(row.tableId);
                        const drop = cell?.drop || 0;
                        const result = cell?.result || 0;
                        totalDrop += drop;
                        totalRes += result;
                        const empty = !cell || (drop === 0 && result === 0);
                        return (
                          <td key={d} className="px-2 py-1 text-right font-mono whitespace-nowrap">
                            {empty ? (
                              <span className="text-muted-foreground/40">·</span>
                            ) : (
                              <div className="leading-tight">
                                <div className="text-card-foreground">{formatCurrency(drop)}</div>
                                <div className={result >= 0 ? "cms-amount-positive font-semibold" : "cms-amount-negative font-semibold"}>
                                  {fmtSigned(result)}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1 text-right font-mono whitespace-nowrap">
                        <div className="leading-tight">
                          <div className="font-bold">{formatCurrency(totalDrop)}</div>
                          <div className={`font-bold ${totalRes >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{fmtSigned(totalRes)}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PageSection>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default TablesReport;
