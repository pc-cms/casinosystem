import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDealers, useCreateDealer, usePitRotaRange, useSetPitRota, useDeletePitRota, useSetDealerAttendance, useDealerAttendanceRange } from "@/hooks/use-casino-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import BreaklistGrid from "@/components/pit/BreaklistGrid";

const ROTA_SHIFTS = ["M", "N", "L", "E"] as const;

const SHIFT_COLORS: Record<string, string> = {
  M: "bg-blue-500/30 text-blue-300 font-bold",
  N: "bg-indigo-500/30 text-indigo-300 font-bold",
  L: "bg-amber-500/30 text-amber-300 font-bold",
  E: "bg-emerald-500/30 text-emerald-300 font-bold",
};

const SHIFT_LABELS: Record<string, string> = {
  M: "Middle (18:00)",
  N: "Night (21:00)",
  L: "Leave",
  E: "Extra",
};

const ATT_COLORS: Record<string, string> = {
  A: "bg-red-500/30 text-red-300",
  S: "bg-amber-500/30 text-amber-300",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const Pit = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
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
  const activeTab = searchParams.get("tab") || "rota";

  const showMonthNav = activeTab === "rota" || activeTab === "attendance";
  const showDatePicker = activeTab === "breaklist";

  // Tab titles for header
  const TAB_TITLES: Record<string, string> = {
    rota: "Rota",
    attendance: "Attendance",
    breaklist: "Breaklist",
    dealers: "Dealers",
  };

  return (
    <div>
      {/* Header row: title + month/date navigation */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{TAB_TITLES[activeTab] || "Pit System"}</h1>
          <p className="text-sm text-muted-foreground">Pit System</p>
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
          {showDatePicker && (
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
          )}
          {/* Legends inline with header */}
          {activeTab === "rota" && (
            <div className="flex items-center gap-1.5">
              {ROTA_SHIFTS.map(s => (
                <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-mono ${SHIFT_COLORS[s]}`}>{s} = {SHIFT_LABELS[s]}</span>
              ))}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted/20 text-muted-foreground">· = Off</span>
            </div>
          )}
          {activeTab === "attendance" && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/30 text-red-300">A = Absent</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/30 text-amber-300">S = Sick</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted/20 text-muted-foreground">· = Empty</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === "rota" && <RotaGrid month={month} />}
      {activeTab === "attendance" && <AttendanceGrid month={month} />}
      {activeTab === "breaklist" && <BreaklistGrid date={date} />}
      {activeTab === "dealers" && <DealersList />}
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

  const activeDealers = dealers.filter(d => d.is_active);

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

  // Display shift: rota entry, or auto-E if worked but not scheduled
  const getDisplayShift = (dealerId: string, day: number): { shift: string; isAuto: boolean } | null => {
    const rotaEntry = getRotaEntry(dealerId, day);
    if (rotaEntry) return { shift: rotaEntry.shift, isAuto: false };

    const att = getAttendanceEntry(dealerId, day);
    if (att) {
      const val = String((att as any).value);
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        return { shift: "E", isAuto: true };
      }
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

  const handleKeyDown = (e: React.KeyboardEvent, dealerId: string, day: number) => {
    const key = e.key.toUpperCase();
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    if (ROTA_SHIFTS.includes(key as typeof ROTA_SHIFTS[number])) {
      e.preventDefault();
      setRota.mutate({ dealer_id: dealerId, date: dateStr, shift: key as typeof ROTA_SHIFTS[number] });
    } else if (key === "BACKSPACE" || key === "DELETE") {
      e.preventDefault();
      deleteRota.mutate({ dealer_id: dealerId, date: dateStr });
    } else if (key === "ARROWRIGHT") {
      e.preventDefault();
      const next = (e.target as HTMLElement)?.nextElementSibling?.querySelector("button") as HTMLElement;
      next?.focus();
    } else if (key === "ARROWLEFT") {
      e.preventDefault();
      const prev = (e.target as HTMLElement)?.parentElement?.previousElementSibling?.querySelector("button") as HTMLElement;
      prev?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent, dealerId: string, day: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").trim().toUpperCase();
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    // Support pasting multiple shifts separated by space/tab/comma
    const values = text.split(/[\s,]+/);
    if (values.length === 1 && ROTA_SHIFTS.includes(values[0] as typeof ROTA_SHIFTS[number])) {
      setRota.mutate({ dealer_id: dealerId, date: dateStr, shift: values[0] as typeof ROTA_SHIFTS[number] });
    } else if (values.length > 1) {
      // Paste sequence starting from this day
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
      if (display) {
        counts[display.shift] = (counts[display.shift] || 0) + 1;
      }
    });
    return counts;
  };

  return (
    <div className="cms-panel overflow-x-auto">
      <div className="min-w-[1200px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-0 bg-card z-10 min-w-[120px]">
                Dealer
              </th>
              {days.map(day => {
                const dateObj = new Date(y, m - 1, day);
                const weekday = WEEKDAYS[dateObj.getDay()];
                const isToday = isCurrentMonth && day === todayDay;
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                return (
                  <th
                    key={day}
                    className={`text-center px-0.5 py-1 min-w-[36px] ${
                      isToday ? "bg-primary/20" : isWeekend ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="text-[9px] text-muted-foreground">{weekday}</div>
                    <div className={`text-xs font-mono ${isToday ? "text-primary font-bold" : "text-card-foreground"}`}>{day}</div>
                  </th>
                );
              })}
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[40px]">M</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[40px]">N</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[40px]">E</th>
            </tr>
          </thead>
          <tbody>
            {activeDealers.length === 0 ? (
              <tr><td colSpan={daysInMonth + 4} className="text-center text-muted-foreground text-sm py-8">No dealers — add dealers first</td></tr>
            ) : activeDealers.map((dealer, idx) => {
              const stats = getDealerStats(dealer.id);
              return (
                <tr
                  key={dealer.id}
                  className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
                    {dealer.name}
                  </td>
                  {days.map(day => {
                    const display = getDisplayShift(dealer.id, day);
                    const isToday = isCurrentMonth && day === todayDay;
                    const dateObj = new Date(y, m - 1, day);
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    return (
                      <td
                        key={day}
                        className={`px-0.5 py-0.5 text-center ${
                          isToday ? "bg-primary/10" : isWeekend ? "bg-muted/15" : ""
                        }`}
                      >
                        <button
                          onClick={() => handleClick(dealer.id, day)}
                          onKeyDown={e => handleKeyDown(e, dealer.id, day)}
                          onPaste={e => handlePaste(e, dealer.id, day)}
                          className={`w-full h-7 rounded text-[10px] font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                            display
                              ? `${SHIFT_COLORS[display.shift] || "bg-muted text-muted-foreground"} ${display.isAuto ? "border border-dashed border-emerald-500/50" : ""}`
                              : "bg-transparent hover:bg-muted/50 text-transparent hover:text-muted-foreground"
                          }`}
                        >
                          {display?.shift || "·"}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <span className="text-[10px] font-mono font-bold text-blue-400">{stats["M"] || ""}</span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className="text-[10px] font-mono font-bold text-indigo-400">{stats["N"] || ""}</span>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <span className="text-[10px] font-mono font-bold text-emerald-400">{stats["E"] || ""}</span>
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

  const activeDealers = dealers.filter(d => d.is_active);

  // Get rota shift for a dealer on a specific day
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
    if (trimmed === "") {
      setAttendance.mutate({ dealer_id: dealerId, date: dateStr, value: "" });
      return;
    }
    if (trimmed === "A" || trimmed === "S") {
      setAttendance.mutate({ dealer_id: dealerId, date: dateStr, value: trimmed });
      return;
    }
    const num = Number(trimmed);
    if (!isNaN(num) && num >= 0 && num <= 24) {
      setAttendance.mutate({ dealer_id: dealerId, date: dateStr, value: String(num) });
    }
  };

  const getDealerTotal = (dealerId: string) => {
    return days.reduce((sum, day) => {
      const val = getValue(dealerId, day);
      const num = Number(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  };

  return (
    <div className="cms-panel overflow-x-auto">
      <div className="min-w-[1200px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2 sticky left-0 bg-card z-10 min-w-[120px]">
                Dealer
              </th>
              {days.map(day => {
                const dateObj = new Date(y, m - 1, day);
                const weekday = WEEKDAYS[dateObj.getDay()];
                const isToday = isCurrentMonth && day === todayDay;
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                return (
                  <th
                    key={day}
                    className={`text-center px-0.5 py-1 min-w-[36px] ${
                      isToday ? "bg-primary/20" : isWeekend ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="text-[9px] text-muted-foreground">{weekday}</div>
                    <div className={`text-xs font-mono ${isToday ? "text-primary font-bold" : "text-card-foreground"}`}>{day}</div>
                  </th>
                );
              })}
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[50px]">Σh</th>
            </tr>
          </thead>
          <tbody>
            {activeDealers.length === 0 ? (
              <tr><td colSpan={daysInMonth + 2} className="text-center text-muted-foreground text-sm py-8">No dealers — add dealers first</td></tr>
            ) : activeDealers.map((dealer, idx) => {
              const total = getDealerTotal(dealer.id);
              return (
                <tr
                  key={dealer.id}
                  className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className={`px-3 py-1 text-xs font-medium text-card-foreground sticky left-0 z-10 ${idx % 2 === 0 ? "bg-card" : "bg-card/95"}`}>
                    {dealer.name}
                  </td>
                  {days.map(day => {
                    const val = getValue(dealer.id, day);
                    const isToday = isCurrentMonth && day === todayDay;
                    const dateObj = new Date(y, m - 1, day);
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    const isStatus = val === "A" || val === "S";
                    const isHours = val !== "" && !isStatus;
                    return (
                      <td
                        key={day}
                        className={`px-0.5 py-0.5 text-center ${
                          isToday ? "bg-primary/10" : isWeekend ? "bg-muted/15" : ""
                        }`}
                      >
                        <input
                          type="text"
                          defaultValue={val}
                          key={`${dealer.id}-${month}-${day}-${val}`}
                          onBlur={e => handleSave(dealer.id, day, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className={`w-full h-7 rounded text-[10px] font-mono text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                            isStatus
                              ? ATT_COLORS[val]
                              : isHours
                                ? "text-card-foreground font-bold"
                                : "text-transparent hover:text-muted-foreground"
                          }`}
                          placeholder="·"
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =================== DEALERS LIST ===================
const DealersList = () => {
  const { data: dealers = [] } = useDealers();
  const createDealer = useCreateDealer();
  const [name, setName] = useState("");

  return (
    <div className="max-w-md space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Dealer name" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && name) { createDealer.mutate(name); setName(""); } }} />
        <Button onClick={() => { if (name) { createDealer.mutate(name); setName(""); } }} disabled={!name}>
          <UserPlus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      <div className="cms-panel">
        {dealers.map((d, idx) => (
          <div key={d.id} className={`flex items-center justify-between px-4 py-2 border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
            <span className="text-sm text-card-foreground">{d.name}</span>
            <span className={`text-xs ${d.is_active ? "cms-status-active" : "cms-status-blacklist"}`}>
              {d.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
        {dealers.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No dealers</p>}
      </div>
    </div>
  );
};

export default Pit;
