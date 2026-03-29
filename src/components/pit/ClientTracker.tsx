import { useState, useMemo, useEffect } from "react";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Clock } from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";

// Hands per hour by game type
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
      const { error } = await supabase.from("client_sessions").insert({
        casino_id: casinoId!,
        player_id: selectedPlayer,
        table_id: selectedTable,
        avg_bet: Number(avgBet) || 0,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_sessions"] });
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

      // Find table to get game type
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
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Player</label>
            <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
              <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
              <SelectContent>
                {activePlayers.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} {p.nickname ? `"${p.nickname}"` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {activeSessions.map((s: any) => {
              const table = tables.find(t => t.id === s.table_id);
              const hph = table ? getHandsPerHour(table.game) : DEFAULT_HANDS_PER_HOUR;
              const elapsed = (Date.now() - new Date(s.started_at).getTime()) / 3600000;
              const liveHands = Math.round(elapsed * hph);
              const liveTotalBet = liveHands * Number(s.avg_bet);

              return (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-card-foreground">{getPlayerName(s.player_id)}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getTableName(s.table_id)}</span>
                      <span>·</span>
                      <span>Avg: {formatNumberSpaces(Number(s.avg_bet))}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <LiveTimer startedAt={s.started_at} />
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        ~{liveHands} hands
                      </Badge>
                      <span className="text-xs font-mono font-bold text-primary">
                        Total Bet: {formatNumberSpaces(liveTotalBet)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => stopSession.mutate(s.id)}
                    disabled={stopSession.isPending}
                  >
                    <Square className="w-3 h-3 mr-1" /> Stop
                  </Button>
                </div>
              );
            })}
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
