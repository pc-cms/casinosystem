import { useCMS } from "@/lib/cms-context";
import { Badge } from "@/components/ui/badge";

const Stats = () => {
  const { players, getPlayerStats } = useCMS();

  const playerStats = players.map(p => ({
    ...p,
    stats: getPlayerStats(p.id),
  })).sort((a, b) => b.stats.totalBuy - a.stats.totalBuy);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Player Stats</h1>
        <p className="text-sm text-muted-foreground">Drop, cashout, and results by player</p>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Player</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Tags</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Drop</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Cashout</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map(p => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-card-foreground">{p.firstName} {p.lastName}</span>
                  <span className="text-xs text-muted-foreground ml-2">({p.nickname})</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {p.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px] font-mono">{tag}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">€{p.stats.totalBuy.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">€{p.stats.totalCashout.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono text-sm font-bold ${p.stats.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {p.stats.result >= 0 ? "+" : ""}€{p.stats.result.toLocaleString()}
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
