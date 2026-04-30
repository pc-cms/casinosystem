import { useState, useMemo } from "react";
import { Eye, Play, Pencil } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { offlineMutation } from "@/lib/offline-mutation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { formatNumberSpaces } from "@/lib/currency";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const PlayerTrackerPage = () => {
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();
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

  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);

  // Players with assigned table:
  // either an active session with table_id, or a visit with position that matches a table name.
  const tableByName = useMemo(() => {
    const map = new Map<string, any>();
    tables.forEach(t => map.set(t.name.toLowerCase(), t));
    return map;
  }, [tables]);

  const assignedPlayers = useMemo(() => {
    const activeSessions = sessions.filter((s: any) => !s.stopped_at);
    const sessionByPlayer = new Map<string, any>();
    activeSessions.forEach((s: any) => sessionByPlayer.set(s.player_id, s));

    const result: Array<{
      player: any;
      tableId: string;
      tableName: string;
      activeSession: any | null;
    }> = [];

    // From active sessions
    activeSessions.forEach((s: any) => {
      if (!s.table_id) return;
      const player = players.find(p => p.id === s.player_id);
      const table = tables.find(t => t.id === s.table_id);
      if (!player || !table) return;
      result.push({ player, tableId: table.id, tableName: table.name, activeSession: s });
    });

    // From visits where position matches a table name and not already counted
    const seen = new Set(result.map(r => r.player.id));
    visits.forEach((v: any) => {
      if (v.checked_out_at) return;
      if (seen.has(v.player_id)) return;
      const pos = String(v.position || "").toLowerCase();
      if (!pos || pos === "hall") return;
      const table = tableByName.get(pos);
      if (!table) return;
      const player = players.find(p => p.id === v.player_id);
      if (!player) return;
      result.push({ player, tableId: table.id, tableName: table.name, activeSession: null });
      seen.add(player.id);
    });

    result.sort((a, b) =>
      `${a.player.first_name} ${a.player.last_name}`.localeCompare(
        `${b.player.first_name} ${b.player.last_name}`
      )
    );
    return result;
  }, [sessions, visits, players, tables, tableByName]);

  // Modal state
  const [editing, setEditing] = useState<null | {
    playerId: string;
    playerName: string;
    tableId: string;
    avgBet: string;
    sessionId: string | null;
  }>(null);

  const openLaunch = (row: typeof assignedPlayers[number]) => {
    setEditing({
      playerId: row.player.id,
      playerName: `${row.player.first_name} ${row.player.last_name}`,
      tableId: row.tableId,
      avgBet: row.activeSession ? String(row.activeSession.avg_bet || "") : "",
      sessionId: row.activeSession?.id || null,
    });
  };

  const launch = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const bet = Number(editing.avgBet);
      if (!bet || bet <= 0) throw new Error("Avg Bet must be > 0");

      // If existing session: stop it and start a new one (table or bet may have changed)
      if (editing.sessionId) {
        const stopRes = await offlineMutation({
          table: "client_sessions",
          operation: "update",
          payload: {
            _match: { id: editing.sessionId },
            stopped_at: new Date().toISOString(),
          },
        });
        if (stopRes.error && navigator.onLine) throw new Error(stopRes.error);
      }

      const sessionId = crypto.randomUUID();
      const insRes = await offlineMutation({
        table: "client_sessions",
        operation: "insert",
        payload: {
          id: sessionId,
          casino_id: casinoId!,
          player_id: editing.playerId,
          table_id: editing.tableId,
          avg_bet: bet,
          created_by: user!.id,
        },
      });
      if (insRes.error) throw new Error(insRes.error);

      // Ensure visit exists for today
      const vRes = await offlineMutation({
        table: "casino_visits",
        operation: "upsert",
        payload: {
          casino_id: casinoId!,
          player_id: editing.playerId,
          date: today,
          checked_in_by: user!.id,
        },
        upsertConflict: "casino_id,player_id,date",
      });
      if (vRes.error) throw new Error(vRes.error);
      return { offline: insRes.offline || vRes.offline };
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["client_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      setEditing(null);
      toast.success(res?.offline ? "Saved offline — will sync" : "Session started");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        icon={Eye}
        title="Player Tracker"
        subtitle="Active players assigned to a table"
        date={true}
      />

      <div className="cms-panel">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">
            Players at tables ({assignedPlayers.length})
          </h3>
        </div>
        {assignedPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No players currently assigned to a table.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {assignedPlayers.map(row => {
              const s = row.activeSession;
              return (
                <div key={row.player.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-card-foreground truncate">
                      {row.player.first_name} {row.player.last_name}
                      {row.player.nickname && (
                        <span className="text-muted-foreground ml-1">"{row.player.nickname}"</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{row.tableName}</Badge>
                      {s ? (
                        <>
                          <span>·</span>
                          <span>Avg: <span className="font-mono text-card-foreground">{formatNumberSpaces(Number(s.avg_bet))}</span></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          <span className="text-success">Live</span>
                        </>
                      ) : (
                        <span>· Not started</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={s ? "outline" : "default"}
                    onClick={() => openLaunch(row)}
                    className="gap-1.5 shrink-0"
                  >
                    {s ? <Pencil className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {s ? "Edit" : "Start"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ResponsiveDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editing?.sessionId ? "Edit session" : "Start session"} — {editing?.playerName}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="space-y-4 px-1">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Table</label>
              <Select
                value={editing?.tableId || ""}
                onValueChange={(v) => setEditing(e => e ? { ...e, tableId: v } : e)}
              >
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

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Avg Bet</label>
              <NumberInput
                placeholder="e.g. 5 000"
                value={editing?.avgBet || ""}
                onChange={(v) => setEditing(e => e ? { ...e, avgBet: v } : e)}
              />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => launch.mutate()}
              disabled={launch.isPending || !editing?.tableId || !editing?.avgBet || Number(editing?.avgBet) <= 0}
              className="gap-1.5"
            >
              <Play className="w-4 h-4" />
              {editing?.sessionId ? "Restart" : "Start"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </PageShell>
  );
};

export default PlayerTrackerPage;
