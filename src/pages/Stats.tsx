import { usePlayerEconomy, usePlayers } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

const Stats = () => {
  const { data: economy = [] } = usePlayerEconomy();
  const { data: players = [] } = usePlayers();

  const enriched = economy.map(e => {
    const player = players.find(p => p.id === e.player_id);
    return { ...e, tags: player?.player_tags?.map(t => t.tag) || [] };
  }).sort((a, b) => Number(b.total_drop) - Number(a.total_drop));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Player Stats</h1>
        <p className="text-sm text-muted-foreground">REAL RESULT = CASHOUT - DROP - EXPENSES</p>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Player", "Tags", "Drop", "Cashout", "Expenses", "Real Result"].map(h => (
                <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-4 py-3 ${["Drop","Cashout","Expenses","Real Result"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No data</td></tr>
            ) : enriched.map(p => (
              <tr key={p.player_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-card-foreground">{p.first_name} {p.last_name}</span>
                  {p.nickname && <span className="text-xs text-muted-foreground ml-2">({p.nickname})</span>}
                </td>
                <td className="px-4 py-3"><div className="flex gap-1">{p.tags.map(t => <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>)}</div></td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">{formatCurrency(Number(p.total_drop))}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">{formatCurrency(Number(p.total_cashout))}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">{formatCurrency(Number(p.total_expenses))}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono text-sm font-bold ${Number(p.real_result) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {Number(p.real_result) >= 0 ? "+" : ""}{formatCurrency(Number(p.real_result))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Stats;
