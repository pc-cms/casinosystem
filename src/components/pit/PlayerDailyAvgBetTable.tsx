import { useMemo, useState, useEffect, useRef, useLayoutEffect, forwardRef } from "react";
import { Search, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { formatCardNumber } from "@/lib/card-number";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import {
  usePlayerDailyAvgBets,
  useSetPlayerDailyAvgBet,
  type AvgBetGroup,
} from "@/hooks/use-player-daily-avg-bets";
import { useSelectedPlayer } from "@/hooks/use-selected-player";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";

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

type SortKey = "card" | "name" | "level" | "visits" | "entry" | "exit" | "bet";

const CATEGORY_NAME_TINT: Record<string, string> = {
  diamond: "bg-blue-100/70 dark:bg-blue-500/15",
  platinum: "bg-purple-100/70 dark:bg-purple-500/15",
  gold: "bg-yellow-100/70 dark:bg-yellow-500/15",
  normal: "bg-muted/40",
};

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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "card" || k === "name" ? "asc" : "desc"); }
  };

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

  const { activeCasinoId } = useCasino();
  const visiblePlayerIds = useMemo(
    () => Array.from(new Set(visits.filter(v => v.date === businessDate).map(v => v.player_id))),
    [visits, businessDate],
  );
  const { data: lifetimeVisitsByPlayer = {} } = useQuery({
    queryKey: ["player-lifetime-visits", activeCasinoId, visiblePlayerIds.slice().sort().join(",")],
    queryFn: async () => {
      if (!activeCasinoId || visiblePlayerIds.length === 0) return {} as Record<string, number>;
      const { data } = await supabase
        .from("casino_visits")
        .select("player_id")
        .eq("casino_id", activeCasinoId)
        .in("player_id", visiblePlayerIds);
      const m: Record<string, number> = {};
      for (const r of (data || []) as any[]) m[r.player_id] = (m[r.player_id] || 0) + 1;
      return m;
    },
    enabled: !!activeCasinoId && visiblePlayerIds.length > 0,
    staleTime: 60000,
  });

  const rows = useMemo(() => {
    return visits
      .filter(v => v.date === businessDate)
      .map(v => {
        const p = playerMap.get(v.player_id);
        if (!p) return null;
        const b = betsByPlayer.get(v.player_id);
        const cards = (p.player_cards || [])
          .slice()
          .sort((a: any, c: any) => (a.is_active === c.is_active ? 0 : a.is_active ? -1 : 1));
        const card = cards[0]?.card_number || "";
        return {
          visitId: v.id,
          playerId: v.player_id,
          card,
          category: ((p.category as PlayerCategory) || "normal") as PlayerCategory,
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          visits: lifetimeVisitsByPlayer[v.player_id] ?? 0,
          entryAt: v.checked_in_at,
          exitAt: v.checked_out_at,
          isPresent: !v.checked_out_at,
          ar: b?.avg_bet_ar ?? null,
          bj: b?.avg_bet_bj ?? null,
          poker: b?.avg_bet_poker ?? null,
        };
      })
      .filter(Boolean) as any[];
  }, [visits, businessDate, playerMap, betsByPlayer, lifetimeVisitsByPlayer]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r: any) =>
        `${r.firstName} ${r.lastName} ${r.card}`.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a: any, b: any) => {
      if (sortKey) {
        const dir = sortDir === "asc" ? 1 : -1;
        const get = (r: any) => {
          switch (sortKey) {
            case "card": return r.card || "\uffff";
            case "name": return `${r.firstName} ${r.lastName}`.toLowerCase();
            case "level": {
              const order: Record<string, number> = { diamond: 0, platinum: 1, gold: 2, normal: 3 };
              return order[r.category] ?? 9;
            }
            case "visits": return r.visits || 0;
            case "entry": return new Date(r.entryAt).getTime();
            case "exit": return r.exitAt ? new Date(r.exitAt).getTime() : 0;
            case "bet": return (r.ar || 0) + (r.bj || 0) + (r.poker || 0);
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
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    const t = { count: 0, ar: 0, arN: 0, bj: 0, bjN: 0, poker: 0, pokerN: 0 };
    for (const r of filteredRows as any[]) {
      t.count += 1;
      if (r.ar) { t.ar += r.ar; t.arN += 1; }
      if (r.bj) { t.bj += r.bj; t.bjN += 1; }
      if (r.poker) { t.poker += r.poker; t.pokerN += 1; }
    }
    return t;
  }, [filteredRows]);

  const handleSaveAll = (playerId: string, values: Record<AvgBetGroup, number | null>, prev: Record<AvgBetGroup, number | null>) => {
    (Object.keys(values) as AvgBetGroup[]).forEach(g => {
      if (values[g] !== prev[g]) {
        setBet.mutate({ playerId, businessDate, group: g, value: values[g] });
      }
    });
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />
      : sortDir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1" />
      : <ArrowDown className="w-3 h-3 inline ml-1" />;

  return (
    <div className="cms-panel rounded-lg mb-6">
      <div className="flex items-center justify-between gap-4 p-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-card-foreground">Daily Average Bet — by Player</h3>
          <p className="text-xs text-muted-foreground">
            Tap the Bet cell to enter AR / BJ / Poker average bets for this business day.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No players visited the casino today yet.
        </p>
      ) : (
        <div style={{ overflowX: "clip", overflowY: "visible" }}>
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 border-b border-border">
              <tr className="text-sm uppercase tracking-wider text-white">
                <th
                  style={{ top: "var(--ppheader-h, 0px)" }}
                  onClick={() => toggleSort("card")}
                  className="px-2 py-3 text-center sticky left-0 bg-zinc-900 text-white z-30 w-16 font-bold cursor-pointer select-none hover:text-primary whitespace-nowrap"
                >
                  Card<SortIcon k="card" />
                </th>
                <th
                  style={{ top: "var(--ppheader-h, 0px)" }}
                  className="px-2 py-3 sticky left-16 bg-zinc-900 text-white z-30 font-bold whitespace-nowrap text-left"
                >
                  <span
                    onClick={() => toggleSort("level")}
                    title="Sort by level: D → P → G → N"
                    className="mr-2 cursor-pointer select-none hover:text-primary"
                  >
                    L<SortIcon k="level" />
                  </span>
                  <span
                    onClick={() => toggleSort("name")}
                    className="cursor-pointer select-none hover:text-primary"
                  >
                    Name<SortIcon k="name" />
                  </span>
                </th>
                <th
                  style={{ top: "var(--ppheader-h, 0px)" }}
                  onClick={() => toggleSort("visits")}
                  className="px-2 py-3 text-left sticky bg-zinc-900 text-white z-20 font-bold cursor-pointer select-none hover:text-primary whitespace-nowrap"
                >
                  Vis<SortIcon k="visits" />
                </th>
                <th
                  style={{ top: "var(--ppheader-h, 0px)" }}
                  onClick={() => toggleSort("entry")}
                  className="px-2 py-3 text-left sticky bg-zinc-900 text-white z-20 font-bold cursor-pointer select-none hover:text-primary whitespace-nowrap"
                >
                  Entry<SortIcon k="entry" />
                </th>
                <th
                  style={{ top: "var(--ppheader-h, 0px)" }}
                  onClick={() => toggleSort("exit")}
                  className="px-2 py-3 text-left sticky bg-zinc-900 text-white z-20 font-bold cursor-pointer select-none hover:text-primary whitespace-nowrap"
                >
                  Left<SortIcon k="exit" />
                </th>
                <th
                  style={{ top: "var(--ppheader-h, 0px)" }}
                  onClick={() => toggleSort("bet")}
                  className="px-2 py-3 text-right sticky bg-zinc-900 text-white z-20 font-bold cursor-pointer select-none hover:text-primary whitespace-nowrap min-w-[180px]"
                >
                  Bet (AR · BJ · Poker)<SortIcon k="bet" />
                </th>
              </tr>
              {filteredRows.length > 0 && (() => {
                const stickyStyle = { top: "calc(var(--ppheader-h, 0px) + 38px)", boxShadow: "inset 0 -2px 0 0 hsl(45 90% 55% / 0.9)" } as const;
                const stickyCls = "sticky bg-[#F5D061] dark:bg-[#6B5A1A] z-20";
                const avgAR = totals.arN ? Math.round(totals.ar / totals.arN) : 0;
                const avgBJ = totals.bjN ? Math.round(totals.bj / totals.bjN) : 0;
                const avgPoker = totals.pokerN ? Math.round(totals.poker / totals.pokerN) : 0;
                return (
                  <tr className="text-sm bg-[#F5D061] dark:bg-[#6B5A1A] border-b-2 border-primary/40 font-mono text-amber-950 dark:text-amber-50">
                    <td style={stickyStyle} className={`px-2 py-2 text-center left-0 ${stickyCls} z-30 font-bold w-16`}>{totals.count}</td>
                    <td style={stickyStyle} className={`px-2 py-2 text-left uppercase tracking-wider font-bold left-16 ${stickyCls} z-30`}>Total</td>
                    <td style={stickyStyle} className={`px-1 py-2 ${stickyCls}`}></td>
                    <td style={stickyStyle} className={`px-1 py-2 ${stickyCls}`}></td>
                    <td style={stickyStyle} className={`px-1 py-2 ${stickyCls}`}></td>
                    <td style={stickyStyle} className={`px-2 py-2 text-right font-bold whitespace-nowrap ${stickyCls}`}>
                      <div className="flex justify-end gap-2 text-[11px] leading-tight">
                        <span><span className="opacity-70 mr-1">AR</span>{avgAR ? formatNumberSpaces(avgAR) : "·"}</span>
                        <span><span className="opacity-70 mr-1">BJ</span>{avgBJ ? formatNumberSpaces(avgBJ) : "·"}</span>
                        <span><span className="opacity-70 mr-1">P</span>{avgPoker ? formatNumberSpaces(avgPoker) : "·"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })()}
            </thead>
            <tbody>
              {filteredRows.map((r: any) => {
                const isSelected = r.playerId === selectedPlayerId;
                return (
                  <tr
                    key={r.visitId}
                    onClick={() => selectPlayer(r.playerId)}
                    className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${isSelected ? "bg-primary/10" : ""} ${r.isPresent ? "" : "opacity-70"}`}
                  >
                    <td className={`px-2 py-1.5 font-mono text-[11px] text-center text-foreground font-bold sticky left-0 z-10 w-16 whitespace-nowrap ${isSelected ? "bg-primary/10" : "bg-card"}`}>
                      {formatCardNumber(r.card) || "·"}
                    </td>
                    <td className={`px-2 py-1.5 max-w-[200px] sticky left-16 z-10 ${isSelected ? "bg-primary/10" : (CATEGORY_NAME_TINT[r.category] || "bg-card")}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CategoryBadge category={r.category} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-card-foreground truncate">
                            {r.firstName} {r.lastName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-center w-12">{r.visits || "·"}</td>
                    <td className="px-1 py-1.5 font-mono text-xs w-[44px] text-center">{fmtClock(r.entryAt)}</td>
                    <td className="px-1 py-1.5 font-mono text-xs w-[44px] text-center">{r.exitAt ? fmtClock(r.exitAt) : "·"}</td>
                    <td className="px-2 py-1.5 text-right min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                      <BetCell
                        ar={r.ar}
                        bj={r.bj}
                        poker={r.poker}
                        playerLabel={`${r.firstName} ${r.lastName}`.trim()}
                        cardLabel={formatCardNumber(r.card)}
                        canEdit={canEdit}
                        onCommit={(values) =>
                          handleSaveAll(r.playerId, values, { ar: r.ar, bj: r.bj, poker: r.poker })
                        }
                      />
                    </td>
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

type BetValues = Record<AvgBetGroup, number | null>;

function BetCell({
  ar, bj, poker, playerLabel, cardLabel, canEdit, onCommit,
}: {
  ar: number | null; bj: number | null; poker: number | null;
  playerLabel: string; cardLabel: string;
  canEdit: boolean;
  onCommit: (values: BetValues) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const Trio = (
    <div className="flex justify-end gap-2 font-mono text-[11px] leading-tight tabular-nums">
      <span className={ar == null ? "text-muted-foreground/50" : "text-card-foreground"}>
        <span className="opacity-60 mr-1">AR</span>{ar == null ? "·" : formatNumberSpaces(ar)}
      </span>
      <span className={bj == null ? "text-muted-foreground/50" : "text-card-foreground"}>
        <span className="opacity-60 mr-1">BJ</span>{bj == null ? "·" : formatNumberSpaces(bj)}
      </span>
      <span className={poker == null ? "text-muted-foreground/50" : "text-card-foreground"}>
        <span className="opacity-60 mr-1">P</span>{poker == null ? "·" : formatNumberSpaces(poker)}
      </span>
    </div>
  );

  if (!canEdit) {
    return <div className="text-sm">{Trio}</div>;
  }

  return (
    <div className="relative inline-block w-full">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-right rounded-md px-2 py-1 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
        title="Click to edit bets"
      >
        {Trio}
      </button>
      {open && (
        <BetPopover
          ref={popRef}
          anchor={btnRef.current}
          dropUp={dropUp}
          setDropUp={setDropUp}
          ar={ar} bj={bj} poker={poker}
          playerLabel={playerLabel}
          cardLabel={cardLabel}
          onClose={() => setOpen(false)}
          onCommit={(values) => { onCommit(values); setOpen(false); }}
        />
      )}
    </div>
  );
}

interface BetPopoverProps {
  anchor: HTMLElement | null;
  dropUp: boolean;
  setDropUp: (b: boolean) => void;
  ar: number | null; bj: number | null; poker: number | null;
  playerLabel: string; cardLabel: string;
  onClose: () => void;
  onCommit: (values: BetValues) => void;
}

const BetPopover = (() => {
  const Inner = (
    { anchor, dropUp, setDropUp, ar, bj, poker, playerLabel, cardLabel, onClose, onCommit }: BetPopoverProps,
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const localRef = useRef<HTMLDivElement>(null);
    const setRefs = (el: HTMLDivElement | null) => {
      (localRef as any).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as any).current = el;
    };

    const [arS, setArS] = useState(ar == null ? "" : String(ar));
    const [bjS, setBjS] = useState(bj == null ? "" : String(bj));
    const [pkS, setPkS] = useState(poker == null ? "" : String(poker));
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      firstInputRef.current?.focus();
      firstInputRef.current?.select();
    }, []);

    // Outside click + Esc
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (localRef.current?.contains(e.target as Node)) return;
        if (anchor?.contains(e.target as Node)) return;
        onClose();
      };
      const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onEsc);
      return () => {
        document.removeEventListener("mousedown", onDoc);
        document.removeEventListener("keydown", onEsc);
      };
    }, [anchor, onClose]);

    // Auto-flip
    useLayoutEffect(() => {
      if (!anchor || !localRef.current) return;
      const aRect = anchor.getBoundingClientRect();
      const popH = localRef.current.offsetHeight;
      const spaceBelow = window.innerHeight - aRect.bottom - 8;
      const spaceAbove = aRect.top - 8;
      if (popH > spaceBelow && spaceAbove > spaceBelow) setDropUp(true);
      else setDropUp(false);
    }, [anchor, setDropUp]);

    const parse = (s: string): number | null => {
      const t = s.trim().replace(/\s/g, "");
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const commit = () => {
      onCommit({
        ar: parse(arS),
        bj: parse(bjS),
        poker: parse(pkS),
      });
    };

    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
    };

    const Row = ({
      label, value, setValue, inputRef,
    }: {
      label: string; value: string; setValue: (s: string) => void; inputRef?: React.Ref<HTMLInputElement>;
    }) => (
      <div className="flex items-center gap-2">
        <span className="w-12 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Input
          ref={inputRef as any}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          className="no-spin h-9 text-right font-mono"
          placeholder="0"
        />
      </div>
    );

    return (
      <div
        ref={setRefs}
        className={`absolute z-50 right-0 ${dropUp ? "bottom-full mb-2" : "top-full mt-2"} w-[260px] bg-popover border border-border rounded-lg shadow-xl p-3`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-card-foreground truncate">{playerLabel || "Player"}</p>
            {cardLabel && (
              <p className="text-[10px] font-mono text-muted-foreground">{cardLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-0.5"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          <Row label="AR" value={arS} setValue={setArS} inputRef={firstInputRef} />
          <Row label="BJ" value={bjS} setValue={setBjS} />
          <Row label="Poker" value={pkS} setValue={setPkS} />
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={commit}>Save</Button>
        </div>
      </div>
    );
  };

  return (require("react") as typeof import("react")).forwardRef<HTMLDivElement, BetPopoverProps>(Inner as any);
})();
