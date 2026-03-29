import { useState, useMemo, useCallback } from "react";
import { useDealers, useCreateDealer, usePitRotaRange, useSetPitRota, useDeletePitRota, useDealerAttendance, useSetDealerAttendance } from "@/hooks/use-casino-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import BreaklistGrid from "@/components/pit/BreaklistGrid";

const ROTA_SHIFTS = ["M", "N", "L"] as const;

const SHIFT_COLORS: Record<string, string> = {
  M: "bg-blue-500/30 text-blue-300 font-bold",
  N: "bg-indigo-500/30 text-indigo-300 font-bold",
  L: "bg-amber-500/30 text-amber-300 font-bold",
};

const SHIFT_LABELS: Record<string, string> = {
  M: "Middle (18:00)",
  N: "Night (21:00)",
  L: "Leave",
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pit System</h1>
          <p className="text-sm text-muted-foreground">Rota, Attendance & Breaklist</p>
        </div>
      </div>

      <Tabs defaultValue="rota" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="breaklist">Breaklist</TabsTrigger>
          <TabsTrigger value="dealers">Dealers</TabsTrigger>
        </TabsList>

        <TabsContent value="rota">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold text-card-foreground min-w-[140px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {ROTA_SHIFTS.map(s => (
                <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-mono ${SHIFT_COLORS[s]}`} title={SHIFT_LABELS[s]}>{s}</span>
              ))}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted/20 text-muted-foreground">· = Off</span>
            </div>
          </div>
          <RotaGrid month={month} />
        </TabsContent>

        <TabsContent value="attendance">
          <div className="flex items-center justify-end mb-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
          </div>
          <AttendanceGrid date={date} />
        </TabsContent>

        <TabsContent value="breaklist">
          <div className="flex items-center justify-end mb-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
          </div>
          <BreaklistGrid date={date} />
        </TabsContent>

        <TabsContent value="dealers"><DealersList /></TabsContent>
      </Tabs>
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
  const setRota = useSetPitRota();
  const deleteRota = useDeletePitRota();

  const activeDealers = dealers.filter(d => d.is_active);

  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

  const getShift = (dealerId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    return rota.find(r => r.dealer_id === dealerId && r.date === dateStr);
  };

  const handleClick = (dealerId: string, day: number) => {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const current = getShift(dealerId, day);

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

  const getDealerStats = (dealerId: string) => {
    const entries = rota.filter(r => r.dealer_id === dealerId);
    const counts: Record<string, number> = {};
    entries.forEach(e => { counts[e.shift] = (counts[e.shift] || 0) + 1; });
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
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[60px]">M</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-2 py-2 min-w-[60px]">N</th>
            </tr>
          </thead>
          <tbody>
            {activeDealers.length === 0 ? (
              <tr><td colSpan={daysInMonth + 3} className="text-center text-muted-foreground text-sm py-8">No dealers — add dealers first</td></tr>
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
                    const entry = getShift(dealer.id, day);
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
                          className={`w-full h-7 rounded text-[10px] font-mono transition-colors ${
                            entry
                              ? SHIFT_COLORS[entry.shift] || "bg-muted text-muted-foreground"
                              : "bg-transparent hover:bg-muted/50 text-transparent hover:text-muted-foreground"
                          }`}
                        >
                          {entry?.shift || "·"}
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
const AttendanceGrid = ({ date }: { date: string }) => {
  const { data: dealers = [] } = useDealers();
  const { data: attendance = [] } = useDealerAttendance(date);
  const setAttendance = useSetDealerAttendance();

  const activeDealers = dealers.filter(d => d.is_active);

  const getHours = useCallback((dealerId: string) => {
    const entry = attendance.find((a: any) => a.dealer_id === dealerId);
    return entry ? Number((entry as any).hours) : null;
  }, [attendance]);

  const handleSave = (dealerId: string, val: string) => {
    const num = Number(val);
    if (isNaN(num) || num < 0 || num > 24) return;
    const current = getHours(dealerId);
    if (current === num) return;
    setAttendance.mutate({ dealer_id: dealerId, date, hours: num });
  };

  const totalHours = attendance.reduce((s: number, a: any) => s + Number(a.hours || 0), 0);
  const filledCount = attendance.filter((a: any) => Number(a.hours) > 0).length;

  return (
    <div className="cms-panel">
      <div className="max-w-lg">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase">Dealer</span>
          <span className="text-xs font-medium text-muted-foreground uppercase w-20 text-center">Hours</span>
        </div>
        {activeDealers.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No dealers</p>
        ) : activeDealers.map((dealer, idx) => {
          const hours = getHours(dealer.id);
          return (
            <div
              key={dealer.id}
              className={`flex items-center justify-between px-4 py-2 border-b border-border last:border-0 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
            >
              <span className="text-sm text-card-foreground">{dealer.name}</span>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                defaultValue={hours ?? ""}
                key={`${dealer.id}-${date}-${hours}`}
                onBlur={e => handleSave(dealer.id, e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-20 h-8 text-center text-sm font-mono bg-transparent border border-border rounded px-2 focus:border-primary focus:outline-none text-card-foreground no-spin"
                placeholder="0"
              />
            </div>
          );
        })}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t-2 border-primary/30">
          <span className="text-xs font-bold text-card-foreground uppercase">
            Total ({filledCount} dealers)
          </span>
          <span className="text-sm font-mono font-bold text-primary w-20 text-center">{totalHours}h</span>
        </div>
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
