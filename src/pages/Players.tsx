import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Users } from "lucide-react";
import { usePlayers, usePlayerEconomyRange } from "@/hooks/use-casino-data";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategoryBadge, { CATEGORY_PRIORITY, type PlayerCategory } from "@/components/player/CategoryBadge";
import CategoryFilter from "@/components/player/CategoryFilter";
import FlagBadges from "@/components/player/FlagBadges";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/layout/FilterBar";
import { DateRangePresets, type DatePreset, presetRange } from "@/components/ui/date-range-presets";
import { getBusinessDate } from "@/lib/business-day";

const ROW_HEIGHT = 48;

const fmtAmount = (n: number, signed = false) => {
  if (!n) return <span className="text-muted-foreground">·</span>;
  const cls = n < 0 ? "cms-amount-negative" : "cms-amount-positive";
  const sign = signed && n > 0 ? "+" : "";
  return <span className={`font-mono ${cls}`}>{sign}{n.toLocaleString()}</span>;
};

const fmtNeutral = (n: number) =>
  n ? <span className="font-mono text-card-foreground">{n.toLocaleString()}</span> : <span className="text-muted-foreground">·</span>;

const fmtPct = (n: number | null) => {
  if (n === null || !isFinite(n)) return <span className="text-muted-foreground">·</span>;
  const cls = n < 0 ? "cms-amount-negative" : "cms-amount-positive";
  return <span className={`font-mono ${cls}`}>{n.toFixed(1)}%</span>;
};

/** Month-to-date by business day (Africa/Dar_es_Salaam). */
const monthToDateRange = (): { from: string; to: string } => {
  const todayBiz = getBusinessDate();
  const from = `${todayBiz.slice(0, 7)}-01`;
  return { from, to: todayBiz };
};

const Players = () => {
  const navigate = useNavigate();
  const { data: players = [], isLoading } = usePlayers();

  const [preset, setPreset] = useState<DatePreset>("month");
  const initial = monthToDateRange();
  const [range, setRange] = useState<{ from: string; to: string }>(initial);

  const { data: econMap } = usePlayerEconomyRange(range);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [categoryFilter, setCategoryFilter] = useState<Set<PlayerCategory>>(new Set(["diamond", "platinum", "gold", "normal"]));
  type SortKey = "category" | "drop" | "cashout" | "result" | "realResult" | "visits";
  const [sortKey, setSortKey] = useState<SortKey>("category");

  const parentRef = useRef<HTMLDivElement>(null);

  // Build enriched rows
  const enriched = useMemo(() => {
    return players.map(p => {
      const e = econMap?.get(p.id);
      const drop = e?.drop || 0;
      const cashout = e?.cashout || 0;
      const comps = e?.comps || 0;
      const visits = e?.visits || 0;
      const lastVisit = e?.lastVisit || null;
      const result = cashout - drop;
      const realResult = cashout - drop - comps;
      const hold = drop > 0 ? ((drop - cashout - comps) / drop) * 100 : null;
      return { p, drop, cashout, comps, visits, lastVisit, result, realResult, hold };
    });
  }, [players, econMap]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(({ p }) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        p.player_cards?.some(c => c.card_number.includes(debouncedQuery))
      );
    }
    list = list.filter(({ p }) => categoryFilter.has((p.category as PlayerCategory) || "normal"));

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "drop": return b.drop - a.drop;
        case "cashout": return b.cashout - a.cashout;
        case "result": return a.result - b.result; // worst player-result first = best house
        case "realResult": return a.realResult - b.realResult;
        case "visits": return b.visits - a.visits;
        case "category":
        default: {
          const catA = CATEGORY_PRIORITY[(a.p.category as PlayerCategory) || "normal"];
          const catB = CATEGORY_PRIORITY[(b.p.category as PlayerCategory) || "normal"];
          if (catA !== catB) return catA - catB;
          return `${a.p.first_name} ${a.p.last_name}`.localeCompare(`${b.p.first_name} ${b.p.last_name}`);
        }
      }
    });
    return list;
  }, [enriched, debouncedQuery, categoryFilter, sortKey]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.drop += r.drop; acc.cashout += r.cashout; acc.comps += r.comps;
        acc.result += r.result; acc.realResult += r.realResult; acc.visits += r.visits;
        return acc;
      },
      { drop: 0, cashout: 0, comps: 0, result: 0, realResult: 0, visits: 0 }
    );
  }, [filtered]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => setSortKey(k)}
      className={`text-left text-[10px] font-medium uppercase tracking-wider transition-colors ${
        sortKey === k ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}{sortKey === k ? " ↓" : ""}
    </button>
  );

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Players"
        subtitle={`${players.length} registered · DROP / CASHOUT / RESULT / REAL = RESULT − COMPS`}
        date
      >
        <DateRangePresets
          preset={preset}
          from={range.from}
          to={range.to}
          onChange={(v) => { setPreset(v.preset); setRange({ from: v.from, to: v.to }); }}
        />
      </PageHeader>

      <FilterBar
        search={
          <div className="relative w-[320px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search name, nickname, card…" className="pl-10 font-mono h-9" />
          </div>
        }
        filters={<CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />}
        right={
          <span className="text-xs font-mono text-muted-foreground">
            {filtered.length} of {players.length}
          </span>
        }
      />

      <div className="cms-panel overflow-hidden">
        {/* Header row — uses same column widths as body (CSS grid) */}
        <div className="grid border-b border-border px-3 py-2 gap-2 bg-muted/30"
          style={{ gridTemplateColumns: "70px minmax(180px,1.4fr) 80px 60px 60px 110px 110px 110px 90px 110px 80px 110px 110px" }}>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cat</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Player</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
          <SortBtn k="visits" label="Vis" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Last</span>
          <SortBtn k="drop" label="Drop" />
          <SortBtn k="cashout" label="Cashout" />
          <SortBtn k="result" label="Result" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Comps</span>
          <SortBtn k="realResult" label="Real" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hold%</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
          <span />
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">No players found</div>
        ) : (
          <div ref={parentRef} className="max-h-[60vh] overflow-y-auto">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const row = filtered[virtualRow.index];
                const { p } = row;
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/players/${p.id}`)}
                    className="grid items-center border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors absolute w-full px-3 gap-2"
                    style={{
                      gridTemplateColumns: "70px minmax(180px,1.4fr) 80px 60px 60px 110px 110px 110px 90px 110px 80px 110px 110px",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <CategoryBadge category={(p.category as PlayerCategory) || "normal"} />
                    <div className="text-sm font-medium text-card-foreground truncate">
                      {p.first_name} {p.last_name}
                      {p.nickname && <span className="text-xs text-muted-foreground ml-1.5">({p.nickname})</span>}
                    </div>
                    <span className={p.status === "active" ? "cms-status-active text-[11px]" : "cms-status-blacklist text-[11px]"}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${p.status === "active" ? "bg-success" : "bg-danger"}`} />
                      {p.status}
                    </span>
                    <span className="text-xs font-mono text-card-foreground">{row.visits || <span className="text-muted-foreground">·</span>}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {row.lastVisit ? row.lastVisit.slice(5, 10) : "·"}
                    </span>
                    <span className="text-xs">{fmtNeutral(row.drop)}</span>
                    <span className="text-xs">{fmtNeutral(row.cashout)}</span>
                    <span className="text-xs">{fmtAmount(row.result, true)}</span>
                    <span className="text-xs">{fmtNeutral(row.comps)}</span>
                    <span className="text-xs">{fmtAmount(row.realResult, true)}</span>
                    <span className="text-xs">{fmtPct(row.hold)}</span>
                    <FlagBadges tags={p.player_tags?.map(t => t.tag) || []} compact />
                    <span />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer totals */}
        {filtered.length > 0 && (
          <div className="grid items-center border-t border-border px-3 py-2 gap-2 bg-muted/40"
            style={{ gridTemplateColumns: "70px minmax(180px,1.4fr) 80px 60px 60px 110px 110px 110px 90px 110px 80px 110px 110px" }}>
            <span />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Period total</span>
            <span />
            <span className="text-xs font-mono text-card-foreground">{totals.visits || "·"}</span>
            <span />
            <span className="text-xs">{fmtNeutral(totals.drop)}</span>
            <span className="text-xs">{fmtNeutral(totals.cashout)}</span>
            <span className="text-xs">{fmtAmount(totals.result, true)}</span>
            <span className="text-xs">{fmtNeutral(totals.comps)}</span>
            <span className="text-xs">{fmtAmount(totals.realResult, true)}</span>
            <span className="text-xs">{fmtPct(totals.drop > 0 ? ((totals.drop - totals.cashout - totals.comps) / totals.drop) * 100 : null)}</span>
            <span /><span />
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Players;
