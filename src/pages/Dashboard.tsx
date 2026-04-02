import { useMemo } from "react";
import { Users, Landmark, Receipt, TrendingDown, AlertTriangle, Clock } from "lucide-react";
import { CardSkeleton, PlayerListSkeleton } from "@/components/LoadingSkeletons";
import { usePlayers, useTransactions, useGamingTables, useExpenses, useClientSessionsTotalBet, useTableTracker, usePlayerEconomy } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { getBusinessDate } from "@/lib/business-day";
import { useStaffMembers, useStaffRotaRange, DEPARTMENT_LABELS, STAFF_SHIFT_LABELS, STAFF_SHIFT_COLORS } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

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

const useTodayVisits = () => {
  const { casinoId } = useAuth();
  const today = getBusinessDate();
  return useQuery({
    queryKey: ["casino-visits-today", casinoId, today],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select("*, players(first_name, last_name, nickname, photo_url, status, player_tags(tag), id_number)")
        .eq("casino_id", casinoId)
        .eq("date", today)
        .is("checked_out_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId,
  });
};

const Dashboard = () => {
  const { displayName, roles, isManager, casinoId } = useAuth();
  const businessDate = getBusinessDate();
  const { data: players = [], isLoading: loadingPlayers } = usePlayers();
  const { data: transactions = [], isLoading: loadingTx } = useTransactions(businessDate);
  const { data: tables = [] } = useGamingTables();
  const { data: expenses = [] } = useExpenses(businessDate);
  const { data: sessionsTotalBet = 0 } = useClientSessionsTotalBet();
  const { data: trackerData = [] } = useTableTracker(businessDate);
  const { data: economy = [] } = usePlayerEconomy();
  const { data: staffMembers = [] } = useStaffMembers();
  const { data: staffRota = [] } = useStaffRotaRange(businessDate, businessDate);
  const { data: visits = [] } = useTodayVisits();

  // Show skeleton while critical data loads
  const isInitialLoading = loadingPlayers && loadingTx;
  const showFinancials = canSeePlayerFinancials(roles);
  const activePlayers = players.filter(p => p.status === "active").length;
  const buyInDrop = transactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0);
  const totalDrop = buyInDrop + sessionsTotalBet;
  const pendingExpenses = expenses.filter(e => !e.approved).length;

  // Floor staff on shift today
  const floorStaffOnShift = useMemo(() => {
    const rotaMap = new Map<string, string>();
    staffRota.forEach((r: any) => { rotaMap.set(r.staff_id, r.shift); });
    return staffMembers
      .filter(s => s.is_active && rotaMap.has(s.id) && rotaMap.get(s.id) !== "O" && rotaMap.get(s.id) !== "L")
      .map(s => ({ ...s, shift: rotaMap.get(s.id)! }));
  }, [staffMembers, staffRota]);

  // Players in casino with incomplete data flag
  const playersInCasino = useMemo(() => {
    return visits.map((v: any) => {
      const p = v.players;
      const missing: string[] = [];
      if (!p?.photo_url) missing.push("photo");
      if (!p?.first_name || !p?.last_name) missing.push("name");
      if (!p?.id_number) missing.push("ID");
      return {
        visitId: v.id,
        playerId: v.player_id,
        name: `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Unknown",
        nickname: p?.nickname,
        photoUrl: p?.photo_url,
        status: p?.status,
        position: v.position,
        checkedInAt: v.checked_in_at,
        tags: (p?.player_tags || []).map((t: any) => t.tag),
        incomplete: missing,
      };
    });
  }, [visits]);

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

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">Loading...</p>
        </div>
        <CardSkeleton count={4} />
        <PlayerListSkeleton count={4} />
      </div>
    );
  }

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
        
        {showFinancials && (
          isManager ? (
            <StatCard label="Pending Expenses" value={pendingExpenses} icon={Receipt} href="/expenses" />
          ) : (
            <div className="cms-panel p-4 opacity-75">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Expenses</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-card-foreground">{pendingExpenses}</p>
                </div>
                <div className="p-2 rounded-md bg-muted text-muted-foreground">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Manager access required</p>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Players in Casino */}
        <div className="cms-panel">
          <div className="cms-header flex items-center justify-between">
            <span>Guests</span>
            <span className="text-xs font-mono text-muted-foreground">{playersInCasino.length} players</span>
          </div>
          <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
            {playersInCasino.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No players checked in</p>
            ) : playersInCasino.map((p) => (
              <div key={p.visitId} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-card-foreground truncate">{p.name}</span>
                      {p.nickname && <span className="text-xs text-muted-foreground">({p.nickname})</span>}
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        p.status === "blacklist" ? "bg-destructive/20 text-destructive" :
                        p.position === "hall" ? "bg-muted text-muted-foreground" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {p.position || "hall"}
                      </span>
                      {p.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[10px] px-1 py-0.5 rounded bg-accent text-accent-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{formatDistanceToNow(new Date(p.checkedInAt), { addSuffix: false })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floor Staff on Shift */}
        <div className="cms-panel">
          <div className="cms-header flex items-center justify-between">
            <span>Floor Staff on Shift</span>
            <span className="text-xs font-mono text-muted-foreground">{floorStaffOnShift.length} staff</span>
          </div>
          <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
            {floorStaffOnShift.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No rota data for today</p>
            ) : floorStaffOnShift.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-card-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{DEPARTMENT_LABELS[s.department]}</span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${STAFF_SHIFT_COLORS[s.shift] || "bg-muted text-muted-foreground"}`}>
                  {STAFF_SHIFT_LABELS[s.shift] || s.shift}
                </span>
              </div>
            ))}
          </div>
        </div>

        {showFinancials && (
          <div className="cms-panel">
            <div className="cms-header">Top Players</div>
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

        {showFinancials && (
          <div className="cms-panel">
            <div className="cms-header">Tables</div>
            <div className="p-4 space-y-1">
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tables</p>
              ) : tables.map(table => {
                const trackerVal = tableTrackerTotals[table.id] || 0;
                const result = table.closing_result !== null ? Number(table.closing_result) : trackerVal;
                return (
                  <div key={table.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-card-foreground">{table.name}</span>
                      <span className="text-xs text-muted-foreground">{table.game}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${table.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {table.status}
                      </span>
                    </div>
                    <span className={`font-mono text-xs font-bold ${result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      {result >= 0 ? "+" : ""}{formatCurrency(result)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
