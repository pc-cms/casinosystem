/**
 * FloorTipsReport — per-employee breakdown of Floor tips collected by cashier.
 * Monthly view with totals per employee + detail rows.
 */
import { useMemo, useState } from "react";
import { UserCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { useTipsByRange } from "@/hooks/use-tips";

export default function FloorTipsReport() {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const monthStart = useMemo(() => format(startOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const monthEnd = useMemo(() => format(endOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const { data: rows = [] } = useTipsByRange("tips_floor", monthStart, monthEnd);

  const byEmployee = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number; details: typeof rows }>();
    rows.forEach(r => {
      const k = r.tips_recipient_employee_id || "unknown";
      const name = r.employees?.full_name || "Unknown";
      const cur = m.get(k) || { name, total: 0, count: 0, details: [] as any };
      cur.total += Number(r.amount) || 0;
      cur.count += 1;
      cur.details.push(r);
      m.set(k, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const monthTotal = byEmployee.reduce((s, r) => s + r.total, 0);

  return (
    <PageShell>
      <PageHeader icon={UserCheck} title="Floor Tips" subtitle={format(anchor, "MMMM yyyy")}>
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
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Employee</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Tips Count</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {byEmployee.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-muted-foreground py-6">No floor tips this month</td></tr>
              ) : byEmployee.map(e => (
                <tr key={e.name} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{e.count}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="cms-panel mt-3">
            <div className="cms-header text-xs">Recent Tips ({rows.length})</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Employee</th>
                  <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map(r => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{fmtDate(r.business_date)}</td>
                    <td className="px-3 py-2">{r.employees?.full_name || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(Number(r.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}
