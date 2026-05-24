import { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
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
  const [search, setSearch] = useState("");

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return (rows as any[]).filter(r =>
      `${r.firstName} ${r.lastName} ${r.nickname} ${r.card}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

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
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-card-foreground">Daily Average Bet — by Player</h3>
          <p className="text-sm text-muted-foreground">
            Manual entry by Pit / Manager / Floor Manager. Each player has AR / BG / Poker average bet for the business day. Finalized to a single value per group at day close.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
            {filteredRows.length} / {rows.length}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No players visited the casino today yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-zinc-900">
              <tr className="text-sm uppercase tracking-wider text-white">
                {[
                  { l: "Card", cls: "text-center w-16" },
                  { l: "L",    cls: "text-left w-10" },
                  { l: "Name", cls: "text-left max-w-[200px]" },
                  { l: "Vis",  cls: "text-center w-14" },
                  { l: "Entry",cls: "text-center w-16" },
                  { l: "Left", cls: "text-center w-16" },
                  { l: "AR",    cls: "text-right min-w-[160px]" },
                  { l: "BG",    cls: "text-right min-w-[160px]" },
                  { l: "Poker", cls: "text-right min-w-[160px]" },
                ].map(h => (
                  <th
                    key={h.l}
                    style={{ top: "var(--ppheader-h, 0px)" }}
                    className={`px-2 py-3 font-bold sticky bg-zinc-900 text-white z-20 whitespace-nowrap ${h.cls}`}
                  >
                    {h.l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r: any) => {
                const isSelected = r.playerId === selectedPlayerId;
                return (
                  <tr
                    key={r.visitId}
                    onClick={() => selectPlayer(r.playerId)}
                    className={`border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10" : ""
                    } ${r.isPresent ? "" : "opacity-60"}`}
                  >
                    <td className="px-2 py-2 font-mono text-sm text-center font-bold">
                      {formatCardNumber(r.card) || "·"}
                    </td>
                    <td className="px-2 py-2">
                      <CategoryBadge category={r.category} />
                    </td>
                    <td className="px-2 py-2 max-w-[200px] font-medium text-card-foreground truncate">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-2 py-2 font-mono text-sm text-center">
                      {visitNumByPlayer.get(r.playerId) || 1}
                    </td>
                    <td className="px-1 py-2 font-mono text-sm text-center">{fmtClock(r.entryAt)}</td>
                    <td className="px-1 py-2 font-mono text-sm text-center">{r.exitAt ? fmtClock(r.exitAt) : "·"}</td>
                    {(["ar", "bg", "poker"] as AvgBetGroup[]).map(g => (
                      <td key={g} className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
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
  // Default-zero policy: untouched cells display "0" and behave editable.
  const displayValue = value ?? 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(displayValue));

  useEffect(() => { setDraft(String(value ?? 0)); }, [value]);

  if (!canEdit) {
    return <span className="font-mono text-base">{formatNumberSpaces(displayValue)}</span>;
  }
  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        inputMode="numeric"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.currentTarget.select()}
        onBlur={() => {
          setEditing(false);
          const trimmed = draft.trim();
          const n = trimmed === "" ? 0 : Number(trimmed);
          if (!Number.isFinite(n)) return;
          if (n !== (value ?? 0)) onCommit(n === 0 ? null : n);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(String(value ?? 0)); setEditing(false); }
        }}
        className="no-spin h-9 w-[150px] ml-auto text-right font-mono text-base"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`font-mono text-base hover:text-primary ${value == null ? "text-muted-foreground/60" : "text-card-foreground"}`}
      title="Click to edit"
    >
      {formatNumberSpaces(displayValue)}
    </button>
  );
}
