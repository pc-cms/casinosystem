import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { useFinBudget, useFinExpenses, useFinCategories } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FinancesBudgetVsActualPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { data: categories = [] } = useFinCategories();
  const { data: budget = [] } = useFinBudget(year);
  const { data: expenses = [] } = useFinExpenses({
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });

  const actual = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    expenses.forEach((e: any) => {
      if (e.voided_at || !e.fin_category_id) return;
      const mo = new Date(e.business_date).getMonth() + 1;
      m[e.fin_category_id] = m[e.fin_category_id] || {};
      m[e.fin_category_id][mo] = (m[e.fin_category_id][mo] || 0) + Number(e.amount_tzs || e.amount || 0);
    });
    return m;
  }, [expenses]);

  const planned = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    (budget || []).forEach((b: any) => {
      m[b.category_id] = m[b.category_id] || {};
      m[b.category_id][b.month] = (m[b.category_id][b.month] || 0) + Number(b.planned_amount || 0);
    });
    return m;
  }, [budget]);

  return (
    <PageShell>
      <PageHeader icon={BarChart3} title="Budget vs Actual" subtitle="Per category, monthly variance">
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 font-mono" />
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-auto max-h-[75vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr><th className="px-2 py-2 text-left">Category</th>{MONTHS.map(m => <th key={m} className="text-right px-1.5">{m}</th>)}<th className="text-right px-2">YTD</th></tr>
            </thead>
            <tbody>
              {categories.filter((c: any) => !c.is_income).map((c: any) => {
                let ytdP = 0, ytdA = 0;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-2 py-1">{c.name}</td>
                    {MONTHS.map((_, i) => {
                      const p = planned[c.id]?.[i + 1] || 0;
                      const a = actual[c.id]?.[i + 1] || 0;
                      ytdP += p; ytdA += a;
                      const diff = a - p;
                      return (
                        <td key={i} className="px-1 text-right font-mono">
                          <div className="text-[10px] text-muted-foreground">{formatNumberSpaces(p)}</div>
                          <div className={diff > 0 ? "cms-amount-negative" : ""}>{formatNumberSpaces(a)}</div>
                        </td>
                      );
                    })}
                    <td className="px-2 text-right font-mono">
                      <div className="text-[10px] text-muted-foreground">{formatNumberSpaces(ytdP)}</div>
                      <div className={ytdA > ytdP ? "cms-amount-negative" : ""}>{formatNumberSpaces(ytdA)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
