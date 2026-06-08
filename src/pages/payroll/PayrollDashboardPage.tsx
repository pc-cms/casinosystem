/**
 * Payroll Dashboard — KPIs + per-department charts for the selected month.
 */
import { useMemo } from "react";
import { LayoutDashboard, Users, Wallet, FileText, ShieldAlert, Coins, Ban, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthCarousel, useMonthFromUrl, MONTHS, StatusBadge } from "@/components/payroll/MonthCarousel";
import { usePeriodForMonth, usePayrollEntries, useEmployees } from "@/hooks/use-payroll";
import { BentoGrid, BentoTile, BentoKpi } from "@/components/ui/bento-grid";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n)).replace(/,/g, " ");

const KPI = ({ icon: Icon, label, value, sub }: any) => (
  <BentoTile
    col={3}
    title={
      <span className="inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        {label}
      </span>
    }
  >
    <BentoKpi value={fmt(value)} hint={sub} />
  </BentoTile>
);

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#06b6d4"];

export default function PayrollDashboardPage() {
  const { year, month, setYM } = useMonthFromUrl();
  const { data: period } = usePeriodForMonth(year, month);
  const { data: entries = [] } = usePayrollEntries(period?.id);
  const { data: employees = [] } = useEmployees();

  const totals = useMemo(() => entries.reduce((a, e) => ({
    basic: a.basic + e.snapshot_basic_salary,
    gross: a.gross + e.gross_salary,
    paye:  a.paye  + e.paye,
    nssf:  a.nssf  + e.nssf_employee,
    adv:   a.adv   + e.salary_advances,
    ded:   a.ded   + e.gepf_employee + e.nssf_employee + e.paye + e.cash_shortage + e.salary_advances + e.deductions_missing_days + e.gepf_loan,
    net:   a.net   + e.net_salary,
  }), { basic:0, gross:0, paye:0, nssf:0, adv:0, ded:0, net:0 }), [entries]);

  const empDept = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach(e => m.set(e.id, e.department || "Other"));
    return m;
  }, [employees]);

  const byDept = useMemo(() => {
    const map = new Map<string, { gross: number; net: number }>();
    entries.forEach(e => {
      const d = empDept.get(e.employee_id) || "Other";
      const cur = map.get(d) || { gross: 0, net: 0 };
      cur.gross += e.gross_salary; cur.net += e.net_salary;
      map.set(d, cur);
    });
    return Array.from(map.entries()).map(([department, v]) => ({ department, ...v }));
  }, [entries, empDept]);

  const dedTypes = [
    { name: "PAYE",    value: entries.reduce((s, e) => s + e.paye, 0) },
    { name: "NSSF",    value: entries.reduce((s, e) => s + e.nssf_employee, 0) },
    { name: "GEPF",    value: entries.reduce((s, e) => s + e.gepf_employee, 0) },
    { name: "Advances",value: entries.reduce((s, e) => s + e.salary_advances, 0) },
    { name: "Cash Sht",value: entries.reduce((s, e) => s + e.cash_shortage, 0) },
    { name: "Missing", value: entries.reduce((s, e) => s + e.deductions_missing_days, 0) },
  ].filter(x => x.value > 0);

  return (
    <PageShell>
      <PageHeader icon={LayoutDashboard} title={`Payroll Dashboard — ${MONTHS[month-1]} ${year}`}
        subtitle={period ? `${entries.length} employees in this period` : "No period for this month"}>
        <MonthCarousel year={year} month={month} onChange={setYM} />
        {period && <StatusBadge status={period.status} />}
      </PageHeader>

      <PageSection card={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={Users}      label="Employees"     value={entries.length} />
          <KPI icon={Wallet}     label="Total Basic"   value={totals.basic} />
          <KPI icon={Coins}      label="Total Gross"   value={totals.gross} />
          <KPI icon={FileText}   label="Total PAYE"    value={totals.paye} />
          <KPI icon={ShieldAlert} label="Total NSSF"   value={totals.nssf} />
          <KPI icon={Banknote}   label="Total Advances" value={totals.adv} />
          <KPI icon={Ban}        label="Total Deductions" value={totals.ded} />
          <KPI icon={Banknote}   label="Net Payable"   value={totals.net} />
        </div>
      </PageSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PageSection card title="Gross Salary by Department">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Bar dataKey="gross" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageSection>

        <PageSection card title="Net Salary by Department">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept}>
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Bar dataKey="net" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageSection>

        <PageSection card title="Deductions by Type">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dedTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {dedTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </PageSection>
      </div>
    </PageShell>
  );
}
