/**
 * Bank Export page — month-paginated; only available for Approved/Paid periods.
 * Validates: missing account, duplicate account, zero salary, negative salary.
 */
import { useMemo, useState } from "react";
import { Banknote, Download, AlertTriangle } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MonthCarousel, useMonthFromUrl, MONTHS, StatusBadge } from "@/components/payroll/MonthCarousel";
import { usePeriodForMonth, useBankExport, useUpdatePeriodMeta, useLatestPayrollSettings } from "@/hooks/use-payroll";
import { downloadXlsx } from "@/lib/excel-export";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n).replace(/,/g, " ");

const WARN_LABEL: Record<string, string> = {
  missing_account: "No account",
  negative_salary: "Negative",
  zero_salary: "Zero",
  duplicate_account: "Duplicate account",
};
const WARN_TONE: Record<string, string> = {
  missing_account: "bg-destructive/10 text-destructive",
  negative_salary: "bg-destructive/10 text-destructive",
  zero_salary: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  duplicate_account: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export default function PayrollBankExportPage() {
  const { year, month, setYM } = useMonthFromUrl();
  const { data: period } = usePeriodForMonth(year, month);
  const { data: rows = [] } = useBankExport(period?.id);
  const { data: settings } = useLatestPayrollSettings();
  const updateMeta = useUpdatePeriodMeta();

  const defaultDesc = (settings?.default_payment_description || `SALARY ${MONTHS[month - 1].toUpperCase()} ${year}`)
    .replace("{MONTH}", MONTHS[month - 1].toUpperCase()).replace("{YEAR}", String(year));
  const [desc, setDesc] = useState<string>("");
  const description = (period?.payment_description ?? "").trim() || desc || defaultDesc;
  const [includeWarnings, setIncludeWarnings] = useState(false);

  const blocked = rows.filter(r => r.warning === "missing_account" || r.warning === "negative_salary");
  const warnings = rows.filter(r => r.warning && !blocked.includes(r));
  const exportable = useMemo(() => {
    return rows.filter(r => {
      if (r.warning === "missing_account" || r.warning === "negative_salary") return false;
      if (!includeWarnings && r.warning) return false;
      return r.amount > 0;
    });
  }, [rows, includeWarnings]);

  const isApprovedOrPaid = period && (period.status === "locked" || period.status === "paid");

  const exportFile = (kind: "csv" | "xlsx") => {
    if (!period) return;
    const header = ["ID","NAME","ACCOUNT NUMBER","AMOUNT","BANK","BRANCH","DESCRIPTION"];
    const data: (string|number)[][] = [header, ...exportable.map((r, i) => [
      i + 1, r.name, r.account_number, r.amount, r.bank_code, r.branch_code, description,
    ])];
    const fname = `BANK_SALARY_${MONTHS[month-1]}_${year}`;
    if (kind === "xlsx") {
      downloadXlsx(`${fname}.xlsx`, [{ name: "BANK", rows: data }]);
    } else {
      const csv = data.map(r => r.map(c => {
        const s = String(c ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${fname}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <PageShell>
      <PageHeader icon={Banknote} title="Bank Payment Export"
        subtitle={period ? `${rows.length} entries · ${blocked.length} blocked · ${warnings.length} warnings` : "Pick a month with an Approved or Paid payroll period"}>
        <MonthCarousel year={year} month={month} onChange={setYM} />
        {period && <StatusBadge status={period.status} />}
      </PageHeader>

      {!period && <PageSection card><p className="text-sm text-muted-foreground">No payroll period for {MONTHS[month-1]} {year}. Create one in Payroll → Periods.</p></PageSection>}

      {period && !isApprovedOrPaid && (
        <PageSection card>
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Period is <b>{period.status}</b>. Bank export is only available once Approved.
          </p>
        </PageSection>
      )}

      {period && isApprovedOrPaid && (
        <>
          <PageSection card title="Payment Description">
            <div className="flex gap-2 items-center">
              <Input className="max-w-md" value={period.payment_description ?? desc}
                placeholder={defaultDesc}
                onChange={e => setDesc(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => updateMeta.mutate({ id: period.id, payment_description: desc || defaultDesc })}>
                Save
              </Button>
              <div className="ml-auto flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={includeWarnings} onCheckedChange={v => setIncludeWarnings(!!v)} />
                  Include warning rows
                </label>
                <Button size="sm" onClick={() => exportFile("csv")}><Download className="w-4 h-4 mr-1" /> CSV</Button>
                <Button size="sm" variant="outline" onClick={() => exportFile("xlsx")}><Download className="w-4 h-4 mr-1" /> Excel</Button>
              </div>
            </div>
          </PageSection>

          <PageSection card={false}>
            <DataTable>
              <DTHead>
                <DTRow>
                  <DTHeader>#</DTHeader>
                  <DTHeader>Name</DTHeader>
                  <DTHeader>Account</DTHeader>
                  <DTHeader>Bank</DTHeader>
                  <DTHeader>Branch</DTHeader>
                  <DTHeader align="right">Amount</DTHeader>
                  <DTHeader>Status</DTHeader>
                </DTRow>
              </DTHead>
              <DTBody>
                {rows.map((r, i) => (
                  <DTRow key={r.id} className={r.warning ? WARN_TONE[r.warning] : undefined}>
                    <DTCell>{i + 1}</DTCell>
                    <DTCell className="font-medium">{r.name}</DTCell>
                    <DTCell className="font-mono text-xs">{r.account_number || "—"}</DTCell>
                    <DTCell className="font-mono text-xs">{r.bank_code || "—"}</DTCell>
                    <DTCell className="font-mono text-xs">{r.branch_code || "—"}</DTCell>
                    <DTCell numeric>{fmt(r.amount)}</DTCell>
                    <DTCell>
                      {r.warning ? (
                        <span className="text-xs font-medium">{WARN_LABEL[r.warning]}</span>
                      ) : (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400">OK</span>
                      )}
                    </DTCell>
                  </DTRow>
                ))}
              </DTBody>
            </DataTable>
          </PageSection>
        </>
      )}
    </PageShell>
  );
}
