import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFinWalletTx, useFinExpenses, useFinWalletBalances, useFinWallets, useFinBudget } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";

const Money = ({ v }: { v: number }) => (
  <span className={`font-mono ${v < 0 ? "cms-amount-negative" : v > 0 ? "cms-amount-positive" : ""}`}>
    {formatNumberSpaces(v)}
  </span>
);

const monthBounds = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to, year: now.getFullYear(), month: now.getMonth() + 1 };
};

export default function FinancesDashboardPage() {
  const { from, to, year, month } = monthBounds();
  const { data: tx = [] } = useFinWalletTx({ from, to });
  const { data: balances } = useFinWalletBalances();
  const { data: wallets = [] } = useFinWallets();
  const { data: budget = [] } = useFinBudget(year, month);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    tx.forEach((r: any) => {
      const v = Number(r.amount_tzs || 0);
      if (r.kind === "income") income += v;
      if (r.kind === "expense" || r.kind === "reversal") expense += v;
    });
    return { income, expense: -expense, net: income + expense };
  }, [tx]);

  const totalBalance = useMemo(() => {
    if (!balances) return 0;
    let s = 0;
    balances.forEach((v) => { s += v; });
    return s;
  }, [balances]);

  const plannedTotal = useMemo(
    () => (budget || []).reduce((s: number, r: any) => s + Number(r.planned_amount || 0), 0),
    [budget]
  );

  return (
    <PageShell>
      <PageHeader icon={Wallet} title="Finances Dashboard" subtitle="Month-to-date overview" date />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <PageSection title="Month Income"><div className="text-2xl"><Money v={stats.income} /></div></PageSection>
        <PageSection title="Month Expense"><div className="text-2xl"><Money v={stats.expense} /></div></PageSection>
        <PageSection title="Net (Month)"><div className="text-2xl"><Money v={stats.net} /></div></PageSection>
        <PageSection title="Total Balance"><div className="text-2xl"><Money v={totalBalance} /></div></PageSection>
      </div>
      <PageSection title="Wallets" titleRight={<span className="text-xs text-muted-foreground">{wallets.length} wallets</span>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {wallets.map((w: any) => (
            <div key={w.id} className="flex items-center justify-between border-b border-border py-1.5 text-sm">
              <span>{w.name} <span className="text-muted-foreground">· {w.currency}</span></span>
              <Money v={Number(balances?.get(w.id) || 0)} />
            </div>
          ))}
          {!wallets.length && <div className="text-sm text-muted-foreground col-span-3 text-center py-4">No wallets configured. Go to Wallets to create.</div>}
        </div>
      </PageSection>
      <PageSection title="Budget (this month)">
        <div className="text-sm text-muted-foreground">Planned MTD total: <Money v={plannedTotal} /> · Actual expense: <Money v={stats.expense} /></div>
      </PageSection>
    </PageShell>
  );
}
