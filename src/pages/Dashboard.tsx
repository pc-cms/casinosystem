import { useMemo } from "react";
import { Users, Landmark, Receipt, TrendingDown } from "lucide-react";
import { usePlayers, useTransactions, useGamingTables, useExpenses, useClientSessionsTotalBet, useTableTracker, usePlayerEconomy } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { getBusinessDate } from "@/lib/business-day";

const StatCard = ({ label, value, icon: Icon, href }: {
  label: string; value: string | number; icon: any; href: string;
}) => (
  <Link to={href} className="cms-panel p-4 hover:border-primary/30 transition-colors group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold font-mono mt-1 text-card-foreground">{value}</p>
      </div>
      <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </Link>
);

const Dashboard = () => {
  const { displayName, roles } = useAuth();
  const businessDate = getBusinessDate();
  const { data: players = [] } = usePlayers();
  const { data: transactions = [] } = useTransactions();
  const { data: tables = [] } = useGamingTables();
  const { data: expenses = [] } = useExpenses();
  const { data: sessionsTotalBet = 0 } = useClientSessionsTotalBet();
  const { data: trackerData = [] } = useTableTracker(businessDate);
  const { data: economy = [] } = usePlayerEconomy();

  const showFinancials = canSeePlayerFinancials(roles);
  const activePlayers = players.filter(p => p.status === "active").length;
  const buyInDrop = transactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0);
  const totalDrop = buyInDrop + sessionsTotalBet;
  const pendingExpenses = expenses.filter(e => !e.approved).length;

  // Per-table tracker totals
  const tableTrackerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    trackerData.forEach((d: any) => {
      totals[d.table_id] = (totals[d.table_id] || 0) + Number(d.value);
    });
    return totals;
  }, [trackerData]);

  // Total result: closing_result if available, otherwise tracker sum
  const totalResult = useMemo(() => {
    return tables.reduce((sum, table) => {
      const trackerVal = tableTrackerTotals[table.id] || 0;
      const resultVal = table.closing_result !== null ? Number(table.closing_result) : trackerVal;
      return sum + resultVal;
    }, 0);
  }, [tables, tableTrackerTotals]);

  // Top losers from player economy
  const topLosers = useMemo(() => {
    return economy
      .map(e => {
        const drop = Number(e.total_drop || 0);
        const cashout = Number(e.total_cashout || 0);
        const result = cashout - drop;
        return {
          player_id: e.player_id,
          name: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
          nickname: e.nickname,
          drop,
          cashout,
          result,
        };
      })
      .filter(p => p.drop > 0)
      .sort((a, b) => a.result - b.result)
      .slice(0, 20);
  }, [economy]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {displayName} · {roles.join(", ") || "No role"} · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {showFinancials && <StatCard label="Total Drop" value={formatCurrency(totalDrop)} icon={Landmark} href="/cage" />}
        {showFinancials && (
          <Link to="/tables?tab=tracker" className="cms-panel p-4 hover:border-primary/30 transition-colors group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Result</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${totalResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                  {totalResult >= 0 ? "+" : ""}{formatCurrency(totalResult)}
                </p>
              </div>
              <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </Link>
        )}
        <StatCard label="Active Players" value={activePlayers} icon={Users} href="/players" />
        {showFinancials && <StatCard label="Pending Expenses" value={pendingExpenses} icon={Receipt} href="/expenses" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showFinancials && (
          <div className="cms-panel">
            <div className="cms-header">Recent Transactions</div>
            <div className="p-4">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 8).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="text-sm font-medium text-card-foreground">
                          {(tx as any).players?.first_name} {(tx as any).players?.last_name}
                        </span>
                        <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </div>
                      <span className={`font-mono text-sm font-medium ${tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}`}>
                        {tx.type === "buy" ? "-" : "+"}{formatCurrency(Number(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showFinancials && (
          <div className="cms-panel">
            <div className="cms-header">Top Losers</div>
            <div className="p-4 space-y-1">
              {topLosers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : topLosers.map((p, i) => (
                <div key={p.player_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                    <span className="text-sm font-medium text-card-foreground">{p.name}</span>
                    {p.nickname && <span className="text-xs text-muted-foreground">({p.nickname})</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-muted-foreground">{formatCurrency(p.drop)}</span>
                    <span className={`font-mono text-xs font-bold ${p.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      {p.result >= 0 ? "+" : ""}{formatCurrency(p.result)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
