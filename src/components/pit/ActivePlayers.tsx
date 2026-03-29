import { useState, useMemo } from "react";
import { usePlayers, useTransactions, useGamingTables } from "@/hooks/use-casino-data";
import { Badge } from "@/components/ui/badge";
import { formatNumberSpaces } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "name" | "drop" | "cashout" | "result";
type SortDir = "asc" | "desc";

const CATEGORY_BADGES: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  blacklist: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ActivePlayers = () => {
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const today = new Date().toISOString().split("T")[0];
  const { data: transactions = [] } = useTransactions(today);
  const { casinoId } = useAuth();

  const [sortKey, setSortKey] = useState<SortKey>("drop");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  // Active client sessions for today
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

  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);

  const activePlayers = useMemo(() => {
    const playerMap = new Map<string, {
      id: string;
      first_name: string;
      last_name: string;
      nickname: string;
      status: string;
      drop: number;
      cashout: number;
      result: number;
      tags: string[];
      tableId: string | null;
      tableName: string | null;
      isLive: boolean;
    }>();

    // Players with transactions today
    const txPlayerIds = new Set(transactions.map((t: any) => t.player_id));
    // Players with active sessions
    const activeSessions = sessions.filter((s: any) => !s.stopped_at);
    const sessionPlayerIds = new Set(activeSessions.map((s: any) => s.player_id));

    const relevantIds = new Set([...txPlayerIds, ...sessionPlayerIds]);

    players
      .filter(p => relevantIds.has(p.id))
      .forEach(p => {
        const playerTx = transactions.filter((t: any) => t.player_id === p.id);
        const drop = playerTx
          .filter((t: any) => t.type === "buy")
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
        const cashout = playerTx
          .filter((t: any) => t.type === "cashout")
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
        const result = drop - cashout;
        const tags = allTags.filter(t => t.player_id === p.id).map(t => t.tag);

        // Find active session → current table
        const activeSession = activeSessions.find((s: any) => s.player_id === p.id);
        const tableId = activeSession?.table_id || null;
        const table = tableId ? tables.find(t => t.id === tableId) : null;
        const tableName = table ? table.name : null;

        playerMap.set(p.id, {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          nickname: p.nickname,
          status: p.status,
          drop,
          cashout,
          result,
          tags,
          tableId,
          tableName,
          isLive: !!activeSession,
        });
      });

    const list = Array.from(playerMap.values());

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
          break;
        case "drop":
          cmp = a.drop - b.drop;
          break;
        case "cashout":
          cmp = a.cashout - b.cashout;
          break;
        case "result":
          cmp = a.result - b.result;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [players, transactions, allTags, sessions, tables, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "desc"
      ? <ArrowDown className="w-3 h-3 ml-1 text-primary" />
      : <ArrowUp className="w-3 h-3 ml-1 text-primary" />;
  };

  return (
    <div className="space-y-4">
      <div className="cms-panel">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">
            Active Players Today ({activePlayers.length})
          </h3>
        </div>

        {activePlayers.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            No player activity today
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    <span className="flex items-center">
                      Player <SortIcon col="name" />
                    </span>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Tags</TableHead>
                  <TableHead className="text-center">Table</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("drop")}
                  >
                    <span className="flex items-center justify-end">
                      Drop <SortIcon col="drop" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("cashout")}
                  >
                    <span className="flex items-center justify-end">
                      Cash Out <SortIcon col="cashout" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("result")}
                  >
                    <span className="flex items-center justify-end">
                      Result <SortIcon col="result" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePlayers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-card-foreground">
                          {p.first_name} {p.last_name}
                        </span>
                        {p.nickname && (
                          <span className="text-xs text-muted-foreground">
                            "{p.nickname}"
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 capitalize ${CATEGORY_BADGES[p.status] || ""}`}
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.tags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap justify-center">
                          {p.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[9px] px-1.5 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.isLive && p.tableName ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-2 py-0.5 font-mono">
                          {p.tableName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-card-foreground">
                      {p.drop > 0 ? formatNumberSpaces(p.drop) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-400">
                      {p.cashout > 0 ? formatNumberSpaces(p.cashout) : <span className="text-muted-foreground/40">·</span>}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${p.result > 0 ? "text-emerald-400" : p.result < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {p.result !== 0 ? (
                        <>
                          {p.result > 0 ? "+" : ""}
                          {formatNumberSpaces(p.result)}
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivePlayers;
