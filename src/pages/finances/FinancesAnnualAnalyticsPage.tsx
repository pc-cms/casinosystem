import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { useFinWalletTx } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FinancesAnnualAnalyticsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { data: tx = [] } = useFinWalletTx({ from: `${year}-01-01`, to: `${year}-12-31` });

  const series = useMemo(() => {
    const income = Array(12).fill(0);
    const expense = Array(12).fill(0);
    tx.forEach((r: any) => {
      const mo = new Date(r.business_date).getMonth();
      const v = Number(r.amount_tzs || 0);
      if (r.kind === "income") income[mo] += v;
      if (r.kind === "expense" || r.kind === "reversal") expense[mo] += v;
    });
    return income.map((inc, i) => ({ month: MONTHS[i], income: inc, expense: -expense[i], net: inc + expense[i] }));
  }, [tx]);

  const total = useMemo(() => series.reduce((s, r) => ({ income: s.income + r.income, expense: s.expense + r.expense, net: s.net + r.net }), { income: 0, expense: 0, net: 0 }), [series]);

  return (
    <PageShell>
      <PageHeader icon={TrendingUp} title="Annual Analytics" subtitle="Income vs Expense vs Net per month">
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 font-mono" />
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Month</th><th className="text-right">Income</th><th className="text-right">Expense</th><th className="text-right">Net</th></tr>
            </thead>
            <tbody>
              {series.map((r) => (
                <tr key={r.month} className="border-t border-border">
                  <td className="px-3 py-1.5">{r.month}</td>
                  <td className="text-right font-mono cms-amount-positive">{formatNumberSpaces(r.income)}</td>
                  <td className="text-right font-mono cms-amount-negative">{formatNumberSpaces(r.expense)}</td>
                  <td className={`text-right font-mono ${r.net < 0 ? "cms-amount-negative" : "cms-amount-positive"}`}>{formatNumberSpaces(r.net)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-3 py-2">YTD</td>
                <td className="text-right font-mono">{formatNumberSpaces(total.income)}</td>
                <td className="text-right font-mono">{formatNumberSpaces(total.expense)}</td>
                <td className={`text-right font-mono ${total.net < 0 ? "cms-amount-negative" : "cms-amount-positive"}`}>{formatNumberSpaces(total.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
