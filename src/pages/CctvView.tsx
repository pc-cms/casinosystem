import { useState, useMemo, lazy, Suspense } from "react";
import { CctvLayout, type CctvSection } from "@/components/cctv/CctvLayout";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { usePlayers, useTransactions, useGamingTables, useExpenses, usePlayerEconomy, useVisitsToday } from "@/hooks/use-casino-data";
import { useDealers, usePitRotaRange, useDealerAttendanceRange, useBreaklistData } from "@/hooks/use-casino-data";
import { useCctvObservations, useCreateObservation } from "@/hooks/use-cctv";
import { useActiveShift } from "@/hooks/use-shift";
import { getBusinessDate } from "@/lib/business-day";
import { formatCurrency } from "@/lib/currency";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Users, Landmark, Receipt, TrendingDown, Table2, Eye, Send, BookOpen, Tag, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import CategoryBadge from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// ==================== DASHBOARD SECTION ====================
const CctvDashboard = () => {
  const { casinoId, roles } = useAuth();
  const { activeCasino } = useCasino();
  const businessDate = getBusinessDate();
  const { data: transactions = [] } = useTransactions(businessDate);
  const { data: tables = [] } = useGamingTables();
  const { data: expenses = [] } = useExpenses(businessDate);
  const { data: allVisits = [] } = useVisitsToday("*, players(first_name, last_name, nickname, photo_url, status, player_tags(tag))") as { data: any[] };
  const visits = useMemo(() => allVisits.filter((v: any) => !v.checked_out_at), [allVisits]);

  const buyInDrop = transactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0);
  const cashoutTotal = transactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0);
  const pendingExpenses = expenses.filter(e => !e.approved).reduce((s, e) => s + Number(e.amount), 0);
  const tableResult = tables.filter(t => t.closing_result != null).reduce((s, t) => s + Number(t.closing_result), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Dashboard</h1>
        <p className="text-sm text-muted-foreground font-mono">{businessDate} • Read-Only</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Drop" value={formatCurrency(buyInDrop)} icon={Landmark} />
        <StatCard label="Cashout" value={formatCurrency(cashoutTotal)} icon={Receipt} />
        <StatCard label="Table Result" value={formatCurrency(tableResult)} icon={TrendingDown} />
        <StatCard label="Pending Exp." value={formatCurrency(pendingExpenses)} icon={Receipt} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Active guests */}
        <div className="cms-panel p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> In Casino ({visits.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {visits.length === 0 && <p className="text-xs text-muted-foreground">No active guests</p>}
            {visits.map((v: any) => (
              <div key={v.id} className="flex items-center gap-2 text-xs">
                {v.players?.photo_url ? (
                  <img src={v.players.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {v.players?.first_name?.[0]}{v.players?.last_name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground truncate block">
                    {v.players?.first_name} {v.players?.last_name}
                  </span>
                </div>
                <FlagBadges tags={v.players?.player_tags?.map((t: any) => t.tag) || []} />
                <span className="text-muted-foreground">{v.position}</span>
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(v.checked_in_at), { addSuffix: false })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tables */}
        <div className="cms-panel p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Table2 className="w-4 h-4 text-primary" /> Tables ({tables.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tables.filter(t => !t.is_archived).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${t.status === "open" ? "bg-green-500" : "bg-muted-foreground"}`} />
                  <span className="font-medium text-foreground">{t.name}</span>
                  <span className="text-muted-foreground">{t.game}</span>
                </div>
                {t.closing_result != null && (
                  <span className={`font-mono ${Number(t.closing_result) >= 0 ? "text-green-500" : "text-destructive"}`}>
                    {formatCurrency(Number(t.closing_result))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="cms-panel p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Recent Transactions</h3>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {transactions.slice(0, 20).map(tx => (
            <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
              <span className={`font-medium ${tx.type === "buy" ? "text-green-500" : "text-amber-500"}`}>
                {tx.type === "buy" ? "BUY-IN" : "CASHOUT"}
              </span>
              <span className="font-mono text-foreground">{formatCurrency(Number(tx.amount))}</span>
              <span className="text-muted-foreground">{format(new Date(tx.created_at), "HH:mm")}</span>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-xs text-muted-foreground">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
};

// ==================== IN CASINO SECTION ====================
const CctvInCasino = () => {
  const { activeCasino } = useCasino();
  const { data: allVisits = [] } = useVisitsToday("*, players(first_name, last_name, nickname, photo_url, status, category, player_tags(tag), id_number)") as { data: any[] };
  const visits = useMemo(() => allVisits.filter((v: any) => !v.checked_out_at), [allVisits]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — In Casino</h1>
      <div className="cms-panel">
        <div className="divide-y divide-border">
          {visits.length === 0 && <p className="p-4 text-sm text-muted-foreground">No active players</p>}
          {visits.map((v: any) => (
            <div key={v.id} className="flex items-center gap-3 p-3">
              {v.players?.photo_url ? (
                <img src={v.players.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                  {v.players?.first_name?.[0]}{v.players?.last_name?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm">
                    {v.players?.first_name} {v.players?.last_name}
                  </span>
                  {v.players?.nickname && <span className="text-xs text-muted-foreground">"{v.players.nickname}"</span>}
                  <CategoryBadge category={v.players?.category} />
                </div>
                <FlagBadges tags={v.players?.player_tags?.map((t: any) => t.tag) || []} />
              </div>
              <div className="text-right text-xs">
                <span className="text-muted-foreground">{v.position}</span>
                <p className="text-muted-foreground">{formatDistanceToNow(new Date(v.checked_in_at), { addSuffix: false })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== TABLES SECTION ====================
const CctvTables = () => {
  const { activeCasino } = useCasino();
  const { data: tables = [] } = useGamingTables();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Tables</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tables.filter(t => !t.is_archived).map(t => (
          <div key={t.id} className="cms-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground">{t.name}</h3>
              <Badge variant={t.status === "open" ? "default" : "secondary"}>{t.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.game}</p>
            <p className="text-xs text-muted-foreground">Float: {formatCurrency(Number(t.float_amount))}</p>
            {t.closing_result != null && (
              <p className={`text-sm font-mono mt-2 font-bold ${Number(t.closing_result) >= 0 ? "text-green-500" : "text-destructive"}`}>
                Result: {formatCurrency(Number(t.closing_result))}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== CAGE OVERVIEW ====================
const CctvCage = () => {
  const { activeCasino } = useCasino();
  const businessDate = getBusinessDate();
  const { data: shift } = useActiveShift();
  const { data: transactions = [] } = useTransactions(businessDate);
  const { data: expenses = [] } = useExpenses(businessDate);

  const buyIn = transactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0);
  const cashout = transactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0);
  const approvedExp = expenses.filter(e => e.approved).reduce((s, e) => s + Number(e.amount), 0);
  const pendingExp = expenses.filter(e => !e.approved).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Cage Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Buy-In" value={formatCurrency(buyIn)} icon={Landmark} />
        <StatCard label="Cashout" value={formatCurrency(cashout)} icon={Receipt} />
        <StatCard label="Approved Exp." value={formatCurrency(approvedExp)} icon={Receipt} />
        <StatCard label="Pending Exp." value={formatCurrency(pendingExp)} icon={Receipt} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="cms-panel p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Shift Info</h3>
          {shift ? (
            <div className="space-y-1 text-xs">
              <p>Status: <span className="font-medium text-foreground">{shift.status}</span></p>
              <p>Opened: <span className="text-foreground">{format(new Date(shift.opened_at), "HH:mm dd/MM")}</span></p>
              {shift.shift_result != null && (
                <p>Shift Result: <span className={`font-mono font-bold ${Number(shift.shift_result) >= 0 ? "text-green-500" : "text-destructive"}`}>
                  {formatCurrency(Number(shift.shift_result))}
                </span></p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active shift</p>
          )}
        </div>

        <div className="cms-panel p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Expenses</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {expenses.slice(0, 15).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                <span className="text-foreground truncate flex-1">{e.description || e.category}</span>
                <span className="font-mono text-foreground ml-2">{formatCurrency(Number(e.amount))}</span>
                <Badge variant={e.approved ? "default" : "secondary"} className="ml-2 text-[10px]">
                  {e.approved ? "✓" : "⏳"}
                </Badge>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-xs text-muted-foreground">No expenses</p>}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="cms-panel p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Transaction Log</h3>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {transactions.slice(0, 30).map(tx => (
            <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
              <span className={`font-medium w-16 ${tx.type === "buy" ? "text-green-500" : "text-amber-500"}`}>
                {tx.type === "buy" ? "BUY-IN" : "CASHOUT"}
              </span>
              <span className="font-mono text-foreground flex-1 text-right">{formatCurrency(Number(tx.amount))}</span>
              <span className="text-muted-foreground ml-3 w-12 text-right">{format(new Date(tx.created_at), "HH:mm")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==================== OBSERVATIONS (PIT BOOK) ====================
const CctvPitBook = () => {
  const { activeCasino, activeCasinoId } = useCasino();
  const businessDate = getBusinessDate();
  const { data: observations = [], isLoading } = useCctvObservations(activeCasinoId, businessDate);
  const createObs = useCreateObservation();
  const [content, setContent] = useState("");
  const [obsType, setObsType] = useState("general");

  const handleSubmit = async () => {
    if (!content.trim() || !activeCasinoId) return;
    try {
      await createObs.mutateAsync({
        casinoId: activeCasinoId,
        content: content.trim(),
        observationType: obsType,
      });
      setContent("");
      toast.success("Observation recorded");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Pit Book</h1>

      {/* New observation */}
      <div className="cms-panel p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Select value={obsType} onValueChange={setObsType}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="suspicious">Suspicious</SelectItem>
              <SelectItem value="incident">Incident</SelectItem>
              <SelectItem value="procedure">Procedure</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your observation..."
          rows={3}
        />
        <Button onClick={handleSubmit} disabled={!content.trim() || createObs.isPending} size="sm">
          <Send className="w-4 h-4 mr-2" /> Record
        </Button>
      </div>

      {/* Observations log */}
      <div className="cms-panel divide-y divide-border">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && observations.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No observations for today</p>
        )}
        {observations.map((obs: any) => (
          <div key={obs.id} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={
                obs.observation_type === "incident" ? "destructive" :
                obs.observation_type === "suspicious" ? "destructive" :
                "secondary"
              } className="text-[10px]">
                {obs.observation_type}
              </Badge>
              <span className="text-xs text-muted-foreground">{format(new Date(obs.created_at), "HH:mm")}</span>
            </div>
            <p className="text-sm text-foreground">{obs.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== PLAYERS SECTION ====================
const CctvPlayers = () => {
  const { activeCasino } = useCasino();
  const { user } = useAuth();
  const { data: players = [] } = usePlayers();
  const [search, setSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [taggingPlayer, setTaggingPlayer] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return players.slice(0, 50);
    const q = search.toLowerCase();
    return players.filter(p =>
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.nickname && p.nickname.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [players, search]);

  const addTag = async (playerId: string) => {
    if (!tagInput.trim() || !user) return;
    const { error } = await supabase.from("player_tags").insert({
      player_id: playerId,
      tag: tagInput.trim().toLowerCase(),
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Tag added");
    setTagInput("");
    setTaggingPlayer(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Players</h1>
      <Input placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      <div className="cms-panel divide-y divide-border">
        {filtered.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            {p.photo_url ? (
              <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                {p.first_name?.[0]}{p.last_name?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm">{p.first_name} {p.last_name}</span>
                <CategoryBadge category={p.category} />
              </div>
              <FlagBadges tags={p.player_tags?.map((t: any) => t.tag) || []} />
            </div>
            <div className="flex items-center gap-2">
              {taggingPlayer === p.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    placeholder="tag..."
                    className="h-7 w-24 text-xs"
                    onKeyDown={e => e.key === "Enter" && addTag(p.id)}
                  />
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => addTag(p.id)}>
                    <Tag className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1 text-muted-foreground" onClick={() => setTaggingPlayer(null)}>✕</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => setTaggingPlayer(p.id)}>
                  <Tag className="w-3 h-3 mr-1" /> Tag
                </Button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">No players found</p>}
      </div>
    </div>
  );
};

// ==================== BLACKLIST SECTION ====================
const CctvBlacklist = () => {
  const { activeCasino } = useCasino();
  const { data: players = [] } = usePlayers();
  const blacklisted = useMemo(() => players.filter(p => p.status === "blacklist"), [players]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-destructive" /> Blacklist
      </h1>
      <p className="text-sm text-muted-foreground">Global blacklist — applies to all casinos</p>
      <div className="cms-panel divide-y divide-border">
        {blacklisted.length === 0 && <p className="p-4 text-sm text-muted-foreground">No blacklisted players</p>}
        {blacklisted.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            {p.photo_url ? (
              <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center text-sm font-bold text-destructive">
                {p.first_name?.[0]}{p.last_name?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground text-sm">{p.first_name} {p.last_name}</span>
              {p.nickname && <span className="text-xs text-muted-foreground ml-2">"{p.nickname}"</span>}
              <FlagBadges tags={p.player_tags?.map((t: any) => t.tag) || []} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== ROTA / ATTENDANCE / BREAKLIST (placeholder read-only views) ====================
const CctvRota = () => {
  const { activeCasino } = useCasino();
  const businessDate = getBusinessDate();
  const { data: dealers = [] } = useDealers();
  const { data: rota = [] } = usePitRotaRange(businessDate, businessDate);

  const activeDealers = dealers.filter(d => d.is_active);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Rota</h1>
      <p className="text-sm text-muted-foreground font-mono">{businessDate}</p>
      <div className="cms-panel">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 text-muted-foreground">Dealer</th>
              <th className="text-center p-2 text-muted-foreground">Shift</th>
            </tr>
          </thead>
          <tbody>
            {activeDealers.map(d => {
              const shifts = rota.filter(r => r.dealer_id === d.id);
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="p-2 font-medium text-foreground">{d.name}</td>
                  <td className="p-2 text-center">
                    {shifts.length > 0
                      ? shifts.map(s => <Badge key={s.id} variant="secondary" className="text-[10px] mr-1">{s.shift}</Badge>)
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CctvAttendance = () => {
  const { activeCasino } = useCasino();
  const businessDate = getBusinessDate();
  const { data: dealers = [] } = useDealers();
  const { data: attendance = [] } = useDealerAttendanceRange(businessDate, businessDate);
  const activeDealers = dealers.filter(d => d.is_active);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Attendance</h1>
      <p className="text-sm text-muted-foreground font-mono">{businessDate}</p>
      <div className="cms-panel">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 text-muted-foreground">Dealer</th>
              <th className="text-center p-2 text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {activeDealers.map(d => {
              const att = attendance.find(a => a.dealer_id === d.id);
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="p-2 font-medium text-foreground">{d.name}</td>
                  <td className="p-2 text-center">
                    {att ? <Badge variant="secondary" className="text-[10px]">{att.value}</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CctvBreaklistView = () => {
  const { activeCasino } = useCasino();
  const businessDate = getBusinessDate();
  const { data: breaklist = [] } = useBreaklistData(businessDate);
  const { data: dealers = [] } = useDealers();
  const { data: tables = [] } = useGamingTables();

  const getDealerName = (id: string) => dealers.find(d => d.id === id)?.name || "?";
  const getTableName = (id: string | null) => id ? (tables.find(t => t.id === id)?.name || "?") : "—";

  // Group by time_slot
  const slots = useMemo(() => {
    const map = new Map<string, typeof breaklist>();
    breaklist.forEach(b => {
      const arr = map.get(b.time_slot) || [];
      arr.push(b);
      map.set(b.time_slot, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [breaklist]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{activeCasino?.name} — Breaklist</h1>
      <p className="text-sm text-muted-foreground font-mono">{businessDate}</p>
      {slots.length === 0 && <p className="cms-panel p-4 text-sm text-muted-foreground">No breaklist data</p>}
      {slots.map(([slot, entries]) => (
        <div key={slot} className="cms-panel p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">{slot}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {entries.map(e => (
              <div key={e.id} className="text-xs bg-accent/50 rounded p-2">
                <span className="font-medium text-foreground">{getDealerName(e.dealer_id)}</span>
                <span className="text-muted-foreground ml-1">→ {e.role === "BR" ? "Break" : getTableName(e.table_id)}</span>
                {e.is_locked && <span className="text-primary ml-1">🔒</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==================== STAT CARD (reusable) ====================
const StatCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
  <div className="cms-panel p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold font-mono mt-1 text-card-foreground">{value}</p>
      </div>
      <div className="p-2 rounded-md bg-primary/10 text-primary">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

// ==================== MAIN CCTV VIEW ====================
const CctvView = () => {
  const [section, setSection] = useState<CctvSection>("dashboard");

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <CctvDashboard />;
      case "guests": return <CctvGuests />;
      case "players": return <CctvPlayers />;
      case "blacklist": return <CctvBlacklist />;
      case "tables": return <CctvTables />;
      case "breaklist": return <CctvBreaklistView />;
      case "rota": return <CctvRota />;
      case "attendance": return <CctvAttendance />;
      case "cage": return <CctvCage />;
      case "observations": return <CctvPitBook />;
      default: return <CctvDashboard />;
    }
  };

  return (
    <CctvLayout activeSection={section} onSectionChange={setSection}>
      {renderSection()}
    </CctvLayout>
  );
};

export default CctvView;
