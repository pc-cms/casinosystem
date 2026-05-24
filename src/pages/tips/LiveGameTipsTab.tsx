/**
 * LiveGameTipsTab — read-only list of Live Game tips collected by cashier.
 * Records: date · time · chip breakdown by denomination · amount.
 * Grouped by day with subtotals. Period = 16th of previous month → 15th of
 * current month (same window as Monthly Tips), so the Monthly Tips "collected"
 * hint matches the Period Total shown here.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtDate, fmtDateOnly } from "@/lib/format-date";
import { useTipsByRange } from "@/hooks/use-tips";
import { getPeriodStart16, getPeriodEnd15, addMonthsPeriod } from "@/hooks/use-monthly-tips";

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" });
};

const chipsToCells = (chips: Record<string, number> | null): { denom: number; count: number }[] => {
  if (!chips) return [];
  return Object.entries(chips)
    .map(([d, c]) => ({ denom: Number(d), count: Number(c) || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.denom - a.denom);
};

export default function LiveGameTipsTab() {
  const [periodStart, setPeriodStart] = useState<string>(() => getPeriodStart16(new Date()));
  const periodEnd = useMemo(() => getPeriodEnd15(periodStart), [periodStart]);
  const { data: rows = [] } = useTipsByRange("tips_live", periodStart, periodEnd);

  const byDay = useMemo(() => {
    const m = new Map<string, { total: number; items: typeof rows }>();
    rows.forEach(r => {
      const k = r.business_date;
      const cur = m.get(k) || { total: 0, items: [] as any };
      cur.total += Number(r.amount) || 0;
      cur.items.push(r);
      m.set(k, cur);
    });
    return Array.from(m.entries())
      .map(([d, v]) => ({ date: d, total: v.total, items: v.items.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const periodTotal = byDay.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPeriodStart(p => addMonthsPeriod(p, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-3 py-1 rounded-md bg-muted/50 font-semibold tabular-nums min-w-[220px] text-center font-mono text-sm">
            {fmtDateOnly(periodStart)} – {fmtDateOnly(periodEnd)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setPeriodStart(p => addMonthsPeriod(p, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="cms-panel px-4 py-2 flex items-center gap-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Period Total</span>
          <span className="font-mono text-lg font-bold">{formatCurrency(periodTotal)}</span>
        </div>
      </div>

      {byDay.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No Live Game tips this period</div>
      ) : byDay.map(day => (
        <div key={day.date} className="cms-panel">
          <div className="cms-header flex items-center justify-between">
            <span className="font-mono">{fmtDate(day.date)}</span>
            <span className="font-mono text-base font-bold">{formatCurrency(day.total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="text-left px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground w-20">Time</th>
                <th className="text-left px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">Chip Breakdown</th>
                <th className="text-right px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {day.items.map((r: any) => {
                const cells = chipsToCells(r.chips);
                return (
                  <tr key={r.id} className="border-b border-border/30 last:border-0">
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{fmtTime(r.created_at)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      {cells.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {cells.map(c => (
                            <span key={c.denom} className="inline-flex items-baseline gap-0.5 px-1.5 py-0.5 rounded bg-muted/70">
                              <span className="font-bold">{c.count}</span>
                              <span className="text-muted-foreground">×</span>
                              <span className="text-muted-foreground">{c.denom.toLocaleString("en-US").replace(/,/g, " ")}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(Number(r.amount))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
