import { useMemo, useState } from "react";
import { Landmark, Receipt, TrendingDown, LayoutDashboard, Filter, ArrowUpDown, Smartphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardSkeleton, PlayerListSkeleton } from "@/components/LoadingSkeletons";
import { usePlayers, useTransactions, useGamingTables, useTableTracker } from "@/hooks/use-casino-data";
import { useCashless } from "@/hooks/use-cashless";
import { useChipSnapshots } from "@/hooks/use-chips";
import { useChipBaseline, baselineToMap } from "@/hooks/use-table-lifecycle";
import { liveTableResult, buildLatestTableSnapshot } from "@/lib/table-live-result";
import { useShiftTableAdjustments } from "@/hooks/use-shift-table-adjustments";
import { useAuth } from "@/lib/auth-context";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { canSeePlayerFinancials } from "@/lib/role-access";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { useTablesDropSplit } from "@/hooks/use-drop-split";
import {
  useStaffMembers, useStaffRotaRange,
  DEPARTMENT_LABELS, DEPARTMENT_ORDER,
  STAFF_SHIFT_LABELS, STAFF_SHIFT_COLORS,
  type StaffDepartment,
} from "@/hooks/use-staff";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CCTVDashboardSection } from "@/components/dashboard/CCTVDashboardSection";

const StatCard = ({ label, value, icon: Icon, href }: {
  label: string; value: string | number; icon: any; href: string;
}) => (
  <Link to={href} className="cms-panel p-5 hover:border-primary/30 transition-colors group block">
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wider truncate">{label}</p>
    </div>
    <div className="mt-3 overflow-x-auto scrollbar-hide">
      <p className="text-3xl font-bold font-mono whitespace-nowrap text-card-foreground">{value}</p>
    </div>
  </Link>
);

const ALL_SHIFTS = ["D", "M", "N", "G", "E", "L", "O"] as const;

const Dashboard = () => {
  const { displayName, roles, isManager, casinoId } = useAuth();
  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const businessDate = serverBusinessDate || getBusinessDate();
  const { data: players = [], isLoading: loadingPlayers } = usePlayers();
  const { data: transactions = [], isLoading: loadingTx } = useTransactions(businessDate);
  const { data: tables = [] } = useGamingTables();
  // (live-game expenses fetched separately via pending count query below)
  const { data: trackerData = [] } = useTableTracker(businessDate);
  const { data: snapshots = [] } = useChipSnapshots(businessDate);
  const { data: baseline = [] } = useChipBaseline();
  const { data: staffMembers = [] } = useStaffMembers();
  const { data: staffRota = [] } = useStaffRotaRange(businessDate, businessDate);

  // NEP-aware Drop R for the current business day window — same source of truth as Player Tracking.
  // Raw sum of buy/in transactions double-counts returned winnings; Drop R excludes recycled cash.
  const dropWindowStart = businessDayHourUTC(businessDate, 7);
  const dropWindowEnd = businessDayHourUTC(businessDate, 7 + 24);
  const { data: tablesDropSplit } = useTablesDropSplit(dropWindowStart, dropWindowEnd);

  const isInitialLoading = loadingPlayers && loadingTx;
  const showFinancials = canSeePlayerFinancials(roles);
  const totalDrop = useMemo(() => {
    if (!tablesDropSplit) return 0;
    let s = 0;
    tablesDropSplit.forEach(v => { s += v.dropR || 0; });
    return s;
  }, [tablesDropSplit]);
  // Pending expenses across BOTH cages (Live Game + Slots) — drives the
  // Approvals tile for manager / floor_manager / finance_manager / super_admin.
  const { data: pendingExpensesAll = 0 } = useQuery({
    queryKey: ["expenses-approvals-count", casinoId],
    queryFn: async () => {
      if (!casinoId) return 0;
      const { count, error } = await supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("casino_id", casinoId)
        .eq("approved", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 20,
  });
  const pendingExpenses = pendingExpensesAll;
  const canApproveExpenses =
    roles.includes("manager") ||
    roles.includes("floor_manager") ||
    roles.includes("finance_manager") ||
    roles.includes("super_admin");
  const { data: cashless = [] } = useCashless(businessDate);
  const pendingCashless = cashless.filter((r: any) => r.status === "pending").length;

  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);
  const snapshotIndex = useMemo(() => buildLatestTableSnapshot(snapshots as any), [snapshots]);
  const { adjustmentMap } = useShiftTableAdjustments();

  // Per-table tracker totals (raw drop indicator)
  const tableTrackerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    trackerData.forEach((d: any) => {
      totals[d.table_id] = (totals[d.table_id] || 0) + Number(d.value);
    });
    return totals;
  }, [trackerData]);

  // Table DROP = simple sum of all Cash In on the table for the current business day (no NEP logic).
  const tableStats = useMemo(() => {
    const stats: Record<string, { drop: number; result: number }> = {};
    tables.forEach(t => {
      const drop = transactions
        .filter(tx => tx.table_id === t.id && (tx.type === "buy" || tx.type === "in"))
        .reduce((s, tx) => s + Number(tx.amount), 0);
      const result = liveTableResult({
        tableId: t.id,
        closingResult: t.closing_result as any,
        snapshotIndex,
        baselineMap,
        adjustmentMap,
      });
      stats[t.id] = { drop, result };
    });
    return stats;
  }, [tables, transactions, snapshotIndex, baselineMap, adjustmentMap]);

  const gameTypeTotals = useMemo(() => {
    const totals: Record<string, { drop: number; result: number; label: string }> = {};
    const gameLabels: Record<string, string> = {
      "American Roulette": "TOTAL ARs",
      "Poker": "TOTAL POKER",
      "Texas Holdem": "TOTAL POKER",
      "Omaha": "TOTAL POKER",
      "PLO": "TOTAL POKER",
      "Club Poker": "TOTAL POKER",
      "Blackjack": "TOTAL BJ",
    };
    tables.forEach(t => {
      const label = gameLabels[t.game] || `Total ${t.game}`;
      if (!totals[label]) totals[label] = { drop: 0, result: 0, label };
      const r = tableStats[t.id] || { drop: 0, result: 0 };
      totals[label].drop += r.drop;
      totals[label].result += r.result;
    });
    return totals;
  }, [tables, tableStats]);

  const totalTablesDrop = Object.values(tableStats).reduce((s, r) => s + r.drop, 0);
  const totalResult = Object.values(tableStats).reduce((s, r) => s + r.result, 0);

  // Floor Staff filters & sort
  const [deptFilter, setDeptFilter] = useState<StaffDepartment[]>([]);
  const [shiftFilter, setShiftFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "department" | "shift">("department");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rotaMap = useMemo(() => {
    const m = new Map<string, string>();
    staffRota.forEach((r: any) => m.set(r.staff_id, r.shift));
    return m;
  }, [staffRota]);

  // Only staff actually on shift today: must have a rota entry that's not Off/Leave
  const OFF_SHIFTS = new Set(["O", "L"]);

  const floorStaff = useMemo(() => {
    const list = staffMembers
      .filter(s => s.is_active)
      .map(s => ({ ...s, shift: rotaMap.get(s.id) }))
      .filter(s => s.shift && !OFF_SHIFTS.has(s.shift))
      .filter(s => deptFilter.length === 0 || deptFilter.includes(s.department))
      .filter(s => shiftFilter.length === 0 || shiftFilter.includes(s.shift!));

    const dir = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
      if (sortBy === "shift") return (a.shift! ).localeCompare(b.shift!) * dir;
      const dA = DEPARTMENT_ORDER.indexOf(a.department);
      const dB = DEPARTMENT_ORDER.indexOf(b.department);
      if (dA !== dB) return (dA - dB) * dir;
      return a.name.localeCompare(b.name);
    });
  }, [staffMembers, rotaMap, deptFilter, shiftFilter, sortBy, sortDir]);

  const toggleSort = (col: "name" | "department" | "shift") => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const toggleDept = (d: StaffDepartment) =>
    setDeptFilter(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleShift = (s: string) =>
    setShiftFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  if (isInitialLoading) {
    return (
      <PageShell>
        <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Loading…" date />
        <CardSkeleton count={4} />
        <PlayerListSkeleton count={4} />
      </PageShell>
    );
  }

  const gameTypeCount = Object.keys(gameTypeTotals).length;

  return (
    <PageShell>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle={displayName ?? undefined}
        date
      />

      {(roles.includes("surveillance") || roles.includes("super_admin")) && (
        <CCTVDashboardSection />
      )}

      {(() => {
        const isSurveillance = roles.includes("surveillance") && !roles.includes("manager") && !roles.includes("super_admin");
        const gridCols = isSurveillance ? "sm:grid-cols-2 lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4";
        return (
          <div className={`grid grid-cols-1 ${gridCols} gap-4 mb-6`}>
            {showFinancials && <StatCard label="Total Drop" value={formatCurrency(totalDrop)} icon={Landmark} href="/cage" />}
            {showFinancials && (
              <Link to="/tables?tab=tracker" className="cms-panel p-5 hover:border-primary/30 transition-colors group block">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider truncate">Result</p>
                </div>
                <div className="mt-3 overflow-x-auto scrollbar-hide">
                  <p className={`text-3xl font-bold font-mono whitespace-nowrap ${totalResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                    {totalResult >= 0 ? "+" : ""}{formatCurrency(totalResult)}
                  </p>
                </div>
              </Link>
            )}
            {!isSurveillance && showFinancials && canApproveExpenses && (
              <StatCard label="Daily Expenses" value={pendingExpenses} icon={Receipt} href="/expenses/daily" />
            )}
            {!isSurveillance && showFinancials && (
              <StatCard label="Pending Cashless" value={pendingCashless} icon={Smartphone} href="/cashless" />
            )}
          </div>
        );
      })()}

      {/* Tables Totals — mirrors Tables page */}
      {showFinancials && gameTypeCount > 0 && (
        <div className="mb-6">
          
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gameTypeCount + 1}, minmax(0, 1fr))` }}>
            {Object.entries(gameTypeTotals).map(([game, t]) => (
              <Link to="/tables" key={game} className="cms-panel p-4 hover:border-primary/30 transition-colors">
                <p className="text-xs uppercase text-muted-foreground tracking-wider">{t.label}</p>
                <p className={`font-mono text-2xl font-bold mt-1 whitespace-nowrap ${t.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                  {t.result >= 0 ? "+" : ""}{formatCurrency(t.result)}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">​</p>
              </Link>
            ))}
            <Link to="/tables" className="cms-panel p-4 border-primary/30 hover:border-primary/60 transition-colors">
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Total Casino</p>
              <p className={`font-mono text-2xl font-bold mt-1 whitespace-nowrap ${totalResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {totalResult >= 0 ? "+" : ""}{formatCurrency(totalResult)}
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-1">​</p>
            </Link>
          </div>
        </div>
      )}

      {/* Floor Staff on Shift — full width, fills remaining height */}
      <div className="cms-panel flex flex-col" style={{ minHeight: "60vh" }}>
        <div className="cms-header flex items-center justify-between gap-2 flex-wrap">
          <span>Floor Staff on Shift</span>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Department{deptFilter.length > 0 ? ` (${deptFilter.length})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="end">
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {DEPARTMENT_ORDER.map(d => (
                    <label key={d} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={deptFilter.includes(d)} onCheckedChange={() => toggleDept(d)} />
                      <span>{DEPARTMENT_LABELS[d]}</span>
                    </label>
                  ))}
                </div>
                {deptFilter.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1 h-7" onClick={() => setDeptFilter([])}>Clear</Button>
                )}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Shift{shiftFilter.length > 0 ? ` (${shiftFilter.length})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="end">
                <div className="space-y-1">
                  {ALL_SHIFTS.map(s => (
                    <label key={s} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={shiftFilter.includes(s)} onCheckedChange={() => toggleShift(s)} />
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${STAFF_SHIFT_COLORS[s] || "bg-muted text-muted-foreground"}`}>{s}</span>
                      <span className="text-xs text-muted-foreground">{STAFF_SHIFT_LABELS[s] || s}</span>
                    </label>
                  ))}
                </div>
                {shiftFilter.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1 h-7" onClick={() => setShiftFilter([])}>Clear</Button>
                )}
              </PopoverContent>
            </Popover>

            <span className="text-xs font-mono text-muted-foreground">{floorStaff.length} staff</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {floorStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No staff on shift</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Name <ArrowUpDown className="w-3 h-3" />
                      {sortBy === "name" && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort("department")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Department <ArrowUpDown className="w-3 h-3" />
                      {sortBy === "department" && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <button onClick={() => toggleSort("shift")} className="inline-flex items-center gap-1 hover:text-foreground ml-auto">
                      Shift <ArrowUpDown className="w-3 h-3" />
                      {sortBy === "shift" && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {floorStaff.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-1.5 text-card-foreground font-medium">{s.name}</td>
                    <td className="px-4 py-1.5 text-muted-foreground text-xs">{DEPARTMENT_LABELS[s.department]}</td>
                    <td className="px-4 py-1.5 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${STAFF_SHIFT_COLORS[s.shift!] || "bg-muted text-muted-foreground"}`}>
                        {STAFF_SHIFT_LABELS[s.shift!] || s.shift}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default Dashboard;
