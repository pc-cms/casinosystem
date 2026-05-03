import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Search, ArrowLeftRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlayers, useTransactions, useGamingTables } from "@/hooks/use-casino-data";
import { useChipTransfers } from "@/hooks/use-chip-transfers";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { Button } from "@/components/ui/button";
import ChipTransferDialog from "@/components/player/ChipTransferDialog";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import CategoryFilter from "@/components/player/CategoryFilter";
import FlagBadges from "@/components/player/FlagBadges";
import { formatCurrency } from "@/lib/currency";
import { offlineMutation } from "@/lib/offline-mutation";
import { toast } from "sonner";

type TabKey = "day" | "present" | "left";

const formatTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const PlayerStatistics = () => {
  const navigate = useNavigate();
  const { casinoId, roles, user } = useAuth();
  const today = getBusinessDate();
  const windowStartUTC = businessDayHourUTC(today, 13);
  const queryClient = useQueryClient();
  const canEditPosition = roles.some(r => ["pit", "manager", "reception", "super_admin"].includes(r));

  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(today);
  const { data: chipTransfers = [] } = useChipTransfers(today);

  const [tab, setTab] = useState<TabKey>("day");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<PlayerCategory>>(
    new Set(["diamond", "platinum", "gold", "normal"])
  );
  const [posFilter, setPosFilter] = useState<"mix" | "table" | "slots">("mix");
  const [transferPlayer, setTransferPlayer] = useState<{ id: string; first_name: string; last_name: string; nickname?: string | null } | null>(null);
  type SortKey = "name" | "position" | "entry" | "exit" | "avgBet" | "inDrop" | "out" | "chipIn" | "chipOut" | "chipDelta" | "result";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const showFinancials = canSeePlayerFinancials(roles);
  const canTransfer = roles.some(r => ["pit", "manager", "super_admin"].includes(r));

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

  // Sum chip transfers per player for today
  const chipByPlayer = useMemo(() => {
    const m = new Map<string, { in: number; out: number }>();
    for (const ct of chipTransfers as any[]) {
      let cur = m.get(ct.player_id);
      if (!cur) { cur = { in: 0, out: 0 }; m.set(ct.player_id, cur); }
      if (ct.direction === "in") cur.in += Number(ct.amount) || 0;
      else cur.out += Number(ct.amount) || 0;
    }
    return m;
  }, [chipTransfers]);

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
      const chip = chipByPlayer.get(v.player_id) || { in: 0, out: 0 };
      // Result via NEP semantics: (cash in + chip in) − (cash out + chip out)
      const result = (out + chip.out) - (inDrop + chip.in);

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
        chipIn: chip.in,
        chipOut: chip.out,
        chipDelta: chip.in - chip.out,
        result,
        isPresent,
      };
    }).filter(Boolean) as Array<NonNullable<ReturnType<typeof Object>>>;
  }, [visits, players, transactions, chipByPlayer, activeSessionByPlayer, tableNameById]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === "present") list = list.filter((r: any) => r.isPresent);
    if (tab === "left") list = list.filter((r: any) => !r.isPresent);
    list = list.filter((r: any) => categoryFilter.has(r.category));
    if (posFilter === "table") list = list.filter((r: any) => r.position === "table");
    else if (posFilter === "slots") list = list.filter((r: any) => r.position === "slots");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r: any) =>
        `${r.firstName} ${r.lastName} ${r.nickname ?? ""}`.toLowerCase().includes(q)
      );
    }
    // Default sort: present first, recent entry first. Override when user clicked a column.
    return [...list].sort((a: any, b: any) => {
      if (sortKey) {
        const dir = sortDir === "asc" ? 1 : -1;
        const get = (r: any) => {
          switch (sortKey) {
            case "name": return `${r.firstName} ${r.lastName}`.toLowerCase();
            case "position": return r.position === "table" ? (r.tableName ?? "zzz") : r.position;
            case "entry": return new Date(r.entryAt).getTime();
            case "exit": return r.exitAt ? new Date(r.exitAt).getTime() : 0;
            case "avgBet": return r.avgBet;
            case "inDrop": return r.inDrop;
            case "out": return r.out;
            case "chipIn": return r.chipIn;
            case "chipOut": return r.chipOut;
            case "chipDelta": return r.chipDelta;
            case "result": return r.result;
          }
        };
        const av = get(a), bv = get(b);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      }
      if (a.isPresent !== b.isPresent) return a.isPresent ? -1 : 1;
      return new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime();
    });
  }, [rows, tab, categoryFilter, posFilter, search, sortKey, sortDir]);

  const counts = useMemo(() => ({
    day: rows.length,
    present: rows.filter((r: any) => r.isPresent).length,
    left: rows.filter((r: any) => !r.isPresent).length,
  }), [rows]);

  // (user already destructured from useAuth above)

  // Position change: handles "hall", "slots", or specific table id (UUID).
  // Picking a table creates a new client_sessions row with min avg bet (10000 poker/BJ, 2000 roulette).
  // Picking hall/slots stops any active session and updates visit position.
  const setPosition = useMutation({
    mutationFn: async ({ visitId, playerId, newPos }: { visitId: string; playerId: string; newPos: string }) => {
      const isTable = newPos !== "hall" && newPos !== "slots";
      const visitPosition = isTable ? "table" : newPos;

      // Always stop any open session first (so a new table or hall/slots is clean).
      await offlineMutation({
        table: "client_sessions",
        operation: "update",
        payload: {
          _match: { casino_id: casinoId!, player_id: playerId, stopped_at: null as any },
          stopped_at: new Date().toISOString(),
        },
      });

      // Update visit position (DB trigger writes player_position_history).
      const res = await offlineMutation({
        table: "casino_visits",
        operation: "update",
        payload: { _match: { id: visitId }, position: visitPosition },
      });
      if (res.error) throw new Error(res.error);

      // Start a new session at the chosen table.
      if (isTable) {
        const tbl = tables.find(t => t.id === newPos);
        const isRoulette = tbl ? /roulette/i.test(tbl.game) : false;
        const avgBet = isRoulette ? 2000 : 10000;
        const insRes = await offlineMutation({
          table: "client_sessions",
          operation: "insert",
          payload: {
            id: crypto.randomUUID(),
            casino_id: casinoId!,
            player_id: playerId,
            table_id: newPos,
            avg_bet: avgBet,
            created_by: user!.id,
          },
        });
        if (insRes.error) throw new Error(insRes.error);
      }
      return { offline: res.offline };
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      queryClient.invalidateQueries({ queryKey: ["client_sessions"] });
      toast.success(res?.offline ? "Saved offline" : "Position updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Open tables (skip closed/archived) for the dropdown.
  const openTables = useMemo(
    () => tables.filter((t: any) => t.status === "open"),
    [tables]
  );

  const renderPositionCell = (r: any) => {
    if (!r.isPresent) return <span className="text-[10px] text-muted-foreground">—</span>;

    // Current value: table id if seated at one, else "hall" or "slots".
    const activeSession = activeSessionByPlayer[r.playerId];
    const currentValue = r.position === "table" && activeSession?.table_id
      ? activeSession.table_id
      : (r.position === "slots" ? "slots" : "hall");

    if (!canEditPosition) {
      return r.position === "table" ? (
        r.tableName ? (
          <Badge variant="outline" className="text-[10px] font-mono">{r.tableName}</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Table</Badge>
        )
      ) : r.position === "slots" ? (
        <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Slots</Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px]">Hall</Badge>
      );
    }
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          value={currentValue}
          onValueChange={(v) => setPosition.mutate({ visitId: r.id, playerId: r.playerId, newPos: v })}
          disabled={setPosition.isPending}
        >
          <SelectTrigger className="h-6 px-1.5 py-0 text-[10px] w-full min-w-0">
            <SelectValue>
              {currentValue === "hall" ? "Hall"
                : currentValue === "slots" ? "Slots"
                : <span className="font-mono truncate">{r.tableName ?? "T"}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hall">Hall</SelectItem>
            <SelectItem value="slots">Slots</SelectItem>
            {openTables.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="font-mono">{t.name}</span>
                <span className="text-muted-foreground text-[10px] ml-1.5">{t.game}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderRow = (r: any) => (
    <tr
      key={r.id}
      onClick={() => navigate(`/players/${r.playerId}`)}
      className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
    >
      <td className="px-2 py-1.5 max-w-[180px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <CategoryBadge category={r.category} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-card-foreground truncate">
              {r.firstName} {r.lastName}
            </p>
            {r.flags?.length > 0 && <FlagBadges tags={r.flags} compact />}
          </div>
        </div>
      </td>
      <td className="px-1 py-1.5 w-[110px]">{renderPositionCell(r)}</td>
      <td className="px-1 py-1.5 font-mono text-xs w-[44px] text-center">{formatTime(r.entryAt)}</td>
      <td className="px-1 py-1.5 font-mono text-xs w-[44px] text-center">{r.exitAt ? formatTime(r.exitAt) : "·"}</td>
      {showFinancials && (
        <>
          <td className="px-2 py-1.5 font-mono text-xs text-right w-[80px]">
            {r.avgBet > 0 ? formatCurrency(r.avgBet) : "·"}
          </td>
          <td className="px-2 py-1.5 font-mono text-xs text-right w-[110px]">
            {r.inDrop > 0 ? formatCurrency(r.inDrop) : "·"}
          </td>
          <td className="px-2 py-1.5 font-mono text-xs text-right w-[110px]">
            {r.out > 0 ? formatCurrency(r.out) : "·"}
          </td>
          <td className="px-2 py-1.5 font-mono text-xs text-right text-success w-[95px]">
            {r.chipIn > 0 ? formatCurrency(r.chipIn) : "·"}
          </td>
          <td className="px-2 py-1.5 font-mono text-xs text-right text-destructive w-[95px]">
            {r.chipOut > 0 ? formatCurrency(r.chipOut) : "·"}
          </td>
          <td className={`px-2 py-1.5 font-mono text-xs text-right w-[95px] ${
            r.chipDelta > 0 ? "cms-amount-positive" : r.chipDelta < 0 ? "cms-amount-negative" : ""
          }`}>
            {r.chipDelta !== 0 ? `${r.chipDelta > 0 ? "+" : ""}${formatCurrency(r.chipDelta)}` : "·"}
          </td>
          <td className={`px-2 py-1.5 font-mono text-xs text-right font-bold w-[110px] ${
            r.result > 0 ? "cms-amount-positive" : r.result < 0 ? "cms-amount-negative" : ""
          }`}>
            {r.result !== 0 ? `${r.result > 0 ? "+" : ""}${formatCurrency(r.result)}` : "·"}
          </td>
        </>
      )}
      {canTransfer && (
        <td className="px-1 py-1.5 text-right w-8">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Chip Transfer"
            onClick={(e) => {
              e.stopPropagation();
              setTransferPlayer({
                id: r.playerId,
                first_name: r.firstName,
                last_name: r.lastName,
                nickname: r.nickname,
              });
            }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </Button>
        </td>
      )}
    </tr>
  );

  const presentPlayerIds = useMemo(
    () => new Set(rows.filter((r: any) => r.isPresent).map((r: any) => r.playerId)),
    [rows]
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
                    {(() => {
                      const SortIcon = ({ k }: { k: SortKey }) =>
                        sortKey !== k ? <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />
                          : sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" />
                          : <ArrowDown className="w-3 h-3 inline ml-1" />;
                      const H = ({ k, align = "left", children, title }: { k: SortKey; align?: "left" | "right"; children: any; title?: string }) => (
                        <th
                          title={title}
                          className={`px-2 py-2 cursor-pointer select-none hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`}
                          onClick={() => toggleSort(k)}
                        >
                          {children}<SortIcon k={k} />
                        </th>
                      );
                      return (
                        <>
                          <H k="name">Player</H>
                          <H k="position">Position</H>
                          <H k="entry">Entry</H>
                          <H k="exit">Exit</H>
                          {showFinancials && (
                            <>
                              <H k="avgBet" align="right">Avg Bet</H>
                              <H k="inDrop" align="right" title="Drop R — external cash buy-ins">Drop R</H>
                              <H k="out" align="right">Out</H>
                              <H k="chipIn" align="right" title="Chips received from another player (NEP-tracked, no cash)">Chip In</H>
                              <H k="chipOut" align="right" title="Chips given to another player (NEP-tracked, no cash)">Chip Out</H>
                              <H k="chipDelta" align="right">Chip Δ</H>
                              <H k="result" align="right">Result</H>
                            </>
                          )}
                        </>
                      );
                    })()}
                    {canTransfer && <th className="px-2 py-2 text-right w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4 + (showFinancials ? 7 : 0) + (canTransfer ? 1 : 0)} className="px-2 py-8 text-center text-muted-foreground text-xs">
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

      <ChipTransferDialog
        open={!!transferPlayer}
        onOpenChange={(v) => { if (!v) setTransferPlayer(null); }}
        player={transferPlayer}
        defaultDirection="out"
        presentPlayerIds={presentPlayerIds}
      />
    </PageShell>
  );
};

export default PlayerStatistics;
