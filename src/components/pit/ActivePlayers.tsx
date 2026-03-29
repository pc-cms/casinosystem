import { useState, useMemo } from "react";
import { usePlayers, useTransactions, useGamingTables } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ArrowUpDown, ArrowUp, ArrowDown, LogIn, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type SortKey = "name" | "drop" | "cashout" | "result";
type SortDir = "asc" | "desc";

const ActivePlayers = () => {
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const today = new Date().toISOString().split("T")[0];
  const { data: transactions = [] } = useTransactions(today);
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();

  const [sortKey, setSortKey] = useState<SortKey>("drop");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "table" | "mix">("all");

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
      const { error } = await supabase.from("casino_visits").insert({
        casino_id: casinoId!,
        player_id: playerId,
        date: today,
        checked_in_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      toast.success("Player checked in");
    },
    onError: (e: any) => {
      if (e.message?.includes("duplicate")) toast.info("Already checked in today");
      else toast.error(e.message);
    },
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
        const drop = playerTx.filter((t: any) => t.type === "buy").reduce((s: number, t: any) => s + Number(t.amount), 0);
        const cashout = playerTx.filter((t: any) => t.type === "cashout").reduce((s: number, t: any) => s + Number(t.amount), 0);
        const result = drop - cashout;
        const tags = allTags.filter(t => t.player_id === p.id).map(t => t.tag);
        const activeSession = activeSessions.find((s: any) => s.player_id === p.id);
        const table = activeSession?.table_id ? tables.find(t => t.id === activeSession.table_id) : null;
        const visit = visits.find((v: any) => v.player_id === p.id);
        const isCheckedIn = visit && !visit.checked_out_at;

        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          nickname: p.nickname,
          status: p.status,
          player_type: (p as any).player_type as string || "table",
          drop,
          cashout,
          result,
          tags,
          tableName: table?.name || null,
          isLive: !!activeSession,
          isCheckedIn: !!isCheckedIn,
          hasVisit: !!visit,
        };
      });

    // Filter by type
    const typeFiltered = typeFilter === "all"
      ? list
      : list.filter(p => p.player_type === typeFilter || p.player_type === "mix");

    // Filter by search
    const filtered = search
      ? typeFiltered.filter(p => `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(search.toLowerCase()))
      : typeFiltered;

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`); break;
        case "drop": cmp = a.drop - b.drop; break;
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

  const totalDrop = activePlayers.reduce((s, p) => s + p.drop, 0);
  const totalCashout = activePlayers.reduce((s, p) => s + p.cashout, 0);
  const totalResult = totalDrop - totalCashout;

  return (
    <div className="space-y-4">
      <div className="cms-panel">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-card-foreground shrink-0">
            Active Players ({activePlayers.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {(["all", "table", "mix"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`px-2.5 py-1 text-[10px] font-medium uppercase transition-colors ${
                    typeFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {f === "all" ? "All" : f === "table" ? "Table" : "Mix"}
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

        {/* Check-in suggestions for inactive players */}
        {inactivePlayers.length > 0 && (
          <div className="px-4 py-2 border-b border-border bg-muted/10">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Check in player</p>
            <div className="flex flex-wrap gap-2">
              {inactivePlayers.map(p => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => checkIn.mutate(p.id)}
                  disabled={checkIn.isPending}
                >
                  <LogIn className="w-3 h-3" />
                  {p.first_name} {p.last_name}
                </Button>
              ))}
            </div>
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
                  <TableHead className="text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("drop")}>
                    <span className="flex items-center justify-end">Drop <SortIcon col="drop" /></span>
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
                    <TableCell className="text-right font-mono font-bold text-card-foreground">
                      {p.drop > 0 ? formatNumberSpaces(p.drop) : <span className="text-muted-foreground/40">·</span>}
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
                {activePlayers.length > 0 && (totalDrop > 0 || totalCashout > 0) && (
                  <TableRow className="border-t-2 border-border bg-muted/20">
                    <TableCell className="font-bold text-xs text-card-foreground" colSpan={4}>TOTAL</TableCell>
                    <TableCell className="text-right font-mono font-bold text-card-foreground">{formatNumberSpaces(totalDrop)}</TableCell>
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
