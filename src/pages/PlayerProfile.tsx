import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, User, Users as UsersIcon, BarChart3, Ticket, Trophy, History, MapPin, Gift } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DateRangePresets, type DatePreset, presetRange } from "@/components/ui/date-range-presets";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import CasinoBadge from "@/components/player/CasinoBadge";
import FlagBadges from "@/components/player/FlagBadges";
import PlayerEditDialog from "@/components/PlayerEditDialog";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import {
  usePlayer, usePlayerVisits, usePlayerSessions, usePlayerGroupHistory,
  usePlayerNotes, usePlayerTransactions, usePlayerEconomy, usePlayerExpenses,
} from "@/hooks/use-player-profile";
import { useAuth } from "@/lib/auth-context";
import { edgeFor, theoFromHands, theoFromDrop, holdPct } from "@/lib/casino-edges";

// CCTV (surveillance) and finance_manager get read-only access on this page.
// Manager / Super Admin can edit via the dialog.

const fmtDuration = (minutes: number) => {
  if (!minutes || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const visitDuration = (v: any) => {
  if (!v.checked_out_at) return 0;
  const start = new Date(v.checked_in_at).getTime();
  const end = new Date(v.checked_out_at).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
};

const fmtMoney = (n: number) => {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString()}`;
};

const PlayerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, isManager } = useAuth();

  const { data: player, isLoading } = usePlayer(id);
  const { data: visits = [] } = usePlayerVisits(id);
  const { data: transactions = [] } = usePlayerTransactions(id);
  const { data: groupHistory = [] } = usePlayerGroupHistory(id);
  const { data: economy = null } = usePlayerEconomy(id);
  const { data: expenses = [] } = usePlayerExpenses(id);
  const canSeeNotes = roles.some(r => ["pit", "surveillance", "manager"].includes(r)) || isManager;
  const { data: notes = [] } = usePlayerNotes(id, canSeeNotes);

  const [preset, setPreset] = useState<DatePreset>("month");
  const [range, setRange] = useState(() => presetRange("month"));
  const { data: sessions = [] } = usePlayerSessions(id, range);

  const [editOpen, setEditOpen] = useState(false);

  // Range bounds (apply to all tabs).
  const rangeStartMs = useMemo(() => new Date(`${range.from}T00:00:00`).getTime(), [range.from]);
  const rangeEndMs = useMemo(() => new Date(`${range.to}T23:59:59`).getTime(), [range.to]);

  const visitsInRange = useMemo(
    () => visits.filter((v: any) => {
      const ts = new Date(v.checked_in_at).getTime();
      return ts >= rangeStartMs && ts <= rangeEndMs;
    }),
    [visits, rangeStartMs, rangeEndMs]
  );

  const txInRange = useMemo(
    () => transactions.filter((t: any) => {
      const ts = new Date(t.created_at).getTime();
      return ts >= rangeStartMs && ts <= rangeEndMs;
    }),
    [transactions, rangeStartMs, rangeEndMs]
  );

  const expensesInRange = useMemo(
    () => expenses.filter((e: any) => {
      const ts = new Date(e.created_at).getTime();
      return ts >= rangeStartMs && ts <= rangeEndMs;
    }),
    [expenses, rangeStartMs, rangeEndMs]
  );

  // Map transactions to visits (same casino + within check-in / check-out window).
  const visitFinancials = useMemo(() => {
    const map = new Map<string, { totalIn: number; cashout: number; comps: number }>();
    for (const v of visits) {
      const start = new Date(v.checked_in_at).getTime();
      const end = v.checked_out_at ? new Date(v.checked_out_at).getTime() : start + 24 * 3600 * 1000;
      let totalIn = 0;
      let cashout = 0;
      let comps = 0;
      for (const t of transactions) {
        if (t.casino_id !== v.casino_id) continue;
        const ts = new Date(t.created_at).getTime();
        if (ts < start || ts > end) continue;
        const amt = Number(t.amount) || 0;
        if (t.type === "buy") totalIn += amt;
        else if (t.type === "cashout") cashout += amt;
      }
      for (const e of expenses) {
        if (e.casino_id !== v.casino_id) continue;
        const ts = new Date(e.created_at).getTime();
        if (ts < start || ts > end) continue;
        comps += Number(e.amount) || 0;
      }
      map.set(v.id, { totalIn, cashout, comps });
    }
    return map;
  }, [visits, transactions, expenses]);

  // Lifetime KPIs — prefer authoritative `player_economy` view, fall back to derived.
  const lifetime = useMemo(() => {
    const totalMins = visits.reduce((s, v) => s + visitDuration(v), 0);
    const drop = Number(economy?.total_drop) || 0;
    const cashout = Number(economy?.total_cashout) || 0;
    const comps = Number(economy?.total_expenses) || 0;
    const result = Number(economy?.real_result);
    const realResult = Number.isFinite(result) ? result : drop - cashout - comps;
    const hold = holdPct(drop, cashout, comps);
    const firstVisit = visits.length ? visits[visits.length - 1].checked_in_at : null;
    const lastVisit = visits[0]?.checked_in_at || null;
    const daysSinceLast = lastVisit
      ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)
      : null;
    const avgSession = visits.length ? Math.round(totalMins / visits.length) : 0;
    return {
      visitCount: visits.length,
      totalMins,
      avgSession,
      drop,
      cashout,
      comps,
      realResult,
      hold,
      firstVisit,
      lastVisit,
      daysSinceLast,
    };
  }, [visits, economy]);

  // Period summary (uses range-filtered tx + expenses + visits).
  const period = useMemo(() => {
    let pIn = 0, pOut = 0;
    for (const t of txInRange as any[]) {
      const amt = Number(t.amount) || 0;
      if (t.type === "buy") pIn += amt;
      else if (t.type === "cashout") pOut += amt;
    }
    const pComps = expensesInRange.reduce((s, e: any) => s + (Number(e.amount) || 0), 0);
    const pMins = visitsInRange.reduce((s, v) => s + visitDuration(v), 0);
    const result = pIn - pOut - pComps;
    return { pIn, pOut, pComps, pMins, result, hold: holdPct(pIn, pOut, pComps), visits: visitsInRange.length };
  }, [txInRange, expensesInRange, visitsInRange]);

  // Per-table aggregates (Position / Sessions / Hands / Avg bet / Duration / IN / OUT / Theo / Result / Hold).
  const tableStats = useMemo(() => {
    type Row = {
      key: string; name: string; game: string;
      sessions: number; hands: number; betSum: number;
      minutes: number; totalIn: number; totalOut: number;
    };
    const map = new Map<string, Row>();

    for (const s of sessions as any[]) {
      const key = s.table_id || "unknown";
      const name = s.gaming_tables?.name || "—";
      const game = s.gaming_tables?.game || "—";
      const cur = map.get(key) || { key, name, game, sessions: 0, hands: 0, betSum: 0, minutes: 0, totalIn: 0, totalOut: 0 };
      cur.sessions += 1;
      cur.hands += s.hands_played || 0;
      cur.betSum += (Number(s.avg_bet) || 0) * (s.hands_played || 0);
      cur.minutes += s.duration_minutes || 0;
      map.set(key, cur);
    }
    for (const t of txInRange as any[]) {
      const key = t.table_id || "unknown";
      const name = t.gaming_tables?.name || "—";
      const game = t.gaming_tables?.game || "—";
      const cur = map.get(key) || { key, name, game, sessions: 0, hands: 0, betSum: 0, minutes: 0, totalIn: 0, totalOut: 0 };
      const amt = Number(t.amount) || 0;
      if (t.type === "buy") cur.totalIn += amt;
      else if (t.type === "cashout") cur.totalOut += amt;
      if (cur.name === "—" && name !== "—") cur.name = name;
      if (cur.game === "—" && game !== "—") cur.game = game;
      map.set(key, cur);
    }

    const rows = Array.from(map.values())
      .filter(r => r.minutes > 0 || r.totalIn > 0 || r.totalOut > 0)
      .sort((a, b) => (b.totalIn - b.totalOut) - (a.totalIn - a.totalOut));

    const total = rows.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        hands: acc.hands + r.hands,
        minutes: acc.minutes + r.minutes,
        totalIn: acc.totalIn + r.totalIn,
        totalOut: acc.totalOut + r.totalOut,
        betSum: acc.betSum + r.betSum,
      }),
      { sessions: 0, hands: 0, minutes: 0, totalIn: 0, totalOut: 0, betSum: 0 }
    );
    return { rows, total };
  }, [sessions, txInRange]);

  // Per-game aggregates.
  const gameStats = useMemo(() => {
    type Row = { game: string; sessions: number; hands: number; minutes: number; totalIn: number; totalOut: number };
    const map = new Map<string, Row>();
    for (const r of tableStats.rows) {
      const key = r.game;
      const cur = map.get(key) || { game: key, sessions: 0, hands: 0, minutes: 0, totalIn: 0, totalOut: 0 };
      cur.sessions += r.sessions;
      cur.hands += r.hands;
      cur.minutes += r.minutes;
      cur.totalIn += r.totalIn;
      cur.totalOut += r.totalOut;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => (b.totalIn - b.totalOut) - (a.totalIn - a.totalOut));
  }, [tableStats.rows]);

  // Per-casino aggregates (only useful when player visited multiple casinos).
  const casinoStats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; visits: number; totalIn: number; totalOut: number; comps: number }>();
    for (const v of visitsInRange as any[]) {
      const k = v.casino_id;
      const cur = map.get(k) || { id: k, name: v.casinos?.name || "—", visits: 0, totalIn: 0, totalOut: 0, comps: 0 };
      cur.visits += 1;
      const f = visitFinancials.get(v.id);
      if (f) { cur.totalIn += f.totalIn; cur.totalOut += f.cashout; cur.comps += f.comps; }
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.totalIn - a.totalIn);
  }, [visitsInRange, visitFinancials]);

  // Weekday × hour heatmap (all visits, lifetime).
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const v of visits as any[]) {
      const d = new Date(v.checked_in_at);
      grid[d.getDay()][d.getHours()] += 1;
    }
    let max = 0;
    for (const row of grid) for (const c of row) if (c > max) max = c;
    return { grid, max };
  }, [visits]);

  if (isLoading) {
    return (
      <PageShell>
        <div className="text-center text-muted-foreground py-12">Loading player…</div>
      </PageShell>
    );
  }

  if (!player) {
    return (
      <PageShell>
        <div className="text-center text-muted-foreground py-12">
          Player not found.
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => navigate("/players")}>Back</Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const fullName = `${player.first_name} ${player.last_name}`.trim();
  const tags = (player.player_tags || []).map((t: any) => t.tag);
  const activeCard = (player.player_cards || []).find((c: any) => c.is_active)?.card_number
    || player.player_cards?.[0]?.card_number;

  return (
    <PageShell>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/players")} className="h-9">
          <ArrowLeft className="w-4 h-4 mr-1" /> Players
        </Button>
        {(isManager || roles.includes("super_admin")) && (
          <Button variant="outline" size="sm" className="h-9" onClick={() => setEditOpen(true)}>
            Edit player
          </Button>
        )}
      </div>

      {/* Header card: photo left, info right */}
      <PageSection card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-[180px] shrink-0">
            <div className="aspect-[4/5] w-full rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
              {player.photo_url ? (
                <img src={player.photo_url} className="w-full h-full object-cover" alt={fullName} />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold text-card-foreground">{fullName}</h1>
                  <CategoryBadge category={(player.category as PlayerCategory) || "normal"} size="md" />
                  {player.status === "blacklist" && (
                    <span className="text-xs font-bold text-destructive border border-destructive rounded px-1.5 py-0.5">BL</span>
                  )}
                  {player.casino_id && <CasinoBadge casinoId={player.casino_id} />}
                </div>
                {player.nickname && (
                  <div className="text-sm text-muted-foreground mt-0.5">"{player.nickname}"</div>
                )}
              </div>
              <div className="font-mono text-xs text-muted-foreground text-right">
                {activeCard && <div>Card: {activeCard}</div>}
                {player.id_number && <div>ID: {player.id_number}</div>}
              </div>
            </div>

            {tags.length > 0 && <FlagBadges tags={tags} />}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
              <Kpi label="Visits" value={lifetime.visitCount.toString()} />
              <Kpi label="Total time" value={fmtDuration(lifetime.totalMins)} />
              <Kpi label="Avg session" value={lifetime.avgSession ? fmtDuration(lifetime.avgSession) : "—"} />
              <Kpi label="Drop" value={fmtMoney(lifetime.drop)} />
              <Kpi label="Cashout" value={fmtMoney(lifetime.cashout)} />
              <Kpi label="Comps" value={fmtMoney(lifetime.comps)} />
              <Kpi
                label="Real result"
                value={fmtMoney(lifetime.realResult)}
                valueClass={lifetime.realResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}
              />
              <Kpi
                label="Hold %"
                value={lifetime.hold === null ? "—" : `${lifetime.hold.toFixed(1)}%`}
                valueClass={lifetime.hold === null ? undefined : lifetime.hold >= 0 ? "cms-amount-positive" : "cms-amount-negative"}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs text-muted-foreground">
              <Field label="Phone" value={player.phone || "—"} />
              <Field label="Birth date" value={player.birth_date ? fmtDate(player.birth_date) : "—"} />
              <Field label="Player type" value={player.player_type || "—"} />
              <Field label="Status" value={player.status || "active"} />
              <Field label="First visit" value={lifetime.firstVisit ? fmtDate(lifetime.firstVisit) : "—"} />
              <Field
                label="Days since last"
                value={lifetime.daysSinceLast === null ? "—" : `${lifetime.daysSinceLast}d`}
              />
            </div>
          </div>
        </div>
      </PageSection>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="info"><History className="w-3.5 h-3.5 mr-1" /> Info & History</TabsTrigger>
            <TabsTrigger value="stats"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Statistics</TabsTrigger>
            <TabsTrigger value="connections"><UsersIcon className="w-3.5 h-3.5 mr-1" /> Connections</TabsTrigger>
            <TabsTrigger value="lotteries"><Trophy className="w-3.5 h-3.5 mr-1" /> Lotteries</TabsTrigger>
            <TabsTrigger value="tickets"><Ticket className="w-3.5 h-3.5 mr-1" /> Tickets</TabsTrigger>
          </TabsList>
          <DateRangePresets
            preset={preset}
            from={range.from}
            to={range.to}
            onChange={(next) => { setPreset(next.preset); setRange({ from: next.from, to: next.to }); }}
          />
        </div>

        {/* TAB 1 */}
        <TabsContent value="info" className="space-y-4">
          {canSeeNotes && (
            <PageSection card title={`Notes (${notes.length})`}>
              {notes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No notes yet.</div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {notes.map((n: any) => (
                    <div key={n.id} className="text-xs p-2 rounded bg-muted/40 border border-border border-l-2 border-l-primary">
                      <div className="text-[9px] font-mono uppercase text-muted-foreground">{n.note_type || "info"}</div>
                      <div className="text-card-foreground mt-0.5">{n.content}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{fmtDateTime(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </PageSection>
          )}

          <PageSection card title={`Visits (${visitsInRange.length})`}>
            {visitsInRange.length === 0 ? (
              <div className="text-sm text-muted-foreground">No visits in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Casino</th>
                      <th className="text-left py-2 px-2">Check-in</th>
                      <th className="text-left py-2 px-2">Check-out</th>
                      <th className="text-left py-2 px-2">Duration</th>
                      <th className="text-left py-2 px-2">Position</th>
                      <th className="text-right py-2 px-2">Total IN</th>
                      <th className="text-right py-2 px-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitsInRange.slice(0, 200).map((v: any) => {
                      const f = visitFinancials.get(v.id) || { totalIn: 0, cashout: 0 };
                      const result = f.totalIn - f.cashout;
                      return (
                        <tr key={v.id} className="border-t border-border">
                          <td className="py-1.5 px-2 font-mono text-xs">{fmtDate(v.date)}</td>
                          <td className="py-1.5 px-2">{v.casinos?.name || "—"}</td>
                          <td className="py-1.5 px-2 font-mono text-xs">{fmtDateTime(v.checked_in_at)}</td>
                          <td className="py-1.5 px-2 font-mono text-xs">{v.checked_out_at ? fmtDateTime(v.checked_out_at) : "—"}</td>
                          <td className="py-1.5 px-2">{fmtDuration(visitDuration(v))}</td>
                          <td className="py-1.5 px-2"><span className="inline-flex items-center gap-1 text-xs"><MapPin className="w-3 h-3" />{v.position}</span></td>
                          <td className="py-1.5 px-2 font-mono text-xs text-right">{f.totalIn ? fmtMoney(f.totalIn) : <span className="text-muted-foreground">·</span>}</td>
                          <td className={`py-1.5 px-2 font-mono text-xs text-right ${result === 0 ? "text-muted-foreground" : result > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                            {result === 0 ? "·" : fmtMoney(result)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const periodMins = visitsInRange.reduce((s, v) => s + visitDuration(v), 0);
                      let pIn = 0; let pRes = 0;
                      for (const v of visitsInRange) {
                        const f = visitFinancials.get(v.id);
                        if (!f) continue;
                        pIn += f.totalIn;
                        pRes += f.totalIn - f.cashout;
                      }
                      return (
                        <tr className="border-t-2 border-border font-semibold">
                          <td className="py-2 px-2 text-xs uppercase text-muted-foreground" colSpan={4}>Total (period)</td>
                          <td className="py-2 px-2">{fmtDuration(periodMins)}</td>
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2 font-mono text-xs text-right">{fmtMoney(pIn)}</td>
                          <td className={`py-2 px-2 font-mono text-xs text-right ${pRes >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>{fmtMoney(pRes)}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            )}
          </PageSection>
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="stats" className="space-y-4">
          <PageSection card title={`Tables (${tableStats.rows.length})`}>
            {tableStats.rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No table activity in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2 px-2">Position</th>
                      <th className="text-right py-2 px-2">Total duration</th>
                      <th className="text-right py-2 px-2">Total IN</th>
                      <th className="text-right py-2 px-2">Total OUT</th>
                      <th className="text-right py-2 px-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableStats.rows.map((r) => {
                      const result = r.totalIn - r.totalOut;
                      return (
                        <tr key={r.key} className="border-t border-border">
                          <td className="py-1.5 px-2">{r.name}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{r.minutes ? fmtDuration(r.minutes) : <span className="text-muted-foreground">·</span>}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{r.totalIn ? fmtMoney(r.totalIn) : <span className="text-muted-foreground">·</span>}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{r.totalOut ? fmtMoney(r.totalOut) : <span className="text-muted-foreground">·</span>}</td>
                          <td className={`py-1.5 px-2 text-right font-mono ${result === 0 ? "text-muted-foreground" : result > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                            {result === 0 ? "·" : fmtMoney(result)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="py-2 px-2 uppercase text-xs text-muted-foreground">Total</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtDuration(tableStats.total.minutes)}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtMoney(tableStats.total.totalIn)}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtMoney(tableStats.total.totalOut)}</td>
                      <td className={`py-2 px-2 text-right font-mono ${(tableStats.total.totalIn - tableStats.total.totalOut) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                        {fmtMoney(tableStats.total.totalIn - tableStats.total.totalOut)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </PageSection>

          <PageSection card title="Slots">
            <div className="text-sm text-muted-foreground">
              Per-session slot tracking is not yet recorded. Aggregated economy data is available on the Stats page.
            </div>
          </PageSection>
        </TabsContent>

        {/* TAB 3 */}
        <TabsContent value="connections" className="space-y-4">
          <PageSection card title={`Group memberships (${groupHistory.length})`}>
            {groupHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground">Not part of any group.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2 px-2">Group</th>
                      <th className="text-left py-2 px-2">Joined</th>
                      <th className="text-left py-2 px-2">Left</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupHistory.map((m: any) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-1.5 px-2">
                          <Link to="/groups" className="text-primary hover:underline">
                            {m.player_groups?.name || "—"}
                          </Link>
                        </td>
                        <td className="py-1.5 px-2 font-mono text-xs">{m.joined_at ? fmtDateTime(m.joined_at) : "—"}</td>
                        <td className="py-1.5 px-2 font-mono text-xs">{m.left_at ? fmtDateTime(m.left_at) : "—"}</td>
                        <td className="py-1.5 px-2">
                          {m.left_at ? (
                            <span className="text-xs text-muted-foreground">Left</span>
                          ) : (
                            <span className="text-xs text-success">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageSection>
        </TabsContent>

        {/* TAB 4 */}
        <TabsContent value="lotteries">
          <PageSection card title="Lotteries & Raffles history">
            <div className="text-sm text-muted-foreground py-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Lottery module is not active yet. Past entries will appear here.
            </div>
          </PageSection>
        </TabsContent>

        {/* TAB 5 */}
        <TabsContent value="tickets">
          <PageSection card title="Tickets for upcoming raffles">
            <div className="text-sm text-muted-foreground py-6 text-center">
              <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No upcoming tickets. Once the lottery module is enabled, active tickets will be listed here.
            </div>
          </PageSection>
        </TabsContent>
      </Tabs>

      <PlayerEditDialog
        player={player as any}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </PageShell>
  );
};

const Kpi = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-base font-semibold font-mono ${valueClass || "text-card-foreground"}`}>{value}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider">{label}</div>
    <div className="text-sm text-card-foreground">{value}</div>
  </div>
);

export default PlayerProfile;
