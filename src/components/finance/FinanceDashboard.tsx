import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallets, useWalletTransactions, useDailySummaries, WALLET_LABELS, WalletType } from "@/hooks/use-finance";
import { formatNumberSpaces } from "@/lib/currency";
import { Wallet, TrendingUp, Building2, ShieldCheck } from "lucide-react";
import { WalletSetup } from "./WalletSetup";

export const FinanceDashboard = () => {
  const { data: wallets = [], isLoading } = useWallets();
  const { data: summaries = [] } = useDailySummaries();
  const { data: transactions = [] } = useWalletTransactions(30);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // If no wallets exist, show setup
  if (wallets.length === 0) {
    return <WalletSetup />;
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.current_balance), 0);
  const mainCash = wallets.find(w => w.wallet_type === "main_cash");
  const officeSafe = wallets.find(w => w.wallet_type === "office_safe");
  const reserves = wallets.filter(w => w.wallet_type.endsWith("_reserve"));
  const totalReserves = reserves.reduce((s, w) => s + Number(w.current_balance), 0);

  // Today's and monthly summaries
  const today = new Date().toISOString().slice(0, 10);
  const todaySummary = summaries.find(s => s.date === today);
  const currentMonth = today.slice(0, 7);
  const monthSummaries = summaries.filter(s => s.date.startsWith(currentMonth));
  const monthlyNet = monthSummaries.reduce((s, d) => s + Number(d.total_result) - Number(d.total_expenses), 0);

  // Today's transactions for daily change
  const todayTxs = transactions.filter(tx => tx.created_at.startsWith(today));

  return (
    <div className="space-y-6 mt-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Wallet} label="Total Balance" value={totalBalance} />
        <MetricCard icon={Building2} label="Cash / Safe" value={Number(mainCash?.current_balance || 0)} sub={`Safe: ${formatNumberSpaces(Number(officeSafe?.current_balance || 0))}`} />
        <MetricCard icon={ShieldCheck} label="Total Reserves" value={totalReserves} />
        <MetricCard icon={TrendingUp} label="Monthly Net" value={monthlyNet} colored />
      </div>

      {/* Daily result */}
      {todaySummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Tables</p>
                <p className="text-lg font-bold font-mono">{formatNumberSpaces(todaySummary.tables_result)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Slots</p>
                <p className="text-lg font-bold font-mono">{formatNumberSpaces(todaySummary.slots_result)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold font-mono">{formatNumberSpaces(todaySummary.total_result)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet balances */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {wallets.map(w => (
              <div key={w.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{WALLET_LABELS[w.wallet_type]}</p>
                <p className="text-base font-bold font-mono">{formatNumberSpaces(Number(w.current_balance))}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {transactions.slice(0, 15).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium capitalize">{tx.tx_type.replace(/_/g, " ")}</span>
                    {tx.description && <span className="text-muted-foreground ml-2">— {tx.description}</span>}
                  </div>
                  <span className="font-mono font-medium">{formatNumberSpaces(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, sub, colored }: { icon: any; label: string; value: number; sub?: string; colored?: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${colored ? (value >= 0 ? "text-green-500" : "text-destructive") : ""}`}>
        {formatNumberSpaces(value)}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);
