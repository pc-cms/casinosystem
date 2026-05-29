/**
 * M11 — /pos/manager/player-analytics
 * Top players by F&B consumption with per-player drill-down.
 */
import { useMemo, useState } from "react";
import { Users, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCasino } from "@/lib/casino-context";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import {
  usePosPlayerAnalytics,
  usePosPlayerItems,
} from "@/hooks/use-pos-player-analytics";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateOnly, fmtDateTime } from "@/lib/format-date";

const KPI = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="cms-panel p-3">
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-mono text-xl font-bold tabular-nums leading-tight">{value}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
  </div>
);

export default function PosPlayerAnalytics() {
  const { activeCasinoId } = useCasino();
  const todayQ = useEffectiveBusinessDate();
  const today = todayQ.data ?? format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const range = useMemo(() => ({ from, to }), [from, to]);
  const { data, isLoading } = usePosPlayerAnalytics(activeCasinoId, range);
  const { data: items, isLoading: itemsLoading } = usePosPlayerItems(
    activeCasinoId, selectedPlayer, range,
  );

  const setQuick = (kind: "today" | "7d" | "30d") => {
    const t = today;
    setTo(t);
    if (kind === "today") setFrom(t);
    else {
      const d = new Date(t + "T00:00:00");
      d.setDate(d.getDate() - (kind === "7d" ? 6 : 29));
      setFrom(format(d, "yyyy-MM-dd"));
    }
  };

  const totals = data?.totals;
  const rows = data?.rows ?? [];
  const selectedRow = rows.find(r => r.player_id === selectedPlayer);

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Player Bar Analytics"
        subtitle={`${fmtDateOnly(from)} → ${fmtDateOnly(to)}`}
      >
        <Button variant="outline" size="sm" onClick={() => setQuick("today")}>Today</Button>
        <Button variant="outline" size="sm" onClick={() => setQuick("7d")}>7d</Button>
        <Button variant="outline" size="sm" onClick={() => setQuick("30d")}>30d</Button>
      </PageHeader>

      <PageSection>
        <div className="cms-panel p-3 mb-3 flex flex-wrap items-end gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">From</div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">To</div>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <KPI label="Players served" value={String(totals?.players ?? 0)} />
          <KPI label="Bills" value={String(totals?.bills ?? 0)} />
          <KPI label="Gross sales" value={formatNumberSpaces(totals?.gross_tzs ?? 0)} sub="TZS" />
          <KPI label="Avg / player" value={formatNumberSpaces(totals?.avg_per_player ?? 0)} sub="TZS" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Player ranking */}
          <div className="cms-panel lg:col-span-2">
            <div className="px-3 py-2 border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Top players by F&B spend
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Player</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Bills</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Gross</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Charged</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Comp P</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Comp H</th>
                    <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Last visit</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No data</td></tr>
                  )}
                  {rows.map(r => {
                    const active = selectedPlayer === r.player_id;
                    return (
                      <tr
                        key={r.player_id}
                        className={`border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/30 ${active ? "bg-accent/40" : ""}`}
                        onClick={() => setSelectedPlayer(r.player_id)}
                      >
                        <td className="px-3 py-2">
                          <Link
                            to={`/players/${r.player_id}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.player_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{r.bills}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumberSpaces(r.gross_tzs)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumberSpaces(r.player_charge)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumberSpaces(r.comp_player)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumberSpaces(r.comp_house)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.last_visit ? fmtDateTime(r.last_visit) : "·"}</td>
                        <td className="px-2"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down: items consumed by selected player */}
          <div className="cms-panel">
            <div className="px-3 py-2 border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {selectedRow ? `Items · ${selectedRow.player_name}` : "Select a player"}
            </div>
            {!selectedPlayer && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Click a row to see consumption breakdown.
              </div>
            )}
            {selectedPlayer && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsLoading && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!itemsLoading && (items ?? []).length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No items</td></tr>
                  )}
                  {(items ?? []).map(it => (
                    <tr key={it.item_id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">{it.item_name}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{it.qty}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumberSpaces(it.revenue_tzs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
}
