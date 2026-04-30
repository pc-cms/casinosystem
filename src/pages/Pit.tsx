import React, { useState, useMemo, useCallback, useRef, Suspense } from "react";
import { CardSkeleton, TableSkeleton } from "@/components/LoadingSkeletons";
import { useSearchParams } from "react-router-dom";
import { useDealers, useCreateDealer, useUpdateDealer, useDeleteDealer, usePitRotaRange, useSetPitRota, useDeletePitRota, useSetDealerAttendance, useDealerAttendanceRange } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, UserPlus, ArrowUpDown, ZoomIn, ZoomOut, RefreshCw, Check, Printer, Trash2, Users as UsersIcon, Lock } from "lucide-react";
import EmployeePhotoCell from "@/components/EmployeePhotoCell";
import BreaklistGrid from "@/components/pit/BreaklistGrid";
import ActivePlayers from "@/components/pit/ActivePlayers";
import ClientTracker from "@/components/pit/PlayerTracker";
import TableTracker from "@/pages/TableTracker";
import { getBusinessDate, isBusinessToday } from "@/lib/business-day";
import { UNIFIED_SHIFT_COLORS, UNIFIED_ATT_COLORS, UNIFIED_SHIFT_TINTS } from "@/lib/shift-colors";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PitShell } from "@/components/pit/PitShell";

const ROTA_SHIFTS = ["M", "N", "L", "E"] as const;

const SHIFT_COLORS = UNIFIED_SHIFT_COLORS;

const SHIFT_LABELS: Record<string, string> = {
  M: "Middle (17:45)",
  N: "Night (20:45)",
  L: "Leave",
  E: "Extra",
};

const ATT_COLORS = UNIFIED_ATT_COLORS;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type DealerCategory = "trainee" | "dealer" | "inspector" | "expert" | "pit_boss";

const CATEGORY_LABELS: Record<DealerCategory, string> = {
  trainee: "Trainee",
  dealer: "Dealer",
  inspector: "Inspector",
  expert: "Expert",
  pit_boss: "Pit Boss",
};

const CATEGORY_LETTER: Record<string, string> = {
  trainee: "T",
  dealer: "D",
  inspector: "I",
  expert: "E",
  pit_boss: "PB",
};

const CATEGORY_COLORS: Record<string, string> = {
  trainee: "text-cyan-700 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-500/20",
  dealer: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20",
  inspector: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/20",
  expert: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20",
  pit_boss: "text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20",
};

const Pit = () => {
  const businessToday = getBusinessDate();
  const [date, setDate] = useState(businessToday);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const navigateMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }, [month]);

  const { roles, isManager } = useAuth();
  const isHR = roles.includes("hr") && !roles.includes("pit") && !roles.includes("manager");
  const [searchParams] = useSearchParams();
  // Default tabs: HR sees Employee first; Pit/Manager land on Attendance (Live Game shell)
  const activeTab = searchParams.get("tab") || (isHR ? "employee" : "breaklist");

  const showMonthNav = activeTab === "rota" || activeTab === "attendance";
  const showDatePicker = activeTab === "breaklist";

  const TAB_TITLES: Record<string, string> = {
    employee: "Live Game Staff",
    rota: "Live Game Rota",
    attendance: "Live Game Attendance",
    breaklist: "Breaklist",
    activeplayers: "Active Players",
    tracker: "Player Tracker",
    tabletracker: "Table Tracker",
  };

  // Breaklist zoom + action callbacks
  const [breaklistZoom, setBreaklistZoom] = useState(100);
  const breaklistRefreshRef = React.useRef<(() => void) | null>(null);
  const breaklistAcceptRef = React.useRef<(() => void) | null>(null);

  // Center slot: date / month nav (in subtitle area via belowHeader)
  const centerControl = showMonthNav ? (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-sm font-semibold text-card-foreground min-w-[140px] text-center">{monthLabel}</span>
      <Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(1)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  ) : showDatePicker ? (
    isManager ? (
      <Input
        type="date"
        value={date}
        max={businessToday}
        onChange={e => setDate(e.target.value || businessToday)}
        className="w-44 font-mono h-9"
      />
    ) : (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold text-card-foreground">
          {date.replace(/-/g, ".")}
        </span>
        {date !== businessToday && (
          <button
            type="button"
            onClick={() => setDate(businessToday)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-[10px] font-mono text-muted-foreground hover:bg-muted"
            title="Return to today"
          >
            <Lock className="h-3 w-3" /> Today
          </button>
        )}
      </div>
    )
  ) : null;

  // Right slot: action buttons / legend
  const rightControls = (
    <>
      {activeTab === "breaklist" && (
        <>
          <Button variant="outline" size="icon-xs" onClick={() => setBreaklistZoom(z => Math.max(60, z - 10))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">{breaklistZoom}%</span>
          <Button variant="outline" size="icon-xs" onClick={() => setBreaklistZoom(z => Math.min(200, z + 10))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          {isBusinessToday(date) && (
            <>
              <Button variant="outline" size="sm" onClick={() => breaklistRefreshRef.current?.()} className="gap-1 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => breaklistAcceptRef.current?.()} className="gap-1 text-xs">
                <Check className="w-3.5 h-3.5" /> Accept
              </Button>
            </>
          )}
        </>
      )}
      {activeTab === "rota" && (
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { const html = document.documentElement; const wasDark = html.classList.contains('dark'); if (wasDark) html.classList.remove('dark'); window.print(); if (wasDark) html.classList.add('dark'); }}>
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
      )}
      {activeTab === "attendance" && (
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { const html = document.documentElement; const wasDark = html.classList.contains('dark'); if (wasDark) html.classList.remove('dark'); window.print(); if (wasDark) html.classList.add('dark'); }}>
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
      )}
    </>
  );

  // Below header: legend rows for rota / attendance
  const belowHeader = activeTab === "rota" ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ROTA_SHIFTS.map(s => (
        <span key={s} className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${SHIFT_COLORS[s]}`}>{s} = {SHIFT_LABELS[s]}</span>
      ))}
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${SHIFT_COLORS["O"]}`}>O = Off</span>
    </div>
  ) : activeTab === "attendance" ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${ATT_COLORS["A"]}`}>A = Absent</span>
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${ATT_COLORS["S"]}`}>S = Sick</span>
    </div>
  ) : (activeTab !== "breaklist" && centerControl) ? (
    <div className="flex items-center">{centerControl}</div>
  ) : undefined;

  const isBreaklist = activeTab === "breaklist";

  return (
    <PitShell>
    <PageShell>
      <div className="no-print">
        <PageHeader
          icon={UsersIcon}
          title={TAB_TITLES[activeTab] || "Live Game"}
          subtitle="Live Game Management"
          centerSlot={isBreaklist ? centerControl : undefined}
          date={isBreaklist ? undefined : undefined}
          belowHeader={belowHeader}
        >
          {rightControls}
        </PageHeader>
      </div>

      <Suspense fallback={<><CardSkeleton count={2} /><TableSkeleton rows={5} cols={4} /></>}>
        {activeTab === "employee" && <DealerEmployeeList />}
        {activeTab === "rota" && <RotaGrid month={month} />}
        {activeTab === "attendance" && <AttendanceGrid month={month} />}
        {activeTab === "breaklist" && (
          <BreaklistGrid
            date={date}
            zoom={breaklistZoom}
            onRegisterRefresh={(fn) => { breaklistRefreshRef.current = fn; }}
            onRegisterAccept={(fn) => { breaklistAcceptRef.current = fn; }}
          />
        )}
        {activeTab === "activeplayers" && <ActivePlayers />}
        {activeTab === "tracker" && <ClientTracker />}
        {activeTab === "tabletracker" && <TableTracker />}
      </Suspense>
    </PageShell>
    </PitShell>
  );
};

// =================== EMPLOYEE LIST (TABLE FORMAT) ===================
const getDaysLeft = (contractEnd: string | null): number | null => {
  if (!contractEnd) return null;
  const end = new Date(contractEnd);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const DEALER_CATEGORIES: DealerCategory[] = ["trainee", "dealer", "inspector", "expert", "pit_boss"];

const DealerEmployeeList = () => {
  const { isManager, roles } = useAuth();
  const canManage = isManager || roles.includes("hr");
  const { data: dealers = [] } = useDealers();
  const createDealer = useCreateDealer();
  const updateDealer = useUpdateDealer();
  const deleteDealer = useDeleteDealer();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DealerCategory>("dealer");
  const [sortBy, setSortBy] = useState<string>("category");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const canSeePhoto = roles.some(r => ["manager", "surveillance", "hr", "super_admin", "finance_manager"].includes(r));
  const sorted = useMemo(() => {
    let list = [...dealers] as any[];
    if (filterCat !== "all") {
      if (filterCat === "pit_boss") list = list.filter(d => d.is_pit_boss);
      else list = list.filter(d => d.category === filterCat && !d.is_pit_boss);
    }
    if (filterStatus === "active") list = list.filter(d => d.is_active);
    else if (filterStatus === "fired") list = list.filter(d => !d.is_active);

    list.sort((a, b) => {
      const getCat = (d: any) => d.is_pit_boss ? "pit_boss" : d.category;
      switch (sortBy) {
        case "category": {
          const iA = DEALER_CATEGORIES.indexOf(getCat(a));
          const iB = DEALER_CATEGORIES.indexOf(getCat(b));
          return iA !== iB ? iA - iB : a.name.localeCompare(b.name);
        }
        case "name": return a.name.localeCompare(b.name);
        case "salary": return (b.salary || 0) - (a.salary || 0);
        case "onboarding": return (a.onboarding_date || "9999").localeCompare(b.onboarding_date || "9999");
        case "contract_end": return (a.contract_end || "9999").localeCompare(b.contract_end || "9999");
        case "days_left": {
          const daysA = getDaysLeft(a.contract_end);
          const daysB = getDaysLeft(b.contract_end);
          return (daysA ?? 99999) - (daysB ?? 99999);
        }
        default: return 0;
      }
    });
    return list;
  }, [dealers, sortBy, filterCat, filterStatus]);

  const handleAdd = () => {
    if (!name) return;
    if (!canManage) { toast.error("Manager or HR access required"); return; }
    const isPitBoss = category === "pit_boss";
    createDealer.mutate({ name, category: isPitBoss ? "dealer" : category, is_pit_boss: isPitBoss });
    setName("");
  };

  const calcYears = (startDate: string | null) => {
    if (!startDate) return "—";
    const start = new Date(startDate);
    const now = new Date();
    const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years < 1) return `${Math.floor(years * 12)}m`;
    return `${Math.floor(years)}y ${Math.floor((years % 1) * 12)}m`;
  };

  const formatSalary = (s: number | null) => {
    if (!s) return "—";
    return s.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const startEdit = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    if (field === "name") {
      if (editValue.trim()) updateDealer.mutate({ id, name: editValue.trim() });
    } else if (field === "salary") {
      const num = parseInt(editValue.replace(/\s/g, ""), 10);
      updateDealer.mutate({ id, salary: isNaN(num) ? null : num });
    } else if (field === "contract_start" || field === "contract_end" || field === "onboarding_date") {
      updateDealer.mutate({ id, [field]: editValue || null });
    }
    setEditingCell(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditingCell(null);
  };

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2 cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => setSortBy(field)}>
      <span className="inline-flex items-center gap-1">{label} {sortBy === field && <ArrowUpDown className="w-3 h-3" />}</span>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {DEALER_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="fired">Fired</SelectItem>
          </SelectContent>
        </Select>
        <div className="w-px h-6 bg-border mx-1" />
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-[200px]" disabled={!canManage}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
        />
        <Select value={category} onValueChange={v => setCategory(v as DealerCategory)} disabled={!canManage}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEALER_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={!name || !canManage}>
          <UserPlus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {canSeePhoto && <th className="text-left text-xs font-medium text-muted-foreground uppercase px-2 py-2 w-10">📷</th>}
              <SortHeader field="category" label="Cat" />
              <SortHeader field="name" label="Name" />
              <SortHeader field="salary" label="Salary" />
              <SortHeader field="onboarding" label="Onboarding" />
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Contract Start</th>
              <SortHeader field="contract_end" label="Contract End" />
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Years</th>
              <SortHeader field="days_left" label="Days Left" />
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Status</th>
              {canManage && <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 w-10">Del</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d: any) => {
              const catKey = d.is_pit_boss ? "pit_boss" : d.category;
              const daysLeft = getDaysLeft(d.contract_end);
              return (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  {canSeePhoto && (
                    <EmployeePhotoCell
                      id={d.id}
                      name={d.name}
                      photoUrl={d.photo_url}
                      onUpdate={(id, url) => updateDealer.mutate({ id, photo_url: url })}
                      canManage={canManage}
                    />
                  )}
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded px-1 text-[10px] font-mono font-bold ${CATEGORY_COLORS[catKey] || "text-muted-foreground bg-muted/20"}`}>
                      {CATEGORY_LETTER[catKey] || "?"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-card-foreground font-medium cursor-pointer hover:bg-muted/30"
                    onClick={() => canManage && startEdit(d.id, "name", d.name)}>
                    {editingCell?.id === d.id && editingCell.field === "name" ? (
                      <Input className="h-7 w-40 text-sm" value={editValue} autoFocus
                        onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : d.name}
                  </td>
                  <td className="px-4 py-2 text-sm text-card-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(d.id, "salary", d.salary?.toString() || "")}>
                    {editingCell?.id === d.id && editingCell.field === "salary" ? (
                      <Input className="h-7 w-24 font-mono text-sm" value={editValue} autoFocus
                        onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : formatSalary(d.salary)}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(d.id, "onboarding_date", d.onboarding_date || "")}>
                    {editingCell?.id === d.id && editingCell.field === "onboarding_date" ? (
                      <input type="date" className="h-7 bg-background border border-border rounded px-2 text-sm font-mono text-foreground"
                        value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : d.onboarding_date || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(d.id, "contract_start", d.contract_start || "")}>
                    {editingCell?.id === d.id && editingCell.field === "contract_start" ? (
                      <input type="date" className="h-7 bg-background border border-border rounded px-2 text-sm font-mono text-foreground"
                        value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : d.contract_start || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(d.id, "contract_end", d.contract_end || "")}>
                    {editingCell?.id === d.id && editingCell.field === "contract_end" ? (
                      <input type="date" className="h-7 bg-background border border-border rounded px-2 text-sm font-mono text-foreground"
                        value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : d.contract_end || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono">{calcYears(d.onboarding_date)}</td>
                  <td className="px-4 py-2">
                    <span className={`font-mono text-xs font-bold ${daysLeft === null ? "text-muted-foreground" : daysLeft <= 40 ? "text-red-600 dark:text-red-400" : daysLeft <= 90 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {daysLeft === null ? "—" : `${daysLeft}d`}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => {
                      if (!canManage) { toast.error("Manager or HR access required"); return; }
                      updateDealer.mutate({ id: d.id, is_active: !d.is_active });
                    }}
                      className={`text-xs font-medium cursor-pointer hover:underline ${d.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {d.is_active ? "Active" : "Fired"}
                    </button>
                  </td>
                  {canManage && (
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => {
                          if (!window.confirm(`Permanently delete "${d.name}"? This cannot be undone. Use only to remove mistakenly entered names.`)) return;
                          deleteDealer.mutate(d.id, {
                            onSuccess: () => toast.success("Employee deleted"),
                            onError: (e: any) => toast.error(e?.message || "Delete failed"),
                          });
                        }}
                        title="Delete employee permanently"
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =================== MONTHLY ROTA GRID ===================
const RotaGrid = ({ month }: { month: string }) => {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: dealers = [] } = useDealers();
  const { data: rota = [] } = usePitRotaRange(startDate, endDate);
  const { data: monthAttendance = [] } = useDealerAttendanceRange(startDate, endDate);
  const setRota = useSetPitRota();
  const deleteRota = useDeletePitRota();

  const activeDealers = dealers.filter((d: any) => d.is_active && !d.is_pit_boss);
  const pitBosses = dealers.filter((d: any) => d.is_active && d.is_pit_boss);

  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

  const getRotaEntry = (dealerId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    return rota.find(r => r.dealer_id === dealerId && r.date === dateStr);
  };

  const getAttendanceEntry = (dealerId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    return monthAttendance.find((a: any) => a.dealer_id === dealerId && a.date === dateStr);
  };

  const getDisplayShift = (dealerId: string, day: number): { shift: string; isAuto: boolean } | null => {
    const rotaEntry = getRotaEntry(dealerId, day);
    if (rotaEntry) return { shift: rotaEntry.shift, isAuto: false };
    const att = getAttendanceEntry(dealerId, day);
    if (att) {
      const val = String((att as any).value);
      const num = Number(val);
      if (!isNaN(num) && num > 0) return { shift: "E", isAuto: true };
    }
    return null;
  };

  const handleClick = (dealerId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const current = getRotaEntry(dealerId, day);
    if (!current) {
      setRota.mutate({ dealer_id: dealerId, date: dateStr, shift: "M" });
    } else {
      const idx = ROTA_SHIFTS.indexOf(current.shift as typeof ROTA_SHIFTS[number]);
      if (idx >= 0 && idx < ROTA_SHIFTS.length - 1) {
        setRota.mutate({ dealer_id: dealerId, date: dateStr, shift: ROTA_SHIFTS[idx + 1] });
      } else {
        deleteRota.mutate({ dealer_id: dealerId, date: dateStr });
      }
    }
  };

  const focusNextCell = (current: HTMLElement) => {
    const td = current.closest("td");
    const nextTd = td?.nextElementSibling;
    const nextBtn = nextTd?.querySelector("button") as HTMLElement;
    if (nextBtn) { nextBtn.focus(); return; }
    const tr = td?.closest("tr");
    const nextRow = tr?.nextElementSibling;
    const firstBtn = nextRow?.querySelector("td:nth-child(3) button") as HTMLElement;
    firstBtn?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, dealerId: string, day: number) => {
    const key = e.key.toUpperCase();
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    if (ROTA_SHIFTS.includes(key as typeof ROTA_SHIFTS[number])) {
      e.preventDefault();
      setRota.mutate({ dealer_id: dealerId, date: dateStr, shift: key as typeof ROTA_SHIFTS[number] });
      focusNextCell(e.target as HTMLElement);
    } else if (key === " " || e.code === "Space") {
      e.preventDefault();
      focusNextCell(e.target as HTMLElement);
    } else if (key === "BACKSPACE" || key === "DELETE") {
      e.preventDefault();
      deleteRota.mutate({ dealer_id: dealerId, date: dateStr });
    } else if (key === "ARROWRIGHT" || key === "TAB") {
      e.preventDefault();
      focusNextCell(e.target as HTMLElement);
    } else if (key === "ARROWLEFT") {
      e.preventDefault();
      const prev = (e.target as HTMLElement)?.closest("td")?.previousElementSibling?.querySelector("button") as HTMLElement;
      prev?.focus();
    } else if (key === "ARROWDOWN") {
      e.preventDefault();
      const td = (e.target as HTMLElement).closest("td");
      const idx2 = td ? Array.from(td.parentElement!.children).indexOf(td) : -1;
      const nextRow = td?.closest("tr")?.nextElementSibling;
      (nextRow?.children[idx2]?.querySelector("button") as HTMLElement)?.focus();
    } else if (key === "ARROWUP") {
      e.preventDefault();
      const td = (e.target as HTMLElement).closest("td");
      const idx2 = td ? Array.from(td.parentElement!.children).indexOf(td) : -1;
      const prevRow = td?.closest("tr")?.previousElementSibling;
      (prevRow?.children[idx2]?.querySelector("button") as HTMLElement)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent, dealerId: string, day: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").trim().toUpperCase();
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const values = text.split(/[\s,]+/);
    if (values.length === 1 && ROTA_SHIFTS.includes(values[0] as typeof ROTA_SHIFTS[number])) {
      setRota.mutate({ dealer_id: dealerId, date: dateStr, shift: values[0] as typeof ROTA_SHIFTS[number] });
    } else if (values.length > 1) {
      values.forEach((v, i) => {
        const d = day + i;
        if (d <= daysInMonth && ROTA_SHIFTS.includes(v as typeof ROTA_SHIFTS[number])) {
          const ds = `${month}-${String(d).padStart(2, "0")}`;
          setRota.mutate({ dealer_id: dealerId, date: ds, shift: v as typeof ROTA_SHIFTS[number] });
        }
      });
    }
  };

  const getDealerStats = (dealerId: string) => {
    const counts: Record<string, number> = {};
    days.forEach(day => {
      const display = getDisplayShift(dealerId, day);
      if (display) counts[display.shift] = (counts[display.shift] || 0) + 1;
    });
    return counts;
  };

  const renderDealerRows = (dealerList: any[], label: string, accentColor: string, extraRowClass = "") => (
    <>
      <tr className={extraRowClass}>
        <td colSpan={days.length + 5} className="px-0 py-0 sticky left-0">
          <div className={`flex items-center gap-2 px-3 py-1 border-b-2 ${accentColor}`}>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</span>
            <span className="text-[10px] font-mono text-muted-foreground">({dealerList.length})</span>
          </div>
        </td>
      </tr>
      {dealerList.map((dealer: any, idx: number) => {
        const stats = getDealerStats(dealer.id);
        return (
          <tr key={dealer.id} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"} ${extraRowClass}`}>
            <td className={`px-1 py-1 text-center sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-mono font-bold ${CATEGORY_COLORS[dealer.category] || "text-muted-foreground bg-muted/20"}`}>
                {CATEGORY_LETTER[dealer.category] || "?"}
              </span>
            </td>
            <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-[28px] z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
              {dealer.name}
            </td>
            {days.map(day => {
              const display = getDisplayShift(dealer.id, day);
              const isToday = isCurrentMonth && day === todayDay;
              const dateObj = new Date(y, m - 1, day);
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              return (
                <td key={day} className={`px-0.5 py-0.5 text-center ${isToday ? "bg-primary/25" : isWeekend ? "bg-muted/15" : ""}`}>
                  <button
                    onClick={() => handleClick(dealer.id, day)}
                    onKeyDown={e => handleKeyDown(e, dealer.id, day)}
                    onPaste={e => handlePaste(e, dealer.id, day)}
                    className={`w-full h-7 rounded text-[10px] font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                      display
                        ? `${SHIFT_COLORS[display.shift] || "bg-muted text-muted-foreground"} ${display.isAuto ? "border border-dashed border-emerald-500/50" : ""}`
                        : "bg-transparent hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground"
                    }`}
                  >
                    {display?.shift || "·"}
                  </button>
                </td>
              );
            })}
            <td className="px-2 py-1 text-center"><span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">{stats["M"] || ""}</span></td>
            <td className="px-2 py-1 text-center"><span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">{stats["N"] || ""}</span></td>
            <td className="px-2 py-1 text-center"><span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{stats["E"] || ""}</span></td>
          </tr>
        );
      })}
    </>
  );

  return (
    <>
      <div className="print-title hidden">{`Live Game Rota — ${month}`}</div>
      <div className="cms-panel overflow-hidden print-target">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center text-xs font-medium text-muted-foreground uppercase px-0.5 py-2 sticky left-0 bg-card z-10 w-7">C</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase px-1 py-2 sticky left-[28px] bg-card z-10 w-[100px]">Name</th>
            {days.map(day => {
              const dateObj = new Date(y, m - 1, day);
              const weekday = WEEKDAYS[dateObj.getDay()];
              const isToday = isCurrentMonth && day === todayDay;
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              return (
                <th key={day} className={`text-center px-0 py-1 ${isToday ? "bg-primary/40" : isWeekend ? "bg-muted/30" : ""}`}>
                  <div className="text-[8px] text-muted-foreground leading-tight">{weekday}</div>
                  <div className={`text-[10px] font-mono leading-tight ${isToday ? "text-primary font-bold" : "text-card-foreground"}`}>{day}</div>
                </th>
              );
            })}
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">M</th>
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">N</th>
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">E</th>
          </tr>
        </thead>
        <tbody>
          {renderDealerRows(activeDealers, "Dealers", "border-blue-400 dark:border-blue-500/50 text-blue-600 dark:text-blue-400")}
          {/* Summary: M/N/E count per day — dealers only */}
          <tr className="border-t-2 border-border">
            <td colSpan={2} className="px-1 py-1 text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400 sticky left-0 left-[28px] bg-card z-10">Σ M</td>
            {days.map(day => {
              const count = activeDealers.filter(d => getDisplayShift(d.id, day)?.shift === "M").length;
              return <td key={day} className="text-center text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400">{count || ""}</td>;
            })}
            <td colSpan={3} />
          </tr>
          <tr>
            <td colSpan={2} className="px-1 py-1 text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 sticky left-0 left-[28px] bg-card z-10">Σ N</td>
            {days.map(day => {
              const count = activeDealers.filter(d => getDisplayShift(d.id, day)?.shift === "N").length;
              return <td key={day} className="text-center text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400">{count || ""}</td>;
            })}
            <td colSpan={3} />
          </tr>
          <tr>
            <td colSpan={2} className="px-1 py-1 text-[9px] font-mono font-bold text-card-foreground sticky left-0 left-[28px] bg-card z-10">Σ All</td>
            {days.map(day => {
              const count = activeDealers.filter(d => {
                const s = getDisplayShift(d.id, day)?.shift;
                return s === "M" || s === "N" || s === "E";
              }).length;
              return <td key={day} className="text-center text-[9px] font-mono font-bold text-card-foreground">{count || ""}</td>;
            })}
            <td colSpan={3} />
          </tr>
          {pitBosses.length > 0 && renderDealerRows(pitBosses, "Pit Bosses", "border-purple-400 dark:border-purple-500/50 text-purple-600 dark:text-purple-400", "no-print")}
        </tbody>
      </table>
    </div>
    </>
  );
};

// =================== DAILY ATTENDANCE ===================
const AttendanceGrid = ({ month }: { month: string }) => {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: dealers = [] } = useDealers();
  const { data: monthAttendance = [] } = useDealerAttendanceRange(startDate, endDate);
  const { data: rota = [] } = usePitRotaRange(startDate, endDate);
  const setAttendance = useSetDealerAttendance();

  const activeDealers = dealers.filter((d: any) => d.is_active && !d.is_pit_boss);
  const pitBosses = dealers.filter((d: any) => d.is_active && d.is_pit_boss);

  const getRotaShift = (dealerId: string, day: number): string | null => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const entry = rota.find((r: any) => r.dealer_id === dealerId && r.date === dateStr);
    if (!entry) return null;
    const s = entry.shift as string;
    return (s === "M" || s === "N" || s === "E") ? s : null;
  };

  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

  const getValue = (dealerId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const entry = monthAttendance.find((a: any) => a.dealer_id === dealerId && a.date === dateStr);
    return entry ? String((entry as any).value) : "";
  };

  const handleSave = (dealerId: string, day: number, val: string) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === "") { setAttendance.mutate({ dealer_id: dealerId, date: dateStr, value: "" }); return; }
    if (trimmed === "A" || trimmed === "S") { setAttendance.mutate({ dealer_id: dealerId, date: dateStr, value: trimmed }); return; }
    const num = Number(trimmed);
    if (!isNaN(num) && num >= 0 && num <= 24) { setAttendance.mutate({ dealer_id: dealerId, date: dateStr, value: String(num) }); }
  };

  const getDealerTotal = (dealerId: string) => {
    return days.reduce((sum, day) => {
      const val = getValue(dealerId, day);
      const num = Number(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  };

  const renderAttendanceRows = (dealerList: any[], label: string, accentColor: string) => (
    <>
      <tr>
        <td colSpan={days.length + 3} className="px-0 py-0 sticky left-0">
          <div className={`flex items-center gap-2 px-3 py-1 border-b-2 ${accentColor}`}>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</span>
            <span className="text-[10px] font-mono text-muted-foreground">({dealerList.length})</span>
          </div>
        </td>
      </tr>
      {dealerList.map((dealer: any, idx: number) => {
        const total = getDealerTotal(dealer.id);
        return (
          <tr key={dealer.id} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
            <td className={`px-1 py-1 text-center sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-mono font-bold ${CATEGORY_COLORS[dealer.category] || "text-muted-foreground bg-muted/20"}`}>
                {CATEGORY_LETTER[dealer.category] || "?"}
              </span>
            </td>
            <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-[28px] z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
              {dealer.name}
            </td>
            {days.map(day => {
              const val = getValue(dealer.id, day);
              const isToday = isCurrentMonth && day === todayDay;
              const dateObj = new Date(y, m - 1, day);
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              const isStatus = val === "A" || val === "S";
              const isHours = val !== "" && !isStatus;
              const rotaShift = getRotaShift(dealer.id, day);
              const isScheduled = !!rotaShift;
              const isEmpty = val === "";
              return (
                <td key={day} className={`px-0.5 py-0.5 text-center ${isToday ? "bg-primary/25" : isWeekend ? "bg-muted/15" : ""}`}>
                  <input
                    type="text"
                    defaultValue={val}
                    key={`${dealer.id}-${month}-${day}-${val}`}
                    onBlur={e => handleSave(dealer.id, day, e.target.value)}
                    onKeyDown={e => {
                      const input = e.target as HTMLInputElement;
                      if (e.key === "Enter") { input.blur(); return; }
                      const key = e.key.toUpperCase();
                      if (key === "A" || key === "S") {
                        e.preventDefault();
                        handleSave(dealer.id, day, key);
                        const nextInput = input.closest("td")?.nextElementSibling?.querySelector("input") as HTMLInputElement;
                        nextInput?.focus();
                      } else if (key === "ARROWRIGHT") {
                        e.preventDefault();
                        (input.closest("td")?.nextElementSibling?.querySelector("input") as HTMLInputElement)?.focus();
                      } else if (key === "ARROWLEFT") {
                        e.preventDefault();
                        (input.closest("td")?.previousElementSibling?.querySelector("input") as HTMLInputElement)?.focus();
                      } else if (key === "ARROWDOWN") {
                        e.preventDefault();
                        const td = input.closest("td");
                        const ci = td ? Array.from(td.parentElement!.children).indexOf(td) : -1;
                        (td?.closest("tr")?.nextElementSibling?.children[ci]?.querySelector("input") as HTMLInputElement)?.focus();
                      } else if (key === "ARROWUP") {
                        e.preventDefault();
                        const td = input.closest("td");
                        const ci = td ? Array.from(td.parentElement!.children).indexOf(td) : -1;
                        (td?.closest("tr")?.previousElementSibling?.children[ci]?.querySelector("input") as HTMLInputElement)?.focus();
                      }
                    }}
                    className={`w-full h-7 rounded text-[10px] font-mono text-center border-0 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                      isStatus ? ATT_COLORS[val]
                        : isHours ? "bg-transparent text-card-foreground font-bold"
                        : isScheduled && isEmpty
                          ? `${UNIFIED_SHIFT_TINTS[rotaShift] || "bg-muted/30 text-muted-foreground"} placeholder:text-current`
                          : "bg-transparent text-transparent hover:text-muted-foreground"
                    }`}
                    placeholder={isScheduled && isEmpty ? rotaShift! : "·"}
                  />
                </td>
              );
            })}
            <td className="px-2 py-1 text-center">
              <span className="text-[10px] font-mono font-bold text-primary">{total || ""}</span>
            </td>
          </tr>
        );
      })}
    </>
  );

  return (
    <div className="cms-panel overflow-hidden print-target">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center text-xs font-medium text-muted-foreground uppercase px-0.5 py-2 sticky left-0 bg-card z-10 w-7">C</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase px-1 py-2 sticky left-[28px] bg-card z-10 w-[100px]">Name</th>
            {days.map(day => {
              const dateObj = new Date(y, m - 1, day);
              const weekday = WEEKDAYS[dateObj.getDay()];
              const isToday = isCurrentMonth && day === todayDay;
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              return (
                <th key={day} className={`text-center px-0 py-1 ${isToday ? "bg-primary/40" : isWeekend ? "bg-muted/30" : ""}`}>
                  <div className="text-[8px] text-muted-foreground leading-tight">{weekday}</div>
                  <div className={`text-[10px] font-mono leading-tight ${isToday ? "text-primary font-bold" : "text-card-foreground"}`}>{day}</div>
                </th>
              );
            })}
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">Σh</th>
          </tr>
        </thead>
        <tbody>
          {renderAttendanceRows(activeDealers, "Dealers", "border-blue-400 dark:border-blue-500/50 text-blue-600 dark:text-blue-400")}
          {pitBosses.length > 0 && renderAttendanceRows(pitBosses, "Pit Bosses", "border-purple-400 dark:border-purple-500/50 text-purple-600 dark:text-purple-400")}
        </tbody>
      </table>
    </div>
  );
};

export default Pit;
