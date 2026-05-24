import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberSpaces } from "@/lib/currency";
import { formatCardNumber } from "@/lib/card-number";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import {
  usePlayerDailyAvgBets,
  useSetPlayerDailyAvgBet,
  type AvgBetGroup,
} from "@/hooks/use-player-daily-avg-bets";
import { useSelectedPlayer } from "@/hooks/use-selected-player";

interface PlayerLite {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  category?: string | null;
  player_cards?: Array<{ card_number: string; is_active?: boolean }>;
}

interface VisitLite {
  id: string;
  player_id: string;
  date: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

interface Props {
  businessDate: string;
  players: PlayerLite[];
  visits: VisitLite[];
  canEdit: boolean;
}

function fmtClock(iso: string | null | undefined) {
  if (!iso) return "·";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PlayerDailyAvgBetTable({ businessDate, players, visits, canEdit }: Props) {
  const { data: bets = [] } = usePlayerDailyAvgBets(businessDate);
  const setBet = useSetPlayerDailyAvgBet();
  const { select: selectPlayer, playerId: selectedPlayerId } = useSelectedPlayer();

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const betsByPlayer = useMemo(() => {
    const m = new Map<string, typeof bets[number]>();
    bets.forEach(b => m.set(b.player_id, b));
    return m;
  }, [bets]);

  const rows = useMemo(() => {
    // One row per visit on the business date; sort: present first, then by entry desc.
    return visits
      .filter(v => v.date === businessDate)
      .map(v => {
        const p = playerMap.get(v.player_id);
        if (!p) return null;
        const b = betsByPlayer.get(v.player_id);
        const cards = p.player_cards || [];
        const card = cards.find(c => c.is_active)?.card_number || cards[0]?.card_number || "";
        return {
          visitId: v.id,
          playerId: v.player_id,
          card,
          category: ((p.category as PlayerCategory) || "normal") as PlayerCategory,
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          nickname: p.nickname || "",
          entryAt: v.checked_in_at,
          exitAt: v.checked_out_at,
          isPresent: !v.checked_out_at,
          ar: b?.avg_bet_ar ?? null,
          bg: b?.avg_bet_bg ?? null,
          poker: b?.avg_bet_poker ?? null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (a.isPresent !== b.isPresent) return a.isPresent ? -1 : 1;
        return new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime();
      });
  }, [visits, businessDate, playerMap, betsByPlayer]);

  // Compute visit-number per player (1, 2, ...) for the day
  const visitNumByPlayer = useMemo(() => {
    const order = [...visits]
      .filter(v => v.date === businessDate)
      .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime());
    const count = new Map<string, number>();
    order.forEach(v => count.set(v.player_id, (count.get(v.player_id) || 0) + 1));
    return count;
  }, [visits, businessDate]);

  const handleSave = (playerId: string, group: AvgBetGroup, value: number | null) => {
    setBet.mutate({ playerId, businessDate, group, value });
  };

  return (
    <div className="cms-panel p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Daily Average Bet — by Player</h3>
          <p className="text-[11px] text-muted-foreground">
            Manual entry by Pit / Manager / Floor Manager. Each player can have AR / BG / Poker average bet for the business day. Finalized to a single value per group at day close.
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{rows.length} players</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No players visited the casino today yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                <th className="text-center px-2 py-2 w-14">Card</th>
                <th className="text-left px-2 py-2 w-8">L</th>
                <th className="text-left px-2 py-2">Name</th>
                <th className="text-center px-2 py-2 w-12">Vis</th>
                <th className="text-center px-2 py-2 w-14">Entry</th>
                <th className="text-center px-2 py-2 w-14">Left</th>
                <th className="text-right px-2 py-2 w-[110px]">AR</th>
                <th className="text-right px-2 py-2 w-[110px]">BG</th>
                <th className="text-right px-2 py-2 w-[110px]">Poker</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const isSelected = r.playerId === selectedPlayerId;
                return (
                  <tr
                    key={r.visitId}
                    onClick={() => selectPlayer(r.playerId)}
                    className={`border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10" : ""
                    } ${r.isPresent ? "" : "opacity-60"}`}
                  >
                    <td className="px-2 py-1.5 font-mono text-[11px] text-center font-bold">
                      {formatCardNumber(r.card) || "·"}
                    </td>
                    <td className="px-2 py-1.5">
                      <CategoryBadge category={r.category} />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-card-foreground truncate">
                      {r.firstName} {r.lastName}
                      {r.nickname && <span className="text-muted-foreground ml-1">"{r.nickname}"</span>}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-center">
                      {visitNumByPlayer.get(r.playerId) || 1}
                    </td>
                    <td className="px-1 py-1.5 font-mono text-xs text-center">{fmtClock(r.entryAt)}</td>
                    <td className="px-1 py-1.5 font-mono text-xs text-center">{r.exitAt ? fmtClock(r.exitAt) : "·"}</td>
                    {(["ar", "bg", "poker"] as AvgBetGroup[]).map(g => (
                      <td key={g} className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <BetCell
                          value={(r as any)[g]}
                          canEdit={canEdit}
                          onCommit={(v) => handleSave(r.playerId, g, v)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BetCell({ value, canEdit, onCommit }: { value: number | null; canEdit: boolean; onCommit: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => { setDraft(value == null ? "" : String(value)); }, [value]);

  if (!canEdit) {
    return value == null
      ? <span className="font-mono text-xs text-muted-foreground/40">·</span>
      : <span className="font-mono text-sm">{formatNumberSpaces(value)}</span>;
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
          const trimmed = draft.trim();
          const n = trimmed === "" ? null : Number(trimmed);
          if (trimmed !== "" && !Number.isFinite(n)) return;
          if (n !== value) onCommit(n);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setEditing(false); }
        }}
        className="h-7 w-[100px] ml-auto text-right font-mono text-sm"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`font-mono text-sm hover:text-primary ${value == null ? "text-muted-foreground/40" : "text-card-foreground"}`}
      title="Click to edit"
    >
      {value == null ? "·" : formatNumberSpaces(value)}
    </button>
  );
}
