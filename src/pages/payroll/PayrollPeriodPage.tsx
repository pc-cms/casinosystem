import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wallet, CheckCircle2, Lock, Unlock, FileSpreadsheet, Printer, History } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import {
  usePayrollPeriod, usePayrollEntries, useUpdatePayrollEntry,
  useApproveHR, useApproveManager, useRevertToDraft, useUnlockPeriod,
  usePayrollAuditLog, useEmployees,
  type PayrollEntry,
} from "@/hooks/use-payroll";
import {
  exportBankCsv, exportNssfReport, exportPayeReport, exportSdlReport,
  exportWcfReport, exportJournal, exportSalarySlipsPrint, exportSingleSalarySlip,
  type BankFormat,
} from "@/lib/payroll-exports";
import { fmtDateTime } from "@/lib/format-date";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n).replace(/,/g, " ");

const PayrollPeriodPage = () => {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { roles } = useAuth();
  const isHR = roles.includes("hr") || roles.includes("super_admin");
  const isFinance = roles.includes("finance_manager") || roles.includes("super_admin");
  const isSuper = roles.includes("super_admin");

  const { data: period } = usePayrollPeriod(id);
  const { data: entries = [], isLoading } = usePayrollEntries(id);

  const approveHR = useApproveHR();
  const approveMgr = useApproveManager();
  const revert = useRevertToDraft();
  const unlock = useUnlockPeriod();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  if (!period) {
    return <div className="p-6 text-sm text-muted-foreground">Loading period…</div>;
  }

  const isDraft = period.status === "draft";
  const isHrApproved = period.status === "hr_approved";
  const isLocked = period.status === "locked";
  const canEdit = isDraft && isHR;
  const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`;

  return (
    <PageShell>
      <PageHeader
        icon={Wallet}
        title={`Payroll — ${periodLabel}`}
        subtitle={`Status: ${period.status.replace("_", " ")}`}
      >
        <Button size="sm" variant="ghost" onClick={() => nav("/payroll")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </PageHeader>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Employee Payroll</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="slips">Salary Slips</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <PageSection card={false}>
            {isLoading ? (
              <div className="text-sm text-muted-foreground p-4">Loading…</div>
            ) : (
              <EntriesGrid entries={entries} canEdit={canEdit} period={period} />
            )}
          </PageSection>
        </TabsContent>

        <TabsContent value="taxes">
          <TaxesPanel entries={entries} />
        </TabsContent>

        <TabsContent value="slips">
          <SlipsPanel entries={entries} period={period} periodLabel={periodLabel} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditPanel periodId={period.id} />
        </TabsContent>
      </Tabs>

      {/* APPROVAL & EXPORT BAR */}
      <PageSection card title="Workflow">
        <div className="flex flex-wrap gap-2 items-center">
          {isDraft && isHR && (
            <Button onClick={() => approveHR.mutate({ periodId: period.id })}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> HR Approve
            </Button>
          )}
          {isHrApproved && isFinance && (
            <>
              <Button onClick={() => approveMgr.mutate({ periodId: period.id })}>
                <Lock className="w-4 h-4 mr-1" /> Manager Approve & Lock
              </Button>
              <Button variant="outline" onClick={() => revert.mutate({ periodId: period.id, reason: "revert" })}>
                Revert to Draft
              </Button>
            </>
          )}
          {isLocked && isSuper && (
            <Button variant="outline" onClick={() => setUnlockOpen(true)}>
              <Unlock className="w-4 h-4 mr-1" /> Unlock (Super Admin)
            </Button>
          )}

          {isLocked && (
            <>
              <div className="w-full mt-2 text-xs text-muted-foreground uppercase tracking-wider">Exports</div>
              <BankExportButton entries={entries} period={period} />
              <Button size="sm" variant="outline" onClick={() => exportSalarySlipsPrint(entries, period)}>
                <Printer className="w-4 h-4 mr-1" /> Salary Slips PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportNssfReport(entries, period)}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> NSSF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportPayeReport(entries, period)}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> PAYE
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportSdlReport(entries, period)}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> SDL
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportWcfReport(entries, period)}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> WCF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportJournal(entries, period)}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Journal
              </Button>
            </>
          )}
        </div>
      </PageSection>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unlock Period</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">A reason is required and will be logged.</p>
            <Input value={unlockReason} onChange={e => setUnlockReason(e.target.value)} placeholder="Reason for unlock" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!unlockReason.trim()) return;
              await unlock.mutateAsync({ periodId: period.id, reason: unlockReason });
              setUnlockOpen(false); setUnlockReason("");
            }}>Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

const NUMERIC_INPUT_FIELDS = [
  ["public_holiday_worked", "PH Worked"],
  ["hrs_worked_on_holiday", "Hrs Hol"],
  ["night_days", "Night Days"],
  ["off_days_hours", "OD Hrs"],
  ["missing_days", "Missing"],
  ["cash_shortage", "Cash Short"],
  ["salary_advances", "Advances"],
  ["gepf_loan", "GEPF Loan"],
] as const;

const EntriesGrid = ({ entries, canEdit }: { entries: PayrollEntry[]; canEdit: boolean }) => {
  const update = useUpdatePayrollEntry();
  const [draft, setDraft] = useState<Record<string, Partial<PayrollEntry>>>({});

  const onChange = (id: string, field: string, val: number) => {
    setDraft(d => ({ ...d, [id]: { ...d[id], [field]: val } }));
  };
  const onBlur = (id: string, field: string) => {
    const val = draft[id]?.[field as keyof PayrollEntry];
    if (val === undefined) return;
    update.mutate({ id, [field]: val } as any);
  };

  return (
    <DataTable>
      <DTHead>
        <DTRow>
          <DTHeader>Employee</DTHeader>
          <DTHeader align="right">Basic</DTHeader>
          {NUMERIC_INPUT_FIELDS.map(([k, l]) => <DTHeader key={k} align="right">{l}</DTHeader>)}
          <DTHeader align="right">Gross</DTHeader>
          <DTHeader align="right">PAYE</DTHeader>
          <DTHeader align="right">NSSF</DTHeader>
          <DTHeader align="right">GEPF</DTHeader>
          <DTHeader align="right">NET</DTHeader>
        </DTRow>
      </DTHead>
      <DTBody>
        {entries.length === 0 && (
          <DTRow><DTCell colSpan={14} className="text-center text-muted-foreground py-8">No employees in this period</DTCell></DTRow>
        )}
        {entries.map(e => (
          <DTRow key={e.id}>
            <DTCell className="font-medium">{e.snapshot_full_name}</DTCell>
            <DTCell numeric>{fmt(e.snapshot_basic_salary)}</DTCell>
            {NUMERIC_INPUT_FIELDS.map(([k]) => {
              const cur = draft[e.id]?.[k as keyof PayrollEntry] ?? (e[k as keyof PayrollEntry] as number);
              return (
                <DTCell key={k} numeric>
                  {canEdit ? (
                    <input
                      type="number"
                      value={cur as number}
                      onChange={ev => onChange(e.id, k, Number(ev.target.value) || 0)}
                      onBlur={() => onBlur(e.id, k)}
                      className="w-20 h-7 px-1 text-right font-mono text-xs bg-transparent border border-border rounded focus:outline-none focus:border-primary"
                    />
                  ) : <span className="font-mono text-xs">{fmt(cur as number)}</span>}
                </DTCell>
              );
            })}
            <DTCell numeric className="font-semibold">{fmt(e.gross_salary)}</DTCell>
            <DTCell numeric>{fmt(e.paye)}</DTCell>
            <DTCell numeric>{fmt(e.nssf_employee)}</DTCell>
            <DTCell numeric>{fmt(e.gepf_employee)}</DTCell>
            <DTCell numeric className="font-bold text-emerald-700 dark:text-emerald-400">{fmt(e.net_salary)}</DTCell>
          </DTRow>
        ))}
      </DTBody>
    </DataTable>
  );
};

const TaxesPanel = ({ entries }: { entries: PayrollEntry[] }) => {
  const tot = entries.reduce((a, e) => ({
    nssf_e: a.nssf_e + e.nssf_employee, nssf_er: a.nssf_er + e.nssf_employer,
    paye: a.paye + e.paye, sdl: a.sdl + e.sdl_amount, wcf: a.wcf + e.wcf_amount, gross: a.gross + e.gross_salary,
  }), { nssf_e: 0, nssf_er: 0, paye: 0, sdl: 0, wcf: 0, gross: 0 });
  const cards: [string, number, string][] = [
    ["NSSF Employee 10%", tot.nssf_e, "Deducted from employees"],
    ["NSSF Employer 10%", tot.nssf_er, "Paid by company"],
    ["PAYE", tot.paye, "Income tax (TRA)"],
    ["SDL 3.5%", tot.sdl, "Skills Development Levy"],
    ["WCF 1%", tot.wcf, "Workers Compensation Fund"],
    ["Gross Salaries", tot.gross, "Sum of all gross pay"],
  ];
  return (
    <PageSection card={false}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([title, value, sub]) => (
          <div key={title} className="rounded-md border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold font-mono mt-1">{fmt(value)}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>
    </PageSection>
  );
};

const SlipsPanel = ({ entries, periodLabel }: { entries: PayrollEntry[]; periodLabel: string }) => (
  <PageSection card={false}>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {entries.map(e => (
        <div key={e.id} className="rounded-md border border-border bg-card p-4">
          <div className="font-semibold">{e.snapshot_full_name}</div>
          <div className="text-xs text-muted-foreground">{e.snapshot_position} · {periodLabel}</div>
          <table className="w-full text-xs mt-3 font-mono">
            <tbody>
              <tr><td className="text-muted-foreground">Basic</td><td className="text-right">{fmt(e.snapshot_basic_salary)}</td></tr>
              <tr><td className="text-muted-foreground">Gross</td><td className="text-right">{fmt(e.gross_salary)}</td></tr>
              <tr><td className="text-muted-foreground">PAYE</td><td className="text-right">({fmt(e.paye)})</td></tr>
              <tr><td className="text-muted-foreground">NSSF</td><td className="text-right">({fmt(e.nssf_employee)})</td></tr>
              <tr><td className="text-muted-foreground">GEPF</td><td className="text-right">({fmt(e.gepf_employee)})</td></tr>
              <tr><td className="font-semibold pt-1">NET</td><td className="text-right font-bold pt-1">{fmt(e.net_salary)}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  </PageSection>
);

const BankExportButton = ({ entries, period }: any) => {
  const [open, setOpen] = useState(false);
  const [fmtSel, setFmtSel] = useState<BankFormat>("default");
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="w-4 h-4 mr-1" /> Bank CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Export Bank CSV</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <label className="block text-sm">
              <input type="radio" name="bf" checked={fmtSel === "default"} onChange={() => setFmtSel("default")} className="mr-2" />
              BANK1 default (ID, NAME, ACCOUNT, AMOUNT, BANK, BRANCH, DESCRIPTION)
            </label>
            <label className="block text-sm">
              <input type="radio" name="bf" checked={fmtSel === "crdb"} onChange={() => setFmtSel("crdb")} className="mr-2" />
              CRDB (CRDB_SALARY_&lt;MONTH&gt;_&lt;YEAR&gt;.csv)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { exportBankCsv(entries, period, fmtSel); setOpen(false); }}>Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PayrollPeriodPage;
