import { useState, useMemo } from "react";
import { usePlayers, useTransactions, useGamingTables } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ArrowUpDown, ArrowUp, ArrowDown, LogIn, LogOut, Search, MapPin, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type SortKey = "name" | "dropR" | "dropT" | "cashout" | "result";
type SortDir = "asc" | "desc";

const ActivePlayers = () => {
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const today = new Date().toISOString().split("T")[0];
  const { data: transactions = [] } = useTransactions(today);
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();

  const [sortKey, setSortKey] = useState<SortKey>("dropR");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(["slots", "table", "mix"]));
  const [placingPlayer, setPlacingPlayer] = useState<string | null>(null);
  const [placingTable, setPlacingTable] = useState<string | null>(null);
  const [placingBet, setPlacingBet] = useState("");

  const { data: allTags = [] } = useQuery({
    queryKey: ["player_tags", casinoId],
    queryFn: async () => {
      const { data } = await supabase.from("player_tags").select("player_id, tag");
      return data || [];
    },
    enabled: !!casinoId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["client_sessions", casinoId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_sessions")
        .select("*")
        .eq("casino_id", casinoId!)
        .gte("created_at", `${today}T00:00:00`)
        .order("started_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!casinoId,
    refetchInterval: 15000,
  });

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

   const checkIn = useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase.from("casino_visits").upsert(
        {
          casino_id: casinoId!,
          player_id: playerId,
          date: today,
          checked_in_by: user!.id,
        },
        { onConflict: "casino_id,player_id,date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      toast.success("Player checked in");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const placeAtTable = useMutation({
    mutationFn: async ({ playerId, tableId, avgBet }: { playerId: string; tableId: string; avgBet: number }) => {
      const { error } = await supabase.from("client_sessions").insert({
        casino_id: casinoId!,
        player_id: playerId,
        table_id: tableId,
        avg_bet: avgBet,
        created_by: user!.id,
      });
      if (error) throw error;
      await supabase.from("casino_visits").upsert(
        {
          casino_id: casinoId!,
          player_id: playerId,
          date: today,
          checked_in_by: user!.id,
        },
        { onConflict: "casino_id,player_id,date" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      setPlacingPlayer(null);
      setPlacingTable(null);
      setPlacingBet("");
      setSearch("");
      toast.success("Session started & player checked in");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase
        .from("casino_visits")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("casino_id", casinoId!)
        .eq("player_id", playerId)
        .eq("date", today);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      toast.success("Player checked out");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activePlayers = useMemo(() => {
    const txPlayerIds = new Set(transactions.map((t: any) => t.player_id));
    const activeSessions = sessions.filter((s: any) => !s.stopped_at);
    const sessionPlayerIds = new Set(activeSessions.map((s: any) => s.player_id));
    const visitPlayerIds = new Set(
      visits.filter((v: any) => !v.checked_out_at).map((v: any) => v.player_id)
    );

    const relevantIds = new Set([...txPlayerIds, ...sessionPlayerIds, ...visitPlayerIds]);

    const list = players
      .filter(p => relevantIds.has(p.id))
      .map(p => {
        const playerTx = transactions.filter((t: any) => t.player_id === p.id);
        const dropR = playerTx.filter((t: any) => t.type === "buy").reduce((s: number, t: any) => s + Number(t.amount), 0);
        const cashout = playerTx.filter((t: any) => t.type === "cashout").reduce((s: number, t: any) => s + Number(t.amount), 0);
        const playerAllSessions = sessions.filter((s: any) => s.player_id === p.id);
        const dropV = playerAllSessions.reduce((s: number, ses: any) => s + Number(ses.total_bet || 0), 0);
        const dropT = dropR + dropV;
        const result = dropR - cashout;
        const tags = allTags.filter(t => t.player_id === p.id).map(t => t.tag);
        const activeSession = activeSessions.find((s: any) => s.player_id === p.id);
        const table = activeSession?.table_id ? tables.find(t => t.id === activeSession.table_id) : null;
        const visit = visits.find((v: any) => v.player_id === p.id);
        const isCheckedIn = visit && !visit.checked_out_at;

        // First seen: earliest of transaction, session, or visit check-in
        const times: number[] = [];
        const firstTx = playerTx.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        if (firstTx) times.push(new Date(firstTx.created_at).getTime());
        const playerSessions = sessions.filter((s: any) => s.player_id === p.id);
        const firstSession = playerSessions.sort((a: any, b: any) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())[0];
        if (firstSession) times.push(new Date(firstSession.started_at).getTime());
        if (visit) times.push(new Date(visit.checked_in_at).getTime());
        const firstSeenTs = times.length > 0 ? Math.min(...times) : null;
        const firstSeen = firstSeenTs ? new Date(firstSeenTs) : null;

        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          nickname: p.nickname,
          status: p.status,
          player_type: (p as any).player_type as string || "table",
          dropR,
          dropV,
          dropT,
          cashout,
          result,
          tags,
          tableName: table?.name || null,
          isLive: !!activeSession,
          isCheckedIn: !!isCheckedIn,
          hasVisit: !!visit,
          firstSeen,
        };
      });

    // Filter by type
    const typeFiltered = typeFilter.size === 3
      ? list
      : list.filter(p => typeFilter.has(p.player_type));

    // Filter by search
    const filtered = search
      ? typeFiltered.filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(search.toLowerCase()))
      : typeFiltered;

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`); break;
        case "dropR": cmp = a.dropR - b.dropR; break;
        case "dropT": cmp = a.dropT - b.dropT; break;
        case "cashout": cmp = a.cashout - b.cashout; break;
        case "result": cmp = a.result - b.result; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return filtered;
  }, [players, transactions, allTags, sessions, tables, visits, sortKey, sortDir, search, typeFilter]);

  // Players not yet active — for check-in search
  const activeIds = new Set(activePlayers.map(p => p.id));
  const inactivePlayers = useMemo(() => {
    if (!search) return [];
    return players
      .filter(p => p.status === "active" && !activeIds.has(p.id))
      .filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5);
  }, [players, activeIds, search]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "desc"
      ? <ArrowDown className="w-3 h-3 ml-1 text-primary" />
      : <ArrowUp className="w-3 h-3 ml-1 text-primary" />;
  };

  const totalDropR = activePlayers.reduce((s, p) => s + p.dropR, 0);
  const totalDropT = activePlayers.reduce((s, p) => s + p.dropT, 0);
  const totalCashout = activePlayers.reduce((s, p) => s + p.cashout, 0);
  const totalResult = totalDropR - totalCashout;

  return (
    <div className="space-y-4">
      <div className="cms-panel">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-card-foreground shrink-0">
            Active Players ({activePlayers.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {([["table", "TBL"], ["mix", "MIX"], ["slots", "SLT"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(prev => {
                    const next = new Set(prev);
                    if (next.has(key)) { if (next.size > 1) next.delete(key); }
                    else next.add(key);
                    return next;
                  })}
                  className={`px-2.5 py-1 text-[10px] font-medium uppercase transition-colors ${
                    typeFilter.has(key)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative max-w-[200px] w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search / Check in..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Player placement panel */}
        {inactivePlayers.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-muted/10 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase">Add active player</p>
            <div className="flex flex-wrap gap-2">
              {inactivePlayers.map(p => (
                <Button
                  key={p.id}
                  variant={placingPlayer === p.id ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setPlacingPlayer(placingPlayer === p.id ? null : p.id);
                    setPlacingTable(null);
                    setPlacingBet("");
                  }}
                >
                  <LogIn className="w-3 h-3" />
                  {p.first_name} {p.last_name}
                </Button>
              ))}
            </div>

            {/* Table/Hall selection for selected player */}
            {placingPlayer && (
              <div className="pt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase">
                  Where is {inactivePlayers.find(p => p.id === placingPlayer)?.first_name}?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={placingTable === "hall" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setPlacingTable("hall"); setPlacingBet(""); }}
                  >
                    <MapPin className="w-3 h-3" /> В зале
                  </Button>
                  {tables.filter(t => t.status === "open").map(t => (
                    <Button
                      key={t.id}
                      variant={placingTable === t.id ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs font-mono"
                      onClick={() => setPlacingTable(t.id)}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>

                {/* Avg bet input for table placement */}
                {placingTable && placingTable !== "hall" && (
                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-xs text-muted-foreground shrink-0">Avg Bet:</label>
                    <NumberInput
                      placeholder="e.g. 5 000"
                      value={placingBet}
                      onChange={setPlacingBet}
                      className="h-8 w-[140px]"
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      disabled={!placingBet || Number(placingBet) <= 0 || placeAtTable.isPending}
                      onClick={() => placeAtTable.mutate({
                        playerId: placingPlayer,
                        tableId: placingTable,
                        avgBet: Number(placingBet),
                      })}
                    >
                      <Play className="w-3 h-3" /> Start
                    </Button>
                  </div>
                )}

                {/* Hall check-in confirm */}
                {placingTable === "hall" && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      disabled={checkIn.isPending}
                      onClick={() => {
                        checkIn.mutate(placingPlayer);
                        setPlacingPlayer(null);
                        setPlacingTable(null);
                        setSearch("");
                      }}
                    >
                      <LogIn className="w-3 h-3" /> Check In
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activePlayers.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No active players today</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("name")}>
                    <span className="flex items-center">Player <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead className="text-center">Tags</TableHead>
                  <TableHead className="text-center">Table</TableHead>
                  <TableHead className="text-center">Arrived</TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("dropR")}>
                    <span className="flex items-center justify-end">Drop R <SortIcon col="dropR" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("dropT")}>
                    <span className="flex items-center justify-end">Drop T <SortIcon col="dropT" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("cashout")}>
                    <span className="flex items-center justify-end">Cash Out <SortIcon col="cashout" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("result")}>
                    <span className="flex items-center justify-end">Result <SortIcon col="result" /></span>
                  </TableHead>
                  <TableHead className="text-center w-[60px]">In/Out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePlayers.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.isCheckedIn && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                        <span className="font-medium text-card-foreground">{p.first_name} {p.last_name}</span>
                        {p.nickname && <span className="text-xs text-muted-foreground">"{p.nickname}"</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        p.player_type === "table" ? "bg-sky-500/20 text-sky-400"
                        : p.player_type === "mix" ? "bg-violet-500/20 text-violet-400"
                        : "bg-amber-500/20 text-amber-400"
                      }`}>{p.player_type === "table" ? "TBL" : p.player_type === "mix" ? "MIX" : "SLT"}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.tags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap justify-center">
                          {p.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                          ))}
                        </div>
                      ) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.isLive && p.tableName ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-2 py-0.5 font-mono">{p.tableName}</Badge>
                      ) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-mono text-muted-foreground">
                      {p.firstSeen
                        ? `${String(p.firstSeen.getHours()).padStart(2, "0")}:${String(p.firstSeen.getMinutes()).padStart(2, "0")}`
                        : <span className="text-muted-foreground/40">·</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-card-foreground">
                      {p.dropR > 0 ? formatNumberSpaces(p.dropR) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-muted-foreground">
                      {p.dropT > 0 ? formatNumberSpaces(p.dropT) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-400">
                      {p.cashout > 0 ? formatNumberSpaces(p.cashout) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${p.result > 0 ? "text-emerald-400" : p.result < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {p.result !== 0 ? <>{p.result > 0 ? "+" : ""}{formatNumberSpaces(p.result)}</> : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.isCheckedIn ? (
                        <button
                          onClick={() => checkOut.mutate(p.id)}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                          title="Check out"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => checkIn.mutate(p.id)}
                          className="text-muted-foreground hover:text-emerald-400 transition-colors"
                          title="Check in"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                {activePlayers.length > 0 && (totalDropR > 0 || totalCashout > 0) && (
                  <TableRow className="border-t-2 border-border bg-muted/20">
                    <TableCell className="font-bold text-xs text-card-foreground" colSpan={5}>TOTAL</TableCell>
                    <TableCell className="text-right font-mono font-bold text-card-foreground">{formatNumberSpaces(totalDropR)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-muted-foreground">{formatNumberSpaces(totalDropT)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-400">{formatNumberSpaces(totalCashout)}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${totalResult > 0 ? "text-emerald-400" : totalResult < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {totalResult > 0 ? "+" : ""}{formatNumberSpaces(totalResult)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivePlayers;
