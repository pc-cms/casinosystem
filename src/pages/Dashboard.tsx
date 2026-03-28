import { Users, Landmark, Table2, Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useCMS } from "@/lib/cms-context";
import { Link } from "react-router-dom";

const StatCard = ({ label, value, icon: Icon, href, trend }: {
  label: string; value: string | number; icon: any; href: string;
  trend?: { value: string; positive: boolean };
}) => (
  <Link to={href} className="cms-panel p-4 hover:border-primary/30 transition-colors group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold font-mono mt-1 text-card-foreground">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend.positive ? "cms-amount-positive" : "cms-amount-negative"}`}>
            {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </Link>
);

const Dashboard = () => {
  const { players, transactions, tables, expenses } = useCMS();
  const activePlayers = players.filter(p => p.status === "active").length;
  const openTables = tables.filter(t => t.status === "open").length;
  const totalDrop = transactions.filter(t => t.type === "buy").reduce((s, t) => s + t.amount, 0);
  const pendingExpenses = expenses.filter(e => !e.approved).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Players" value={activePlayers} icon={Users} href="/players" />
        <StatCard label="Total Drop" value={`€${totalDrop.toLocaleString()}`} icon={Landmark} href="/cage" />
        <StatCard label="Open Tables" value={`${openTables}/${tables.length}`} icon={Table2} href="/tables" />
        <StatCard label="Pending Expenses" value={pendingExpenses} icon={Receipt} href="/expenses" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cms-panel">
          <div className="cms-header">Recent Transactions</div>
          <div className="p-4">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <span className="text-sm font-medium text-card-foreground">{tx.playerName}</span>
                      <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </div>
                    <span className={`font-mono text-sm font-medium ${tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}`}>
                      {tx.type === "buy" ? "-" : "+"}€{tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cms-panel">
          <div className="cms-header">Table Status</div>
          <div className="p-4 space-y-2">
            {tables.map(table => (
              <div key={table.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${table.status === "open" ? "bg-success" : "bg-danger"}`} />
                  <span className="text-sm font-medium text-card-foreground">{table.name}</span>
                  <span className="text-xs text-muted-foreground">{table.game}</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">€{table.float.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
