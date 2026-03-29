import { useMemo } from "react";
import { usePlayers, useTransactions } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { formatNumberSpaces } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

const ActivePlayers = () => {
  const { data: players = [] } = usePlayers();
  const today = new Date().toISOString().split("T")[0];
  const { data: transactions = [] } = useTransactions(today);

  const { casinoId } = useAuth();

  const { data: allTags = [] } = useQuery({
    queryKey: ["player_tags", casinoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_tags")
        .select("player_id, tag");
      return data || [];
    },
    enabled: !!casinoId,
  });

  const activePlayers = useMemo(() => {
    return players
      .filter(p => p.status === "active")
      .map(p => {
        const playerTx = transactions.filter((t: any) => t.player_id === p.id);
        const drop = playerTx.filter((t: any) => t.type === "buy").reduce((s: number, t: any) => s + Number(t.amount), 0);
        const cashout = playerTx.filter((t: any) => t.type === "cashout").reduce((s: number, t: any) => s + Number(t.amount), 0);
        const tags = allTags.filter(t => t.player_id === p.id).map(t => t.tag);
        return { ...p, drop, cashout, tags };
      })
      .sort((a, b) => b.drop - a.drop);
  }, [players, transactions, allTags]);

  const playersWithActivity = activePlayers.filter(p => p.drop > 0 || p.cashout > 0);
  const playersWithout = activePlayers.filter(p => p.drop === 0 && p.cashout === 0);

  return (
    <div className="space-y-4">
      <div className="cms-panel">
        <div className="px-4 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-card-foreground">Today's Active ({playersWithActivity.length})</h3>
        </div>
        {playersWithActivity.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">No player activity today</p>
        ) : (
          <div className="divide-y divide-border">
            {playersWithActivity.map((p, idx) => (
              <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-card-foreground truncate">
                      {p.first_name} {p.last_name}
                    </span>
                    {p.nickname && (
                      <span className="text-xs text-muted-foreground">"{p.nickname}"</span>
                    )}
                  </div>
                  {p.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {p.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Drop</div>
                    <div className="text-sm font-mono font-bold text-card-foreground">{formatNumberSpaces(p.drop)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Cash</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">{formatNumberSpaces(p.cashout)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cms-panel">
        <div className="px-4 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-muted-foreground">All Active Players ({playersWithout.length})</h3>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {playersWithout.map((p, idx) => (
            <div key={p.id} className={`flex items-center justify-between px-4 py-2 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm text-card-foreground">
                  {p.first_name} {p.last_name}
                </span>
                {p.nickname && (
                  <span className="text-xs text-muted-foreground">"{p.nickname}"</span>
                )}
              </div>
              {p.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {p.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivePlayers;
