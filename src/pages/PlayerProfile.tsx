import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, User, FileImage, Users as UsersIcon, BarChart3, Ticket, Trophy, History, MapPin } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DateRangePresets, type DatePreset, presetRange } from "@/components/ui/date-range-presets";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import CasinoBadge from "@/components/player/CasinoBadge";
import FlagBadges from "@/components/player/FlagBadges";
import PlayerEditDialog from "@/components/PlayerEditDialog";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import { usePlayer, usePlayerVisits, usePlayerSessions, usePlayerGroupHistory, usePlayerNotes, usePlayerTransactions } from "@/hooks/use-player-profile";
import { useAuth } from "@/lib/auth-context";

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
  const canSeeNotes = roles.some(r => ["pit", "surveillance", "manager"].includes(r)) || isManager;
  const { data: notes = [] } = usePlayerNotes(id, canSeeNotes);

  const [preset, setPreset] = useState<DatePreset>("month");
  const [range, setRange] = useState(() => presetRange("month"));
  const { data: sessions = [] } = usePlayerSessions(id, range);

  const [editOpen, setEditOpen] = useState(false);

  // Map transactions to visits (same casino + within check-in / check-out window).
  // Open visits (no check-out) consume any later txn within +24h fallback.
  const visitFinancials = useMemo(() => {
    const map = new Map<string, { totalIn: number; cashout: number }>();
    for (const v of visits) {
      const start = new Date(v.checked_in_at).getTime();
      const end = v.checked_out_at ? new Date(v.checked_out_at).getTime() : start + 24 * 3600 * 1000;
      let totalIn = 0;
      let cashout = 0;
      for (const t of transactions) {
        if (t.casino_id !== v.casino_id) continue;
        const ts = new Date(t.created_at).getTime();
        if (ts < start || ts > end) continue;
        const amt = Number(t.amount) || 0;
        if (t.type === "buy") totalIn += amt;
        else if (t.type === "cashout") cashout += amt;
      }
      map.set(v.id, { totalIn, cashout });
    }
    return map;
  }, [visits, transactions]);

  // Lifetime KPIs
  const lifetime = useMemo(() => {
    const totalMins = visits.reduce((s, v) => s + visitDuration(v), 0);
    let totalIn = 0;
    let totalResult = 0;
    for (const v of visits) {
      const f = visitFinancials.get(v.id);
      if (!f) continue;
      totalIn += f.totalIn;
      totalResult += f.totalIn - f.cashout; // house result (positive = casino wins)
    }
    return {
      visitCount: visits.length,
      totalMins,
      lastVisit: visits[0]?.checked_in_at || null,
      totalIn,
      totalResult,
    };
  }, [visits, visitFinancials]);

  // Sessions stats
  const sessionStats = useMemo(() => {
    const tableMap = new Map<string, { name: string; sessions: number; hands: number; bet: number; minutes: number }>();
    for (const s of sessions) {
      const key = s.table_id || "unknown";
      const name = (s as any).gaming_tables?.name || "—";
      const cur = tableMap.get(key) || { name, sessions: 0, hands: 0, bet: 0, minutes: 0 };
      cur.sessions += 1;
      cur.hands += s.hands_played || 0;
      cur.bet += Number(s.total_bet) || 0;
      cur.minutes += s.duration_minutes || 0;
      tableMap.set(key, cur);
    }
    const rows = Array.from(tableMap.values()).sort((a, b) => b.bet - a.bet);
    const total = rows.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        hands: acc.hands + r.hands,
        bet: acc.bet + r.bet,
        minutes: acc.minutes + r.minutes,
      }),
      { sessions: 0, hands: 0, bet: 0, minutes: 0 }
    );
    return { rows, total };
  }, [sessions]);

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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              <Kpi label="Visits" value={lifetime.visitCount.toString()} />
              <Kpi label="Total time" value={fmtDuration(lifetime.totalMins)} />
              <Kpi label="Total IN" value={fmtMoney(lifetime.totalIn)} />
              <Kpi
                label="Result"
                value={fmtMoney(lifetime.totalResult)}
                valueClass={lifetime.totalResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}
              />
              <Kpi label="Last visit" value={lifetime.lastVisit ? fmtDate(lifetime.lastVisit) : "—"} />
              <Kpi label="Registered" value={player.created_at ? fmtDate(player.created_at) : "—"} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
              <Field label="Phone" value={player.phone || "—"} />
              <Field label="Birth date" value={player.birth_date ? fmtDate(player.birth_date) : "—"} />
              <Field label="Player type" value={player.player_type || "—"} />
              <Field label="Status" value={player.status || "active"} />
            </div>
          </div>
        </div>
      </PageSection>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="info"><History className="w-3.5 h-3.5 mr-1" /> Info & History</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Statistics</TabsTrigger>
          <TabsTrigger value="connections"><UsersIcon className="w-3.5 h-3.5 mr-1" /> Connections</TabsTrigger>
          <TabsTrigger value="lotteries"><Trophy className="w-3.5 h-3.5 mr-1" /> Lotteries</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="w-3.5 h-3.5 mr-1" /> Tickets</TabsTrigger>
        </TabsList>

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

          <PageSection card title={`Visits (${visits.length})`}>
            {visits.length === 0 ? (
              <div className="text-sm text-muted-foreground">No visits recorded.</div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 200).map((v: any) => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="py-1.5 px-2 font-mono text-xs">{fmtDate(v.date)}</td>
                        <td className="py-1.5 px-2">{v.casinos?.name || "—"}</td>
                        <td className="py-1.5 px-2 font-mono text-xs">{fmtDateTime(v.checked_in_at)}</td>
                        <td className="py-1.5 px-2 font-mono text-xs">{v.checked_out_at ? fmtDateTime(v.checked_out_at) : "—"}</td>
                        <td className="py-1.5 px-2">{fmtDuration(visitDuration(v))}</td>
                        <td className="py-1.5 px-2"><span className="inline-flex items-center gap-1 text-xs"><MapPin className="w-3 h-3" />{v.position}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageSection>
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="stats" className="space-y-4">
          <DateRangePresets
            preset={preset}
            from={range.from}
            to={range.to}
            onChange={(next) => { setPreset(next.preset); setRange({ from: next.from, to: next.to }); }}
          />

          <PageSection card title={`Tables (${sessionStats.rows.length})`}>
            {sessionStats.rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No table sessions in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2 px-2">Table</th>
                      <th className="text-right py-2 px-2">Sessions</th>
                      <th className="text-right py-2 px-2">Hands</th>
                      <th className="text-right py-2 px-2">Total bet</th>
                      <th className="text-right py-2 px-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionStats.rows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1.5 px-2">{r.name}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{r.sessions}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{r.hands}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(r.bet)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{fmtDuration(r.minutes)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right font-mono">{sessionStats.total.sessions}</td>
                      <td className="py-2 px-2 text-right font-mono">{sessionStats.total.hands}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtMoney(sessionStats.total.bet)}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtDuration(sessionStats.total.minutes)}</td>
                    </tr>
                  </tbody>
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
