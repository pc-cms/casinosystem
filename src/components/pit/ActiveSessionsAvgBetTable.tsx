import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberSpaces } from "@/lib/currency";

interface ActiveSession {
  id: string;
  player_id: string;
  table_id: string;
  avg_bet: number;
  started_at: string;
  stopped_at: string | null;
}

interface PlayerLite {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
}

interface TableLite {
  id: string;
  name: string;
  game: string;
}

type GameGroup = "AR" | "BG" | "Poker";

const POKER_GAMES = new Set(["Poker", "Texas Holdem", "Omaha", "PLO", "Club Poker"]);

function gameGroup(game: string): GameGroup | null {
  if (game === "American Roulette") return "AR";
  if (game === "Blackjack") return "BG";
  if (POKER_GAMES.has(game)) return "Poker";
  return null;
}

function fmtClock(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDuration(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

interface Props {
  sessions: ActiveSession[];
  players: PlayerLite[];
  tables: TableLite[];
  canEdit: boolean;
  onUpdateBet: (playerId: string, avgBet: number) => void;
}

export function ActiveSessionsAvgBetTable({ sessions, players, tables, canEdit, onUpdateBet }: Props) {
  // Live ticker for duration (refresh every 30s)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const tableMap = useMemo(() => {
    const m = new Map<string, TableLite>();
    tables.forEach(t => m.set(t.id, t));
    return m;
  }, [tables]);

  const rows = useMemo(() => {
    const playerMap = new Map(players.map(p => [p.id, p]));
    return sessions
      .filter(s => !s.stopped_at && s.table_id)
      .map(s => {
        const player = playerMap.get(s.player_id);
        const table = tableMap.get(s.table_id);
        const group = table ? gameGroup(table.game) : null;
        return { session: s, player, table, group };
      })
      .filter(r => r.player && r.table)
      .sort((a, b) => new Date(b.session.started_at).getTime() - new Date(a.session.started_at).getTime());
  }, [sessions, players, tableMap]);

  return (
    <div className="cms-panel p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Active Sessions — Average Bet</h3>
          <p className="text-[11px] text-muted-foreground">
            Per-session avg bet. Editable during shift (Pit / Manager). Recorded only — not auto-summed.
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{rows.length} active</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No active player sessions. Seat players on tables to record average bets.
        </p>
      ) : (

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
              <th className="text-left px-2 py-2">Player</th>
              <th className="text-left px-2 py-2 w-[80px]">Table</th>
              <th className="text-right px-2 py-2 w-[100px]">AR</th>
              <th className="text-right px-2 py-2 w-[100px]">BG</th>
              <th className="text-right px-2 py-2 w-[100px]">Poker</th>
              <th className="text-right px-2 py-2 w-[80px]">Start</th>
              <th className="text-right px-2 py-2 w-[80px]">Duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ session, player, table, group }) => {
              const startedAt = new Date(session.started_at);
              const duration = now - startedAt.getTime();
              const display = player!;
              const name = display.nickname || `${display.first_name ?? ""} ${display.last_name ?? ""}`.trim() || "—";
              return (
                <tr key={session.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="px-2 py-1.5 font-medium text-card-foreground">{name}</td>
                  <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{table!.name}</td>
                  {(["AR", "BG", "Poker"] as GameGroup[]).map(col => (
                    <td key={col} className="px-2 py-1.5 text-right">
                      {group === col ? (
                        <AvgBetCell
                          value={session.avg_bet}
                          canEdit={canEdit}
                          onCommit={(v) => onUpdateBet(session.player_id, v)}
                        />
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground/40">·</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-muted-foreground">
                    {fmtClock(startedAt)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-card-foreground">
                    {fmtDuration(duration)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AvgBetCell({ value, canEdit, onCommit }: { value: number; canEdit: boolean; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || 0));

  useEffect(() => { setDraft(String(value || 0)); }, [value]);

  if (!canEdit) {
    return <span className="font-mono text-sm text-card-foreground">{formatNumberSpaces(value)}</span>;
  }
  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = Number(draft);
          if (Number.isFinite(n) && n !== value) onCommit(n);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(String(value || 0)); setEditing(false); }
        }}
        className="h-7 w-[90px] ml-auto text-right font-mono text-sm"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="font-mono text-sm text-card-foreground hover:text-primary"
      title="Click to edit"
    >
      {formatNumberSpaces(value)}
    </button>
  );
}
