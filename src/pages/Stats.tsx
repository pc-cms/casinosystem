import { usePlayerEconomy, usePlayers } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * STRICT PLAYER STATS:
 * DROP = all BUY-INs
 * CASHOUT = all CASHOUTs
 * RESULT = CASHOUT - DROP (financial fact only)
 * REAL RESULT = CASHOUT - DROP - EXPENSES
 * No gameplay tracking. No table tracking per player. Only financial facts.
 */
const Stats = () => {
  const { data: economy = [] } = usePlayerEconomy();
  const { data: players = [] } = usePlayers();

  const enriched = economy.map(e => {
    const player = players.find(p => p.id === e.player_id);
    const drop = Number(e.total_drop || 0);
    const cashout = Number(e.total_cashout || 0);
    const expenses = Number(e.total_expenses || 0);
    const result = cashout - drop;
    const realResult = cashout - drop - expenses;
    return {
      ...e,
      tags: player?.player_tags?.map(t => t.tag) || [],
      drop, cashout, expenses, result, realResult,
    };
  }).sort((a, b) => b.drop - a.drop);

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title="Player Stats"
        subtitle="RESULT = CASHOUT − DROP · REAL RESULT = CASHOUT − DROP − EXPENSES"
      />

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Player", "Tags", "Drop", "Cashout", "Result", "Expenses", "Real Result"].map(h => (
                <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-4 py-3 ${["Drop","Cashout","Result","Expenses","Real Result"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-8">No data</td></tr>
            ) : enriched.map(p => (
              <tr key={p.player_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-card-foreground">{p.first_name} {p.last_name}</span>
                  {p.nickname && <span className="text-xs text-muted-foreground ml-2">({p.nickname})</span>}
                </td>
                <td className="px-4 py-3"><div className="flex gap-1">{p.tags.map(t => <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>)}</div></td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">{formatCurrency(p.drop)}</td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">{formatCurrency(p.cashout)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono text-sm font-bold ${p.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {p.result >= 0 ? "+" : ""}{formatCurrency(p.result)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-card-foreground">{formatCurrency(p.expenses)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono text-sm font-bold ${p.realResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {p.realResult >= 0 ? "+" : ""}{formatCurrency(p.realResult)}
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
