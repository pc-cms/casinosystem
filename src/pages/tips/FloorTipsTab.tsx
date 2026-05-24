/**
 * FloorTipsTab — Floor staff tips grouped by day; each day expands to
 * per-recipient lines (employee name + amount). Month period total at top.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { useTipsByRange } from "@/hooks/use-tips";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" });

export default function FloorTipsTab() {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const monthStart = useMemo(() => format(startOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const monthEnd = useMemo(() => format(endOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const { data: rows = [] } = useTipsByRange("tips_floor", monthStart, monthEnd);

  const byDay = useMemo(() => {
    const days = new Map<string, { total: number; byEmployee: Map<string, { name: string; total: number; items: any[] }> }>();
    rows.forEach(r => {
      const day = r.business_date;
      if (!days.has(day)) days.set(day, { total: 0, byEmployee: new Map() });
      const dayBucket = days.get(day)!;
      dayBucket.total += Number(r.amount) || 0;
      const empKey = r.tips_recipient_employee_id || "unknown";
      const name = r.employees?.full_name || "Unknown";
      if (!dayBucket.byEmployee.has(empKey)) dayBucket.byEmployee.set(empKey, { name, total: 0, items: [] });
      const emp = dayBucket.byEmployee.get(empKey)!;
      emp.total += Number(r.amount) || 0;
      emp.items.push(r);
    });
    return Array.from(days.entries())
      .map(([d, v]) => ({
        date: d,
        total: v.total,
        employees: Array.from(v.byEmployee.values()).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const monthTotal = byDay.reduce((s, d) => s + d.total, 0);

  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const toggle = (d: string) => setOpenDays(o => ({ ...o, [d]: !o[d] }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setAnchor(d => subMonths(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-3 py-1 rounded-md bg-muted/50 font-semibold tabular-nums min-w-[160px] text-center">
            {format(anchor, "MMMM yyyy")}
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(d => addMonths(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="cms-panel px-4 py-2 flex items-center gap-4">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Month Total</span>
          <span className="font-mono text-lg font-bold">{formatCurrency(monthTotal)}</span>
        </div>
      </div>

      {byDay.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No Floor tips this month</div>
      ) : byDay.map(day => {
        const open = openDays[day.date] ?? true;
        return (
          <div key={day.date} className="cms-panel">
            <button
              type="button"
              onClick={() => toggle(day.date)}
              className="w-full cms-header flex items-center justify-between hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
                <span className="font-mono">{fmtDate(day.date)}</span>
                <span className="text-xs text-muted-foreground">{day.employees.length} recipient(s)</span>
              </span>
              <span className="font-mono text-base font-bold">{formatCurrency(day.total)}</span>
            </button>
            {open && (
              <table className="w-full text-sm">
                <tbody>
                  {day.employees.map(emp => (
                    <tr key={emp.name} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-1.5 font-medium">{emp.name}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {emp.items.map((i: any) => fmtTime(i.created_at)).join(" · ")}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold w-32">{formatCurrency(emp.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
