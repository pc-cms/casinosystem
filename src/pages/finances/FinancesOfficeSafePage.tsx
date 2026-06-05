import { useMemo } from "react";
import { Landmark } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFinWallets, useFinWalletBalances } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";

const Money = ({ v }: { v: number }) => (
  <span className={`font-mono ${v < 0 ? "cms-amount-negative" : "cms-amount-positive"}`}>{formatNumberSpaces(v)}</span>
);

export default function FinancesOfficeSafePage() {
  const { data: wallets = [] } = useFinWallets();
  const { data: balances } = useFinWalletBalances();

  const byCurrency = useMemo(() => {
    const m = new Map<string, { wallets: any[]; total: number }>();
    wallets.forEach((w: any) => {
      const bal = Number(balances?.get(w.id) || 0);
      const cur = m.get(w.currency) || { wallets: [], total: 0 };
      cur.wallets.push({ ...w, balance: bal });
      cur.total += bal;
      m.set(w.currency, cur);
    });
    return Array.from(m.entries()).sort();
  }, [wallets, balances]);

  return (
    <PageShell>
      <PageHeader icon={Landmark} title="Office Safe" subtitle="Per-casino group view of all wallets by currency" />
      {byCurrency.map(([cur, info]) => (
        <PageSection key={cur} title={cur} titleRight={<Money v={info.total} />}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {info.wallets.map((w: any) => (
              <div key={w.id} className="flex justify-between items-center border-b border-border py-1.5 text-sm">
                <span><span className="text-muted-foreground text-xs uppercase mr-2">{w.kind}</span>{w.name}</span>
                <Money v={w.balance} />
              </div>
            ))}
          </div>
        </PageSection>
      ))}
      {!byCurrency.length && <div className="text-center text-muted-foreground py-8">No wallets configured</div>}
    </PageShell>
  );
}
