import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ChevronLeft, ChevronRight, ArrowUpDown, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  useStaffMembers, useCreateStaffMember, useUpdateStaffMember, useStaffRotaRange, useSetStaffRota,
  useDeleteStaffRota, useStaffAttendanceRange, useSetStaffAttendance,
  DEPARTMENT_LABELS, DEPARTMENT_ORDER, STAFF_SHIFT_LABELS, STAFF_SHIFT_COLORS,
  type StaffDepartment,
} from "@/hooks/use-staff";

const STAFF_SHIFTS = ["D", "N", "L", "O"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ATT_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-700 dark:bg-red-500/30 dark:text-red-300",
  S: "bg-amber-100 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300",
};

const DEPT_BADGE_COLORS: Record<string, string> = {
  security: "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
  cashier: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
  bartender: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
  hostess: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30",
  waiter: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30",
  cleaner: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
  it: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30",
  hr: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
};

const DEPT_BORDER_COLORS: Record<string, string> = {
  security: "border-red-500/50",
  cashier: "border-blue-500/50",
  bartender: "border-amber-500/50",
  hostess: "border-pink-500/50",
  waiter: "border-cyan-500/50",
  cleaner: "border-emerald-500/50",
  it: "border-violet-500/50",
  hr: "border-orange-500/50",
};

const DEPT_DOT_COLORS: Record<string, string> = {
  security: "bg-red-400",
  cashier: "bg-blue-400",
  bartender: "bg-amber-400",
  hostess: "bg-pink-400",
  waiter: "bg-cyan-400",
  cleaner: "bg-emerald-400",
  it: "bg-violet-400",
  hr: "bg-orange-400",
};

const DEPT_ROW_COLORS: Record<string, string> = {
  security: "bg-red-500/5",
  cashier: "bg-blue-500/5",
  bartender: "bg-amber-500/5",
  hostess: "bg-pink-500/5",
  waiter: "bg-cyan-500/5",
  cleaner: "bg-emerald-500/5",
  it: "bg-violet-500/5",
  hr: "bg-orange-500/5",
};

const Staff = () => {
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

  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "employee";

  const showMonthNav = activeTab === "rota" || activeTab === "attendance";

  const TAB_TITLES: Record<string, string> = {
    employee: "Floor Staff",
    rota: "Floor Rota",
    attendance: "Floor Attendance",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{TAB_TITLES[activeTab] || "Floor"}</h1>
          <p className="text-sm text-muted-foreground">Floor Management</p>
        </div>
        <div className="flex items-center gap-3">
          {showMonthNav && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold text-card-foreground min-w-[140px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          {activeTab === "rota" && (
            <div className="flex items-center gap-1.5">
              {STAFF_SHIFTS.map(s => (
                <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-mono ${STAFF_SHIFT_COLORS[s]}`}>
                  {s} = {STAFF_SHIFT_LABELS[s]}
                </span>
              ))}
              <Button variant="outline" size="sm" className="ml-2 gap-1 text-xs" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
            </div>
          )}
          {activeTab === "attendance" && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-100 text-red-700 dark:bg-red-500/30 dark:text-red-300">A = Absent</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-100 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300">S = Sick</span>
              <Button variant="outline" size="sm" className="ml-2 gap-1 text-xs" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
            </div>
          )}
        </div>
      </div>

      {activeTab === "employee" && <EmployeeList />}
      {activeTab === "rota" && <StaffRotaGrid month={month} />}
      {activeTab === "attendance" && <StaffAttendanceGrid month={month} />}
    </div>
  );
};

// =================== EMPLOYEE LIST (UNIFIED TABLE WITH SORTING) ===================
const getDaysLeft = (contractEnd: string | null): number | null => {
  if (!contractEnd) return null;
  const end = new Date(contractEnd);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const EmployeeList = () => {
  const { isManager, roles } = useAuth();
  // HR role has full personnel management access (no manager confirmation needed)
  const canManage = isManager || roles.includes("hr");
  const { data: staff = [] } = useStaffMembers();
  const createStaff = useCreateStaffMember();
  const updateStaff = useUpdateStaffMember();
  const [name, setName] = useState("");
  const [dept, setDept] = useState<StaffDepartment>("waiter");
  const [sortBy, setSortBy] = useState<string>("department");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const sorted = useMemo(() => {
    let list = [...staff] as any[];
    if (filterDept !== "all") list = list.filter(s => s.department === filterDept);
    if (filterStatus === "active") list = list.filter(s => s.is_active);
    else if (filterStatus === "fired") list = list.filter(s => !s.is_active);

    list.sort((a, b) => {
      switch (sortBy) {
        case "department": {
          const dA = DEPARTMENT_ORDER.indexOf(a.department as StaffDepartment);
          const dB = DEPARTMENT_ORDER.indexOf(b.department as StaffDepartment);
          return dA !== dB ? dA - dB : a.name.localeCompare(b.name);
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
  }, [staff, sortBy, filterDept, filterStatus]);

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
    if (field === "salary") {
      const num = parseInt(editValue.replace(/\s/g, ""), 10);
      updateStaff.mutate({ id, salary: isNaN(num) ? null : num });
    } else if (field === "contract_start" || field === "contract_end" || field === "onboarding_date") {
      updateStaff.mutate({ id, [field]: editValue || null });
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
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENT_ORDER.map(d => (
              <SelectItem key={d} value={d}>{DEPARTMENT_LABELS[d]}</SelectItem>
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
          onKeyDown={e => { if (e.key === "Enter" && name && canManage) { createStaff.mutate({ name, department: dept }); setName(""); } }}
        />
        <Select value={dept} onValueChange={v => setDept(v as StaffDepartment)} disabled={!canManage}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPARTMENT_ORDER.map(d => (
              <SelectItem key={d} value={d}>{DEPARTMENT_LABELS[d]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { if (name && canManage) { createStaff.mutate({ name, department: dept }); setName(""); } else if (!canManage) { toast.error("Manager or HR access required"); } }} disabled={!name || !canManage}>
          <UserPlus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <SortHeader field="name" label="Name" />
              <SortHeader field="department" label="Department" />
              <SortHeader field="salary" label="Salary" />
              <SortHeader field="onboarding" label="Onboarding" />
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Contract Start</th>
              <SortHeader field="contract_end" label="Contract End" />
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Years</th>
              <SortHeader field="days_left" label="Days Left" />
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s: any) => {
              const daysLeft = getDaysLeft(s.contract_end);
              return (
                <tr key={s.id} className={`border-b border-border last:border-0 ${DEPT_ROW_COLORS[s.department] || ""}`}>
                  <td className="px-4 py-2 text-sm text-card-foreground font-medium">{s.name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${DEPT_BADGE_COLORS[s.department] || ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${DEPT_DOT_COLORS[s.department] || "bg-muted-foreground"}`} />
                      {DEPARTMENT_LABELS[s.department as StaffDepartment]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-card-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(s.id, "salary", s.salary?.toString() || "")}>
                    {editingCell?.id === s.id && editingCell.field === "salary" ? (
                      <Input className="h-7 w-24 font-mono text-sm" value={editValue} autoFocus
                        onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : formatSalary(s.salary)}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(s.id, "onboarding_date", s.onboarding_date || "")}>
                    {editingCell?.id === s.id && editingCell.field === "onboarding_date" ? (
                      <input type="date" className="h-7 bg-background border border-border rounded px-2 text-sm font-mono text-foreground"
                        value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : s.onboarding_date || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(s.id, "contract_start", s.contract_start || "")}>
                    {editingCell?.id === s.id && editingCell.field === "contract_start" ? (
                      <input type="date" className="h-7 bg-background border border-border rounded px-2 text-sm font-mono text-foreground"
                        value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : s.contract_start || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono cursor-pointer hover:bg-muted/30"
                    onClick={() => startEdit(s.id, "contract_end", s.contract_end || "")}>
                    {editingCell?.id === s.id && editingCell.field === "contract_end" ? (
                      <input type="date" className="h-7 bg-background border border-border rounded px-2 text-sm font-mono text-foreground"
                        value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleEditKeyDown} />
                    ) : s.contract_end || "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground font-mono">{calcYears(s.onboarding_date)}</td>
                  <td className="px-4 py-2">
                    <span className={`font-mono text-xs font-bold ${daysLeft === null ? "text-muted-foreground" : daysLeft <= 40 ? "text-red-600 dark:text-red-400" : daysLeft <= 90 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {daysLeft === null ? "—" : `${daysLeft}d`}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => {
                      if (!canManage) { toast.error("Manager or HR access required"); return; }
                      updateStaff.mutate({ id: s.id, is_active: !s.is_active });
                    }}
                      className={`text-xs font-medium cursor-pointer hover:underline ${s.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {s.is_active ? "Active" : "Fired"}
                    </button>
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


// =================== STAFF ROTA GRID ===================
const StaffRotaGrid = ({ month }: { month: string }) => {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: staff = [] } = useStaffMembers();
  const { data: rota = [] } = useStaffRotaRange(startDate, endDate);
  const { data: monthAttendance = [] } = useStaffAttendanceRange(startDate, endDate);
  const setRota = useSetStaffRota();
  const deleteRota = useDeleteStaffRota();

  const activeStaff = staff.filter(s => s.is_active);

  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

  const getRotaEntry = (staffId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    return rota.find((r: any) => r.staff_id === staffId && r.date === dateStr);
  };

  const getAttendanceEntry = (staffId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    return monthAttendance.find((a: any) => a.staff_id === staffId && a.date === dateStr);
  };

  const getDisplayShift = (staffId: string, day: number): { shift: string; isAuto: boolean } | null => {
    const rotaEntry = getRotaEntry(staffId, day);
    if (rotaEntry) return { shift: rotaEntry.shift, isAuto: false };
    const att = getAttendanceEntry(staffId, day);
    if (att) {
      const val = String((att as any).value);
      const num = Number(val);
      if (!isNaN(num) && num > 0) return { shift: "E", isAuto: true };
    }
    return null;
  };

  const handleClick = (staffId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const current = getRotaEntry(staffId, day);
    if (!current) {
      setRota.mutate({ staff_id: staffId, date: dateStr, shift: "D" });
    } else {
      const idx = STAFF_SHIFTS.indexOf(current.shift as typeof STAFF_SHIFTS[number]);
      if (idx >= 0 && idx < STAFF_SHIFTS.length - 1) {
        setRota.mutate({ staff_id: staffId, date: dateStr, shift: STAFF_SHIFTS[idx + 1] });
      } else {
        deleteRota.mutate({ staff_id: staffId, date: dateStr });
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
    const firstBtn = nextRow?.querySelector("td:nth-child(2) button") as HTMLElement;
    firstBtn?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, staffId: string, day: number) => {
    const key = e.key.toUpperCase();
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    if (STAFF_SHIFTS.includes(key as typeof STAFF_SHIFTS[number])) {
      e.preventDefault();
      setRota.mutate({ staff_id: staffId, date: dateStr, shift: key });
      focusNextCell(e.target as HTMLElement);
    } else if (key === " " || e.code === "Space") {
      e.preventDefault();
      focusNextCell(e.target as HTMLElement);
    } else if (key === "BACKSPACE" || key === "DELETE") {
      e.preventDefault();
      deleteRota.mutate({ staff_id: staffId, date: dateStr });
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

  const handlePaste = (e: React.ClipboardEvent, staffId: string, day: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").trim().toUpperCase();
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const values = text.split(/[\s,]+/);
    if (values.length === 1 && STAFF_SHIFTS.includes(values[0] as typeof STAFF_SHIFTS[number])) {
      setRota.mutate({ staff_id: staffId, date: dateStr, shift: values[0] });
    } else if (values.length > 1) {
      values.forEach((v, i) => {
        const d = day + i;
        if (d <= daysInMonth && STAFF_SHIFTS.includes(v as typeof STAFF_SHIFTS[number])) {
          const ds = `${month}-${String(d).padStart(2, "0")}`;
          setRota.mutate({ staff_id: staffId, date: ds, shift: v });
        }
      });
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, typeof activeStaff> = {};
    DEPARTMENT_ORDER.forEach(d => { groups[d] = []; });
    activeStaff.forEach(s => {
      if (!groups[s.department]) groups[s.department] = [];
      groups[s.department].push(s);
    });
    return groups;
  }, [activeStaff]);

  const getStats = (staffId: string) => {
    const counts: Record<string, number> = {};
    days.forEach(day => {
      const display = getDisplayShift(staffId, day);
      if (display) counts[display.shift] = (counts[display.shift] || 0) + 1;
    });
    return counts;
  };

  return (
    <>
      <div className="print-title hidden">{`Floor Rota — ${month}`}</div>
      <div className="cms-panel overflow-hidden print-target">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase px-1 py-2 sticky left-0 bg-card z-10 w-[110px]">
              Staff
            </th>
            {days.map(day => {
              const dateObj = new Date(y, m - 1, day);
              const weekday = WEEKDAYS[dateObj.getDay()];
              const isToday = isCurrentMonth && day === todayDay;
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              return (
                <th key={day} className={`text-center px-0 py-1 ${isToday ? "bg-primary/20" : isWeekend ? "bg-muted/30" : ""}`}>
                  <div className="text-[8px] text-muted-foreground leading-tight">{weekday}</div>
                  <div className={`text-[10px] font-mono leading-tight ${isToday ? "text-primary font-bold" : "text-card-foreground"}`}>{day}</div>
                </th>
              );
            })}
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">D</th>
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">N</th>
          </tr>
        </thead>
        <tbody>
          {DEPARTMENT_ORDER.map(dept => {
            const members = grouped[dept] || [];
            if (members.length === 0) return null;
            return (
              <DepartmentBlock
                key={dept}
                dept={dept}
                members={members}
                days={days}
                month={month}
                y={y}
                m={m}
                isCurrentMonth={isCurrentMonth}
                todayDay={todayDay}
                getDisplayShift={getDisplayShift}
                handleClick={handleClick}
                handleKeyDown={handleKeyDown}
                handlePaste={handlePaste}
                getStats={getStats}
              />
            );
          })}
          {/* Summary: D/N count per day, excluding Security */}
          {(() => {
            const nonSecurity = activeStaff.filter(s => s.department !== "security");
            return (
              <>
                <tr className="border-t-2 border-border">
                  <td className="px-1 py-1 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 sticky left-0 bg-card z-10">Σ D</td>
                  {days.map(day => {
                    const count = nonSecurity.filter(s => getDisplayShift(s.id, day)?.shift === "D").length;
                    return <td key={day} className="text-center text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400">{count || ""}</td>;
                  })}
                  <td colSpan={2} />
                </tr>
                <tr>
                  <td className="px-1 py-1 text-[9px] font-mono font-bold text-indigo-400 sticky left-0 bg-card z-10">Σ N</td>
                  {days.map(day => {
                    const count = nonSecurity.filter(s => getDisplayShift(s.id, day)?.shift === "N").length;
                    return <td key={day} className="text-center text-[9px] font-mono font-bold text-indigo-400">{count || ""}</td>;
                  })}
                  <td colSpan={2} />
                </tr>
                <tr>
                  <td className="px-1 py-1 text-[9px] font-mono font-bold text-card-foreground sticky left-0 bg-card z-10">Σ All</td>
                  {days.map(day => {
                    const count = nonSecurity.filter(s => {
                      const sh = getDisplayShift(s.id, day)?.shift;
                      return sh === "D" || sh === "N";
                    }).length;
                    return <td key={day} className="text-center text-[9px] font-mono font-bold text-card-foreground">{count || ""}</td>;
                  })}
                  <td colSpan={2} />
                </tr>
              </>
            );
          })()}
        </tbody>
      </table>
    </div>
    </>
  );
};

const DepartmentBlock = ({
  dept, members, days, month, y, m, isCurrentMonth, todayDay,
  getDisplayShift, handleClick, handleKeyDown, handlePaste, getStats,
}: {
  dept: string;
  members: any[];
  days: number[];
  month: string;
  y: number;
  m: number;
  isCurrentMonth: boolean;
  todayDay: number;
  getDisplayShift: (id: string, day: number) => { shift: string; isAuto: boolean } | null;
  handleClick: (id: string, day: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, id: string, day: number) => void;
  handlePaste: (e: React.ClipboardEvent, id: string, day: number) => void;
  getStats: (id: string) => Record<string, number>;
}) => (
  <>
    <tr>
      <td colSpan={days.length + 3} className="px-0 py-0 sticky left-0">
        <div className={`flex items-center gap-2 px-3 py-1 border-b-2 ${DEPT_BORDER_COLORS[dept] || "border-muted"}`}>
          <span className={`w-2 h-2 rounded-full ${DEPT_DOT_COLORS[dept] || "bg-muted-foreground"}`} />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-card-foreground">{DEPARTMENT_LABELS[dept as StaffDepartment]}</span>
          <span className="text-[10px] font-mono text-muted-foreground">({members.length})</span>
        </div>
      </td>
    </tr>
    {members.map((staff, idx) => {
      const stats = getStats(staff.id);
      return (
        <tr key={staff.id} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
          <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
            {staff.name}
          </td>
          {days.map(day => {
            const display = getDisplayShift(staff.id, day);
            const isToday = isCurrentMonth && day === todayDay;
            const dateObj = new Date(y, m - 1, day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            return (
              <td key={day} className={`px-0.5 py-0.5 text-center ${isToday ? "bg-primary/10" : isWeekend ? "bg-muted/15" : ""}`}>
                <button
                  onClick={() => handleClick(staff.id, day)}
                  onKeyDown={e => handleKeyDown(e, staff.id, day)}
                  onPaste={e => handlePaste(e, staff.id, day)}
                  className={`w-full h-7 rounded text-[10px] font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                    display
                      ? `${STAFF_SHIFT_COLORS[display.shift] || "bg-muted text-muted-foreground"} ${display.isAuto ? "border border-dashed border-amber-500/50" : ""}`
                      : "bg-transparent hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground"
                  }`}
                >
                  {display?.shift || "·"}
                </button>
              </td>
            );
          })}
          <td className="px-2 py-1 text-center">
            <span className="text-[10px] font-mono font-bold text-amber-400">{stats["D"] || ""}</span>
          </td>
          <td className="px-2 py-1 text-center">
            <span className="text-[10px] font-mono font-bold text-indigo-400">{stats["N"] || ""}</span>
          </td>
        </tr>
      );
    })}
  </>
);

// =================== STAFF ATTENDANCE GRID ===================
const StaffAttendanceGrid = ({ month }: { month: string }) => {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: staff = [] } = useStaffMembers();
  const { data: attendance = [] } = useStaffAttendanceRange(startDate, endDate);
  const { data: rota = [] } = useStaffRotaRange(startDate, endDate);
  const setAttendance = useSetStaffAttendance();

  const activeStaff = staff.filter(s => s.is_active);

  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

  const getValue = (staffId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const entry = attendance.find((a: any) => a.staff_id === staffId && a.date === dateStr);
    return entry ? String(entry.value) : "";
  };

  const getRotaShift = (staffId: string, day: number): string | null => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const entry = rota.find((r: any) => r.staff_id === staffId && r.date === dateStr);
    if (!entry) return null;
    const s = entry.shift as string;
    return (s === "D" || s === "N") ? s : null;
  };

  const handleSave = (staffId: string, day: number, val: string) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const trimmed = val.trim().toUpperCase();
    if (trimmed === "") { setAttendance.mutate({ staff_id: staffId, date: dateStr, value: "" }); return; }
    if (trimmed === "A" || trimmed === "S") { setAttendance.mutate({ staff_id: staffId, date: dateStr, value: trimmed }); return; }
    const num = Number(trimmed);
    if (!isNaN(num) && num >= 0 && num <= 24) { setAttendance.mutate({ staff_id: staffId, date: dateStr, value: String(num) }); }
  };

  const getTotal = (staffId: string) => {
    return days.reduce((sum, day) => {
      const val = getValue(staffId, day);
      const num = Number(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, typeof activeStaff> = {};
    DEPARTMENT_ORDER.forEach(d => { groups[d] = []; });
    activeStaff.forEach(s => {
      if (!groups[s.department]) groups[s.department] = [];
      groups[s.department].push(s);
    });
    return groups;
  }, [activeStaff]);

  return (
    <div className="cms-panel overflow-hidden print-target">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase px-1 py-2 sticky left-0 bg-card z-10 w-[110px]">
              Staff
            </th>
            {days.map(day => {
              const dateObj = new Date(y, m - 1, day);
              const weekday = WEEKDAYS[dateObj.getDay()];
              const isToday = isCurrentMonth && day === todayDay;
              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              return (
                <th key={day} className={`text-center px-0 py-1 ${isToday ? "bg-primary/20" : isWeekend ? "bg-muted/30" : ""}`}>
                  <div className="text-[8px] text-muted-foreground leading-tight">{weekday}</div>
                  <div className={`text-[10px] font-mono leading-tight ${isToday ? "text-primary font-bold" : "text-card-foreground"}`}>{day}</div>
                </th>
              );
            })}
            <th className="text-center text-[10px] font-medium text-muted-foreground uppercase px-1 py-2 w-8">Σh</th>
          </tr>
        </thead>
        <tbody>
          {DEPARTMENT_ORDER.map(dept => {
            const members = grouped[dept] || [];
            if (members.length === 0) return null;
            return (
              <AttendanceDepartmentBlock
                key={dept}
                dept={dept}
                members={members}
                days={days}
                month={month}
                y={y}
                m={m}
                isCurrentMonth={isCurrentMonth}
                todayDay={todayDay}
                getValue={getValue}
                getRotaShift={getRotaShift}
                handleSave={handleSave}
                getTotal={getTotal}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const AttendanceDepartmentBlock = ({
  dept, members, days, month, y, m, isCurrentMonth, todayDay,
  getValue, getRotaShift, handleSave, getTotal,
}: {
  dept: string;
  members: any[];
  days: number[];
  month: string;
  y: number;
  m: number;
  isCurrentMonth: boolean;
  todayDay: number;
  getValue: (id: string, day: number) => string;
  getRotaShift: (id: string, day: number) => string | null;
  handleSave: (id: string, day: number, val: string) => void;
  getTotal: (id: string) => number;
}) => (
  <>
    <tr>
      <td colSpan={days.length + 2} className="px-0 py-0 sticky left-0">
        <div className={`flex items-center gap-2 px-3 py-1 border-b-2 ${DEPT_BORDER_COLORS[dept] || "border-muted"}`}>
          <span className={`w-2 h-2 rounded-full ${DEPT_DOT_COLORS[dept] || "bg-muted-foreground"}`} />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-card-foreground">{DEPARTMENT_LABELS[dept as StaffDepartment]}</span>
          <span className="text-[10px] font-mono text-muted-foreground">({members.length})</span>
        </div>
      </td>
    </tr>
    {members.map((staff, idx) => {
      const total = getTotal(staff.id);
      return (
        <tr key={staff.id} className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
          <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
            {staff.name}
          </td>
          {days.map(day => {
            const val = getValue(staff.id, day);
            const isToday = isCurrentMonth && day === todayDay;
            const dateObj = new Date(y, m - 1, day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isStatus = val === "A" || val === "S";
            const isHours = val !== "" && !isStatus;
            const rotaShift = getRotaShift(staff.id, day);
            const isScheduled = !!rotaShift;
            const isEmpty = val === "";
            return (
              <td key={day} className={`px-0.5 py-0.5 text-center ${isToday ? "bg-primary/10" : isWeekend ? "bg-muted/15" : ""}`}>
                <input
                  type="text"
                  defaultValue={val}
                  key={`${staff.id}-${month}-${day}-${val}`}
                  onBlur={e => handleSave(staff.id, day, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className={`w-full h-7 rounded text-[10px] font-mono text-center border-0 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                    isStatus
                      ? ATT_COLORS[val]
                      : isHours
                        ? "bg-transparent text-card-foreground font-bold"
                        : isScheduled && isEmpty
                          ? `${rotaShift === "D" ? "bg-amber-500/15 text-amber-400" : "bg-indigo-500/15 text-indigo-400"} placeholder:text-current`
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

export default Staff;
