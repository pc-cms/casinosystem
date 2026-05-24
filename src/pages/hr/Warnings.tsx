/**
 * HR Warnings — month-by-month inbox of attendance issues.
 *
 * Source = `staff_warnings` (auto-populated by the dealer_attendance +
 * staff_attendance trigger). Visible to hr/manager/finance_manager/super_admin.
 * Each row shows date · employee · kind · inline-editable comment.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthCarousel, useMonthFromUrl } from "@/components/payroll/MonthCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaffWarnings, useUpdateWarningComment, type WarningKind, type StaffWarningRow } from "@/hooks/use-staff-warnings";
import { fmtDate } from "@/lib/format-date";
import { useAuth } from "@/lib/auth-context";

const KIND_META: Record<WarningKind, { label: string; cls: string }> = {
  suspend: { label: "SP", cls: "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/40" },
  absent:  { label: "A",  cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  sick:    { label: "S",  cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  late:    { label: "L",  cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

const KIND_ORDER: WarningKind[] = ["suspend", "absent", "sick", "late"];

export default function HrWarnings() {
  const { year, month, setYM } = useMonthFromUrl();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: warnings = [], isLoading } = useStaffWarnings(monthStart, monthEnd);
  const { roles } = useAuth();
  const canEdit = roles.includes("hr") || roles.includes("manager") || roles.includes("super_admin");
  const update = useUpdateWarningComment();

  const [kindFilter, setKindFilter] = useState<WarningKind | "all">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const departments = useMemo(() => {
    const s = new Set<string>();
    warnings.forEach(w => { if (w.employees?.department) s.add(w.employees.department); });
    return Array.from(s).sort();
  }, [warnings]);

  const filtered = useMemo(() => {
    return warnings.filter(w =>
      (kindFilter === "all" || w.kind === kindFilter) &&
      (deptFilter === "all" || w.employees?.department === deptFilter)
    );
  }, [warnings, kindFilter, deptFilter]);

  const byDay = useMemo(() => {
    const m = new Map<string, StaffWarningRow[]>();
    filtered.forEach(w => {
      if (!m.has(w.business_date)) m.set(w.business_date, []);
      m.get(w.business_date)!.push(w);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totals = useMemo(() => {
    const t: Record<WarningKind, number> = { suspend: 0, absent: 0, sick: 0, late: 0 };
    filtered.forEach(w => { t[w.kind] += 1; });
    return t;
  }, [filtered]);

  return (
    <PageShell>
      <PageHeader icon={AlertTriangle} title="HR Warnings" subtitle="Staff attendance issues this month">
        <MonthCarousel year={year} month={month} onChange={setYM} />
      </PageHeader>

      <PageSection card={false}>
        <div className="cms-panel p-3 mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-1">Kind</span>
            <Button size="sm" variant={kindFilter === "all" ? "default" : "outline"} onClick={() => setKindFilter("all")}>All ({filtered.length})</Button>
            {KIND_ORDER.map(k => (
              <Button key={k} size="sm" variant={kindFilter === k ? "default" : "outline"} onClick={() => setKindFilter(k)}>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mr-1 ${KIND_META[k].cls}`}>{KIND_META[k].label}</span>
                {totals[k]}
              </Button>
            ))}
          </div>
          {departments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider mr-1">Dept</span>
              <Button size="sm" variant={deptFilter === "all" ? "default" : "outline"} onClick={() => setDeptFilter("all")}>All</Button>
              {departments.map(d => (
                <Button key={d} size="sm" variant={deptFilter === d ? "default" : "outline"} onClick={() => setDeptFilter(d)}>{d}</Button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground p-4">Loading…</div>
        ) : byDay.length === 0 ? (
          <div className="cms-panel p-8 text-center text-muted-foreground">No warnings this month</div>
        ) : byDay.map(([date, rows]) => (
          <div key={date} className="cms-panel mb-3">
            <div className="cms-header flex items-center justify-between">
              <span className="font-mono">{fmtDate(date)}</span>
              <span className="text-xs text-muted-foreground">{rows.length} event(s)</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {rows.map(w => (
                  <tr key={w.id} className="border-b border-border/30 last:border-0">
                    <td className="px-3 py-2 w-12">
                      <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-[11px] font-mono font-bold ${KIND_META[w.kind].cls}`}>
                        {KIND_META[w.kind].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{w.employees?.full_name || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground w-32">{w.employees?.department || ""}</td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <Input
                          defaultValue={w.comment}
                          placeholder="Add comment…"
                          className="h-8"
                          onBlur={e => {
                            const v = e.target.value;
                            if (v !== w.comment) update.mutate({ id: w.id, comment: v });
                          }}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />{w.comment || "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </PageSection>
    </PageShell>
  );
}
