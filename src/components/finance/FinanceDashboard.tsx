import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallets, useWalletTransactions, useDailySummaries, WALLET_LABELS } from "@/hooks/use-finance";
import { formatNumberSpaces, DEFAULT_EXCHANGE_RATES } from "@/lib/currency";
import { Wallet, TrendingUp, Building2, ShieldCheck, Target, DollarSign, AlertTriangle } from "lucide-react";
import { WalletSetup } from "./WalletSetup";
import { useBudgetPeriod, useBudgetItems, useMonthlyActuals } from "@/hooks/use-budget";

export const FinanceDashboard = () => {
  const { data: wallets = [], isLoading } = useWallets();
  const { data: summaries = [] } = useDailySummaries();
  const { data: transactions = [] } = useWalletTransactions(30);
  const budgetMonth = new Date().toISOString().slice(0, 7);
  const { data: budgetPeriod } = useBudgetPeriod(budgetMonth);
  const { data: budgetItems = [] } = useBudgetItems(budgetPeriod?.id);
  const { data: monthlyActuals = {} } = useMonthlyActuals(budgetMonth);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (wallets.length === 0) {
    return <WalletSetup />;
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.current_balance), 0);
  const mainCash = wallets.find(w => w.wallet_type === "main_cash");
  const officeSafe = wallets.find(w => w.wallet_type === "office_safe");
  const reserves = wallets.filter(w => w.wallet_type.endsWith("_reserve"));
  const totalReserves = reserves.reduce((s, w) => s + Number(w.current_balance), 0);
  const mainCashBalance = Number(mainCash?.current_balance || 0);
  const isNegativeCash = mainCashBalance < 0;

  const today = new Date().toISOString().slice(0, 10);
  const todaySummary = summaries.find(s => s.date === today);
  const currentMonth = today.slice(0, 7);
  const monthSummaries = summaries.filter(s => s.date.startsWith(currentMonth));
  const monthlyIncome = monthSummaries.reduce((s, d) => s + Number(d.total_result), 0);
  const monthlyExpenses = monthSummaries.reduce((s, d) => s + Number(d.total_expenses), 0);
  const monthlyNet = monthlyIncome - monthlyExpenses;

  // Budget calculations with live actuals
  const budgetPlanned = budgetItems.reduce((s, i) => s + Number(i.monthly_amount), 0);
  const budgetActual = Object.values(monthlyActuals).reduce((s: number, v) => s + Number(v), 0);
  const budgetVariance = budgetActual - budgetPlanned;
  const budgetPct = budgetPlanned > 0 ? Math.round((budgetActual / budgetPlanned) * 100) : 0;

  // Break-even analysis
  const breakEvenDiff = monthlyIncome - budgetPlanned;
  const breakEvenMet = breakEvenDiff >= 0;

  // USD conversion
  const usdRate = DEFAULT_EXCHANGE_RATES?.USD || 2500;
  const totalBalanceUsd = Math.round(totalBalance / usdRate);

  // Collections this month
  const monthTxs = transactions.filter(tx => tx.created_at.startsWith(currentMonth));
  const totalCollections = monthTxs
    .filter(tx => tx.tx_type === "collection")
    .reduce((s, tx) => s + Number(tx.amount), 0);

  return (
    <div className="space-y-6 mt-4">
      {/* Negative cash alert */}
      {isNegativeCash && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Negative cash balance</p>
              <p className="text-xs text-destructive/80">
                Main Cash is {formatNumberSpaces(mainCashBalance)} TZS. This indicates more was spent/lost than received.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Wallet} label="Total Balance" value={totalBalance} sub={`≈ $${totalBalanceUsd.toLocaleString()} USD`} />
        <MetricCard icon={Building2} label="Cash / Safe" value={mainCashBalance} sub={`Safe: ${formatNumberSpaces(Number(officeSafe?.current_balance || 0))}`} colored={isNegativeCash} />
        <MetricCard icon={ShieldCheck} label="Total Reserves" value={totalReserves} />
        <MetricCard icon={TrendingUp} label="Monthly Net" value={monthlyNet} colored />
      </div>

      {/* Break-even + Budget */}
      {budgetPlanned > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Break-even card */}
          <Card className={breakEvenMet ? "border-green-500/30" : "border-destructive/30"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Break-even Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Income</span>
                  <span className="font-mono font-medium">{formatNumberSpaces(monthlyIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Break-even (Budget)</span>
                  <span className="font-mono font-medium">{formatNumberSpaces(budgetPlanned)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                  <span className={breakEvenMet ? "text-green-500" : "text-destructive"}>
                    {breakEvenMet ? "✓ Above break-even" : "✗ Below break-even"}
                  </span>
                  <span className={`font-mono ${breakEvenMet ? "text-green-500" : "text-destructive"}`}>
                    {formatNumberSpaces(breakEvenDiff)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Budget Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Planned</p>
                  <p className="text-lg font-bold font-mono">{formatNumberSpaces(budgetPlanned)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Actual</p>
                  <p className="text-lg font-bold font-mono">{formatNumberSpaces(budgetActual)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variance</p>
                  <p className={`text-lg font-bold font-mono ${budgetVariance > 0 ? "text-destructive" : "text-green-500"}`}>
                    {formatNumberSpaces(budgetVariance)}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Budget completion</span>
                  <span>{budgetPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${budgetPct > 100 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(120, budgetPct)}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's result */}
      {todaySummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
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
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-bold font-mono text-destructive">{formatNumberSpaces(todaySummary.total_expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collections */}
      {totalCollections > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Collections This Month</p>
              <p className="text-lg font-bold font-mono text-destructive">{formatNumberSpaces(totalCollections)}</p>
            </div>
            <p className="text-[10px] text-muted-foreground max-w-48">Owner withdrawals — not counted as operational expense</p>
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
              <div key={w.id} className={`p-3 rounded-lg border ${
                w.wallet_type === "main_cash" && Number(w.current_balance) < 0
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-muted/50 border-border"
              }`}>
                <p className="text-xs text-muted-foreground">{WALLET_LABELS[w.wallet_type]}</p>
                <p className={`text-base font-bold font-mono ${
                  w.wallet_type === "main_cash" && Number(w.current_balance) < 0 ? "text-destructive" : ""
                }`}>{formatNumberSpaces(Number(w.current_balance))}</p>
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
                    <span className={`font-medium capitalize ${tx.tx_type === "collection" ? "text-destructive" : ""}`}>
                      {tx.tx_type.replace(/_/g, " ")}
                    </span>
                    {tx.description && <span className="text-muted-foreground ml-2">— {tx.description}</span>}
                  </div>
                  <span className={`font-mono font-medium ${tx.tx_type === "collection" ? "text-destructive" : ""}`}>
                    {tx.tx_type === "collection" ? "-" : ""}{formatNumberSpaces(tx.amount)}
                  </span>
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
