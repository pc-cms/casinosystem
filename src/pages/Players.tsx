import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Users } from "lucide-react";
import { usePlayers, usePlayerEconomy } from "@/hooks/use-casino-data";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategoryBadge, { CATEGORY_PRIORITY, type PlayerCategory } from "@/components/player/CategoryBadge";
import CategoryFilter from "@/components/player/CategoryFilter";
import FlagBadges from "@/components/player/FlagBadges";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/layout/FilterBar";

const ROW_HEIGHT = 52;

const fmtAmount = (n: number) => {
  if (!n) return "—";
  const cls = n < 0 ? "cms-amount-negative" : "cms-amount-positive";
  return <span className={`font-mono ${cls}`}>{n.toLocaleString()}</span>;
};

const Players = () => {
  const navigate = useNavigate();
  const { data: players = [], isLoading } = usePlayers();
  const { data: economy = [] } = usePlayerEconomy(2000);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [categoryFilter, setCategoryFilter] = useState<Set<PlayerCategory>>(new Set(["diamond", "platinum", "gold", "normal"]));
  const [sortByCategory, setSortByCategory] = useState(true);

  const parentRef = useRef<HTMLDivElement>(null);

  const economyByPlayer = useMemo(() => {
    const m = new Map<string, { drop: number; cashout: number; result: number }>();
    for (const e of economy as any[]) {
      const cur = m.get(e.player_id) || { drop: 0, cashout: 0, result: 0 };
      cur.drop += Number(e.total_drop) || 0;
      cur.cashout += Number(e.total_cashout) || 0;
      cur.result += Number(e.real_result) || 0;
      m.set(e.player_id, cur);
    }
    return m;
  }, [economy]);

  const filtered = useMemo(() => {
    let list = players;
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(p =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        p.player_cards?.some(c => c.card_number.includes(debouncedQuery))
      );
    }
    list = list.filter(p => categoryFilter.has((p.category as PlayerCategory) || "normal"));
    if (sortByCategory) {
      list = [...list].sort((a, b) => {
        const catA = CATEGORY_PRIORITY[(a.category as PlayerCategory) || "normal"];
        const catB = CATEGORY_PRIORITY[(b.category as PlayerCategory) || "normal"];
        if (catA !== catB) return catA - catB;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
    }
    return list;
  }, [players, debouncedQuery, categoryFilter, sortByCategory]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Players"
        subtitle={`${players.length} registered · No deletion`}
        date
      />

      <FilterBar
        search={
          <div className="relative w-[320px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search name, nickname, card…" className="pl-10 font-mono h-9" />
          </div>
        }
        filters={
          <>
            <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
            <Button variant={sortByCategory ? "secondary" : "ghost"} size="sm" className="text-xs h-9 shrink-0" onClick={() => setSortByCategory(!sortByCategory)}>
              Sort: Category
            </Button>
          </>
        }
      />

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {[
                { label: "", w: "80px" },
                { label: "Player", w: "auto" },
                { label: "Nickname", w: "140px" },
                { label: "Card", w: "120px" },
                { label: "Status", w: "90px" },
                { label: "Drop", w: "110px" },
                { label: "Cashout", w: "110px" },
                { label: "Result", w: "110px" },
                { label: "Tags", w: "150px" },
              ].map(h => (
                <th key={h.label || "cat"} style={{ width: h.w }} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-3">{h.label}</th>
              ))}
            </tr>
          </thead>
        </table>
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">No players found</div>
        ) : (
          <div ref={parentRef} className="max-h-[65vh] overflow-y-auto">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const player = filtered[virtualRow.index];
                const econ = economyByPlayer.get(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => navigate(`/players/${player.id}`)}
                    className="flex items-center border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors absolute w-full"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-3 py-3 w-[80px]">
                      <CategoryBadge category={(player.category as PlayerCategory) || "normal"} />
                    </div>
                    <div className="px-3 py-3 flex-1 text-sm font-medium text-card-foreground truncate">{player.first_name} {player.last_name}</div>
                    <div className="px-3 py-3 w-[140px] text-sm text-muted-foreground truncate">{player.nickname}</div>
                    <div className="px-3 py-3 w-[120px] font-mono text-xs text-muted-foreground">
                      {player.player_cards?.find(c => c.is_active)?.card_number || "—"}
                    </div>
                    <div className="px-3 py-3 w-[90px]">
                      <span className={player.status === "active" ? "cms-status-active" : "cms-status-blacklist"}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${player.status === "active" ? "bg-success" : "bg-danger"}`} />
                        {player.status}
                      </span>
                    </div>
                    <div className="px-3 py-3 w-[110px] text-xs">{econ ? fmtAmount(econ.drop) : <span className="text-muted-foreground">·</span>}</div>
                    <div className="px-3 py-3 w-[110px] text-xs">{econ ? fmtAmount(econ.cashout) : <span className="text-muted-foreground">·</span>}</div>
                    <div className="px-3 py-3 w-[110px] text-xs">{econ ? fmtAmount(econ.result) : <span className="text-muted-foreground">·</span>}</div>
                    <div className="px-3 py-3 w-[150px]">
                      <FlagBadges tags={player.player_tags?.map(t => t.tag) || []} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Players;
