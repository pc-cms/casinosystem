import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlayers, useTransactions, useGamingTables } from "@/hooks/use-casino-data";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import CategoryFilter from "@/components/player/CategoryFilter";
import FlagBadges from "@/components/player/FlagBadges";
import { formatCurrency } from "@/lib/currency";

type TabKey = "day" | "present" | "left";

const formatTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const PlayerStatistics = () => {
  const navigate = useNavigate();
  const { casinoId, roles } = useAuth();
  const today = getBusinessDate();
  const windowStartUTC = businessDayHourUTC(today, 13);

  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(today);

  const [tab, setTab] = useState<TabKey>("day");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<PlayerCategory>>(
    new Set(["diamond", "platinum", "gold", "normal"])
  );

  const showFinancials = canSeePlayerFinancials(roles);

  const { data: visits = [] } = useQuery({
    queryKey: ["casino_visits", casinoId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("casino_visits")
        .select("*")
        .eq("casino_id", casinoId!)
        .eq("date", today);
      return (data || []) as any[];
    },
    enabled: !!casinoId,
    refetchInterval: 15000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["client_sessions", casinoId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_sessions")
        .select("*")
        .eq("casino_id", casinoId!)
        .gte("started_at", windowStartUTC)
        .order("started_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!casinoId,
    refetchInterval: 15000,
  });

  const tableNameById = useMemo(() => {
    const m: Record<string, string> = {};
    tables.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [tables]);

  // Active session per player (for Present)
  const activeSessionByPlayer = useMemo(() => {
    const m: Record<string, any> = {};
    for (const s of sessions) {
      if (!s.stopped_at && !m[s.player_id]) m[s.player_id] = s;
    }
    return m;
  }, [sessions]);

  // Build per-player day rows
  const rows = useMemo(() => {
    const playerById: Record<string, any> = {};
    players.forEach(p => { playerById[p.id] = p; });

    return visits.map((v: any) => {
      const p = playerById[v.player_id];
      if (!p) return null;
      const cat = ((p as any).category as PlayerCategory) || "normal";

      const playerTx = transactions.filter((t: any) => t.player_id === v.player_id);
      const inDrop = playerTx
        .filter((t: any) => t.type === "buy" || t.type === "in")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const out = playerTx
        .filter((t: any) => t.type === "cashout" || t.type === "out")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const result = inDrop - out;

      const activeSession = activeSessionByPlayer[v.player_id];
      const isPresent = !v.checked_out_at;
      const tableName = activeSession?.table_id ? tableNameById[activeSession.table_id] : null;

      return {
        id: v.id,
        playerId: v.player_id,
        firstName: p.first_name,
        lastName: p.last_name,
        nickname: (p as any).nickname,
        category: cat,
        flags: ((p as any).player_tags || []).map((t: any) => t.tag),
        entryAt: v.checked_in_at as string,
        exitAt: v.checked_out_at as string | null,
        position: v.position as string,
        tableName,
        avgBet: activeSession ? Number(activeSession.avg_bet || 0) : 0,
        inDrop,
        out,
        result,
        isPresent,
      };
    }).filter(Boolean) as Array<NonNullable<ReturnType<typeof Object>>>;
  }, [visits, players, transactions, activeSessionByPlayer, tableNameById]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === "present") list = list.filter((r: any) => r.isPresent);
    if (tab === "left") list = list.filter((r: any) => !r.isPresent);
    list = list.filter((r: any) => categoryFilter.has(r.category));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r: any) =>
        `${r.firstName} ${r.lastName} ${r.nickname ?? ""}`.toLowerCase().includes(q)
      );
    }
    // Sort: present first (active), most recent entry first
    return [...list].sort((a: any, b: any) => {
      if (a.isPresent !== b.isPresent) return a.isPresent ? -1 : 1;
      return new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime();
    });
  }, [rows, tab, categoryFilter, search]);

  const counts = useMemo(() => ({
    day: rows.length,
    present: rows.filter((r: any) => r.isPresent).length,
    left: rows.filter((r: any) => !r.isPresent).length,
  }), [rows]);

  const renderRow = (r: any) => (
    <tr
      key={r.id}
      onClick={() => navigate(`/players/${r.playerId}`)}
      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
    >
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryBadge category={r.category} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-card-foreground truncate">
              {r.firstName} {r.lastName}
              {r.nickname && <span className="text-muted-foreground font-normal"> "{r.nickname}"</span>}
            </p>
            {r.flags?.length > 0 && <FlagBadges tags={r.flags} compact />}
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5">
        {r.isPresent ? (
          r.tableName ? (
            <Badge variant="outline" className="text-[10px] font-mono">{r.tableName}</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Hall</Badge>
          )
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 font-mono text-xs">{formatTime(r.entryAt)}</td>
      <td className="px-2 py-1.5 font-mono text-xs">{r.exitAt ? formatTime(r.exitAt) : "·"}</td>
      {showFinancials && (
        <>
          <td className="px-2 py-1.5 font-mono text-xs text-right">
            {r.avgBet > 0 ? formatCurrency(r.avgBet) : "·"}
          </td>
          <td className="px-2 py-1.5 font-mono text-xs text-right">
            {r.inDrop > 0 ? formatCurrency(r.inDrop) : "·"}
          </td>
          <td className="px-2 py-1.5 font-mono text-xs text-right">
            {r.out > 0 ? formatCurrency(r.out) : "·"}
          </td>
          <td className={`px-2 py-1.5 font-mono text-xs text-right font-bold ${
            r.result > 0 ? "cms-amount-positive" : r.result < 0 ? "cms-amount-negative" : ""
          }`}>
            {r.result !== 0 ? `${r.result > 0 ? "+" : ""}${formatCurrency(r.result)}` : "·"}
          </td>
        </>
      )}
    </tr>
  );

  return (
    <PageShell>
      <PageHeader
        icon={BarChart3}
        title="Player Statistics"
        subtitle="Today's visitors — entry, position, results"
        date={true}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger
              value="day"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:border-primary/40 border border-transparent"
            >
              Daily
              <Badge className="ml-1.5 text-[10px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">{counts.day}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="present"
              className="data-[state=active]:bg-success/15 data-[state=active]:text-success data-[state=active]:border-success/40 border border-transparent"
            >
              Present
              <Badge className="ml-1.5 text-[10px] bg-success/20 text-success border-success/30 hover:bg-success/20">{counts.present}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="left"
              className="data-[state=active]:bg-muted data-[state=active]:text-muted-foreground data-[state=active]:border-border border border-transparent"
            >
              Left
              <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.left}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        <TabsContent value={tab} className="mt-0">
          <div className="cms-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 text-left">Player</th>
                    <th className="px-2 py-2 text-left">Position</th>
                    <th className="px-2 py-2 text-left">Entry</th>
                    <th className="px-2 py-2 text-left">Exit</th>
                    {showFinancials && (
                      <>
                        <th className="px-2 py-2 text-right">Avg Bet</th>
                        <th className="px-2 py-2 text-right">In / Drop</th>
                        <th className="px-2 py-2 text-right">Out</th>
                        <th className="px-2 py-2 text-right">Result</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={showFinancials ? 8 : 4} className="px-2 py-8 text-center text-muted-foreground text-xs">
                        No players to display
                      </td>
                    </tr>
                  ) : (
                    filtered.map(renderRow)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default PlayerStatistics;
