import { useState, useMemo, useEffect, useRef } from "react";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Clock, Search, Check, Pencil } from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";

const HANDS_PER_HOUR: Record<string, number> = {
  "Blackjack": 35,
  "BJ": 35,
};
const DEFAULT_HANDS_PER_HOUR = 20;

const getHandsPerHour = (game: string) => {
  for (const [key, val] of Object.entries(HANDS_PER_HOUR)) {
    if (game.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return DEFAULT_HANDS_PER_HOUR;
};

const LiveTimer = ({ startedAt }: { startedAt: string }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const diff = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return (
    <span className="font-mono text-sm text-primary font-bold">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
};

// Searchable player picker
const PlayerSearchInput = ({
  players,
  value,
  onChange,
}: {
  players: { id: string; first_name: string; last_name: string; nickname: string }[];
  value: string;
  onChange: (id: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = players.find(p => p.id === value);

  const filtered = useMemo(() => {
    if (!query) return players.slice(0, 10);
    const q = query.toLowerCase();
    return players.filter(p =>
      `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [players, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={selected ? `${selected.first_name} ${selected.last_name}` : "Search player..."}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value && value) onChange(""); }}
          onFocus={() => setOpen(true)}
          className={`h-9 pl-8 text-xs ${selected ? "border-primary/50" : ""}`}
        />
        {selected && !query && (
          <span className="absolute left-8 top-1/2 -translate-y-1/2 text-xs text-card-foreground pointer-events-none">
            {selected.first_name} {selected.last_name}
            {selected.nickname ? ` "${selected.nickname}"` : ""}
          </span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-10 left-0 right-0 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setQuery(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${
                p.id === value ? "bg-primary/10 text-primary" : "text-card-foreground"
              }`}
            >
              {p.first_name} {p.last_name}
              {p.nickname ? <span className="text-muted-foreground ml-1">"{p.nickname}"</span> : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ClientTracker = () => {
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [avgBet, setAvgBet] = useState("");

  const today = new Date().toISOString().split("T")[0];

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
    refetchInterval: 10000,
  });

  const activeSessions = useMemo(() => sessions.filter((s: any) => !s.stopped_at), [sessions]);
  const completedSessions = useMemo(() => sessions.filter((s: any) => s.stopped_at), [sessions]);

  const startSession = useMutation({
    mutationFn: async () => {
      // Start the client session
      const { error } = await supabase.from("client_sessions").insert({
        casino_id: casinoId!,
        player_id: selectedPlayer,
        table_id: selectedTable,
        avg_bet: Number(avgBet) || 0,
        created_by: user!.id,
      });
      if (error) throw error;

      // Auto check-in if not already checked in today
      await supabase.from("casino_visits").upsert(
        {
          casino_id: casinoId!,
          player_id: selectedPlayer,
          date: today,
          checked_in_by: user!.id,
        },
        { onConflict: "casino_id,player_id,date" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      setSelectedPlayer("");
      setSelectedTable("");
      setAvgBet("");
      toast.success("Session started");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stopSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const session = sessions.find((s: any) => s.id === sessionId);
      if (!session) return;

      const stoppedAt = new Date();
      const startedAt = new Date(session.started_at);
      const durationMs = stoppedAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const table = tables.find(t => t.id === session.table_id);
      const hph = table ? getHandsPerHour(table.game) : DEFAULT_HANDS_PER_HOUR;
      const handsPlayed = Math.round((durationMinutes / 60) * hph);
      const totalBet = handsPlayed * Number(session.avg_bet);

      const { error } = await supabase
        .from("client_sessions")
        .update({
          stopped_at: stoppedAt.toISOString(),
          duration_minutes: durationMinutes,
          hands_played: handsPlayed,
          total_bet: totalBet,
        })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_sessions"] });
      toast.success("Session stopped");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activePlayers = players.filter(p => p.status === "active");
  const openTables = tables.filter(t => t.status === "open");

  const getPlayerName = (id: string) => {
    const p = players.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };
  const getTableName = (id: string) => {
    const t = tables.find(t => t.id === id);
    return t ? `${t.name} (${t.game})` : "—";
  };
  const getTableGame = (id: string) => {
    const t = tables.find(t => t.id === id);
    return t?.game || "";
  };

  const canStart = selectedPlayer && selectedTable && avgBet && Number(avgBet) > 0;

  return (
    <div className="space-y-6">
      {/* New session form */}
      <div className="cms-panel p-4">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Start New Session</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[220px]">
            <label className="text-xs text-muted-foreground mb-1 block">Player</label>
            <PlayerSearchInput
              players={activePlayers}
              value={selectedPlayer}
              onChange={setSelectedPlayer}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Table</label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
              <SelectContent>
                {openTables.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.game})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">Avg Bet</label>
            <NumberInput
              placeholder="e.g. 5 000"
              value={avgBet}
              onChange={setAvgBet}
            />
          </div>
          <Button onClick={() => startSession.mutate()} disabled={!canStart || startSession.isPending}>
            <Play className="w-4 h-4 mr-1" /> Start
          </Button>
        </div>
        {selectedTable && (
          <p className="text-xs text-muted-foreground mt-2">
            Hands/hour: <span className="font-bold text-card-foreground">{getHandsPerHour(getTableGame(selectedTable))}</span>
            {" "}({getTableGame(selectedTable)})
          </p>
        )}
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div className="cms-panel">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active Sessions ({activeSessions.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {activeSessions.map((s: any) => (
              <ActiveSessionCard
                key={s.id}
                session={s}
                tables={tables}
                getPlayerName={getPlayerName}
                getTableName={getTableName}
                onStop={() => stopSession.mutate(s.id)}
                stopPending={stopSession.isPending}
                casinoId={casinoId!}
                queryClient={queryClient}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed sessions */}
      {completedSessions.length > 0 && (
        <div className="cms-panel">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-sm font-semibold text-muted-foreground">Completed Today ({completedSessions.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {completedSessions.map((s: any) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-card-foreground">{getPlayerName(s.player_id)}</div>
                  <div className="text-xs text-muted-foreground">
                    {getTableName(s.table_id)} · {s.duration_minutes} min · {s.hands_played} hands
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase">Total Bet</div>
                  <div className="text-sm font-mono font-bold text-card-foreground">{formatNumberSpaces(Number(s.total_bet))}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientTracker;
