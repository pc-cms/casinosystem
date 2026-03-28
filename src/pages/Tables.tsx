import { useGamingTables, useTransactions } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { CHIP_COLORS, formatChipLabel, formatCurrency } from "@/lib/currency";

const Tables = () => {
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tables</h1>
        <p className="text-sm text-muted-foreground">Table management & status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tables.map(table => {
          const tableTxs = transactions.filter(t => t.table_id === table.id);
          const totalDrop = tableTxs.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0);
          const totalCashout = tableTxs.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0);

          return (
            <div key={table.id} className="cms-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${table.status === "open" ? "bg-success" : "bg-danger"}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{table.name}</h3>
                    <p className="text-xs text-muted-foreground">{table.game}</p>
                  </div>
                </div>
                <Badge variant={table.status === "open" ? "default" : "secondary"} className="text-[10px] uppercase">{table.status}</Badge>
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-3">
                <div><p className="text-[10px] uppercase text-muted-foreground tracking-wider">Float</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(Number(table.float_amount))}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground tracking-wider">Drop</p><p className="font-mono text-sm font-bold cms-amount-negative">{formatCurrency(totalDrop)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground tracking-wider">Win</p><p className={`font-mono text-sm font-bold ${totalDrop - totalCashout >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{formatCurrency(Math.abs(totalDrop - totalCashout))}</p></div>
              </div>
              <div className="px-4 py-2 border-t border-border flex gap-1.5 flex-wrap">
                {table.denominations?.map(d => <span key={d} className={`cms-chip text-[10px] ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>{formatChipLabel(d)}</span>)}
              </div>
            </div>
          );
        })}
        {tables.length === 0 && <p className="text-muted-foreground text-sm col-span-2 text-center py-8">No tables configured</p>}
      </div>
    </div>
  );
};

export default Tables;
