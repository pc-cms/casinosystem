/**
 * PokerTipsReport — daily breakdown of Club Poker tips collected by cashier.
 * Standard month picker + daily totals.
 */
import { useMemo, useState } from "react";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { useTipsByRange } from "@/hooks/use-tips";

export default function PokerTipsReport() {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const monthStart = useMemo(() => format(startOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const monthEnd = useMemo(() => format(endOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const { data: rows = [] } = useTipsByRange("tips_poker", monthStart, monthEnd);

  const byDay = useMemo(() => {
    const m = new Map<string, { total: number; count: number; tables: Set<string> }>();
    rows.forEach(r => {
      const k = r.business_date;
      const cur = m.get(k) || { total: 0, count: 0, tables: new Set<string>() };
      cur.total += Number(r.amount) || 0;
      cur.count += 1;
      if (r.gaming_tables?.name) cur.tables.add(r.gaming_tables.name);
      m.set(k, cur);
    });
    return Array.from(m.entries())
      .map(([d, v]) => ({ date: d, total: v.total, count: v.count, tables: Array.from(v.tables).join(", ") }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const monthTotal = byDay.reduce((s, r) => s + r.total, 0);

  return (
    <PageShell>
      <PageHeader icon={Coins} title="Poker Tips" subtitle={format(anchor, "MMMM yyyy")}>
        <Button variant="outline" size="icon" onClick={() => setAnchor(d => subMonths(d, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setAnchor(d => addMonths(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </PageHeader>

      <PageSection>
        <div className="cms-panel p-3 mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground uppercase tracking-wider">Month Total</span>
          <span className="font-mono text-2xl font-bold">{formatCurrency(monthTotal)}</span>
        </div>

        <div className="cms-panel">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Tables</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Tips Count</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {byDay.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-6">No poker tips this month</td></tr>
              ) : byDay.map(r => (
                <tr key={r.date} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-mono">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.tables || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
