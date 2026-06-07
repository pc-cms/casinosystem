import { useMemo, useState } from "react";
import { BarChart3, AlertTriangle, X, Download } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { YearSelect } from "@/components/ui/year-select";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FinanceCasinoSwitcher from "@/components/finances/FinanceCasinoSwitcher";
import { useFinBudget, useFinExpenses, useFinCategories } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";
import ExcelJS from "exceljs";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FinancesBudgetVsActualPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [drill, setDrill] = useState<{ catId: string; catName: string; month: number | null } | null>(null);
  const { data: categories = [] } = useFinCategories();
  const { data: budget = [] } = useFinBudget(year);
  const { data: expenses = [] } = useFinExpenses({
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });

  const actual = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    expenses.forEach((e: any) => {
      if (e.voided_at || !e.fin_category_id) return;
      const mo = new Date(e.business_date).getMonth() + 1;
      m[e.fin_category_id] = m[e.fin_category_id] || {};
      m[e.fin_category_id][mo] = (m[e.fin_category_id][mo] || 0) + Number(e.amount_tzs || e.amount || 0);
    });
    return m;
  }, [expenses]);

  const planned = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    (budget || []).forEach((b: any) => {
      m[b.category_id] = m[b.category_id] || {};
      m[b.category_id][b.month] = (m[b.category_id][b.month] || 0) + Number(b.planned_amount || 0);
    });
    return m;
  }, [budget]);

  const expenseCats = useMemo(() => categories.filter((c: any) => !c.is_income), [categories]);

  const overrunCount = useMemo(() => {
    let n = 0;
    expenseCats.forEach((c: any) => {
      for (let mo = 1; mo <= 12; mo++) {
        const p = planned[c.id]?.[mo] || 0;
        const a = actual[c.id]?.[mo] || 0;
        if (p > 0 && a > p) n++;
      }
    });
    return n;
  }, [expenseCats, planned, actual]);

  const drillRows = useMemo(() => {
    if (!drill) return [];
    return expenses.filter((e: any) => {
      if (e.voided_at || e.fin_category_id !== drill.catId) return false;
      if (drill.month !== null) {
        const mo = new Date(e.business_date).getMonth() + 1;
        if (mo !== drill.month) return false;
      }
      return true;
    });
  }, [drill, expenses]);

  const drillTotal = drillRows.reduce((s: number, r: any) => s + Number(r.amount_tzs || r.amount || 0), 0);

  const exportXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Budget vs Actual ${year}`);
    const header = ["Category"];
    MONTHS.forEach((m) => { header.push(`${m} Plan`); header.push(`${m} Actual`); });
    header.push("YTD Plan", "YTD Actual", "YTD %");
    ws.addRow(header);
    ws.getRow(1).font = { bold: true };
    expenseCats.forEach((c: any) => {
      const row: any[] = [c.name];
      let ytdP = 0, ytdA = 0;
      for (let mo = 1; mo <= 12; mo++) {
        const p = planned[c.id]?.[mo] || 0;
        const a = actual[c.id]?.[mo] || 0;
        ytdP += p; ytdA += a;
        row.push(p, a);
      }
      row.push(ytdP, ytdA, ytdP > 0 ? ytdA / ytdP : 0);
      const r = ws.addRow(row);
      for (let i = 2; i <= 25; i++) r.getCell(i).numFmt = "# ##0;[Red](# ##0);-";
      r.getCell(26).numFmt = "0.0%";
    });
    ws.columns.forEach((col, i) => { col.width = i === 0 ? 32 : 14; });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = `budget-vs-actual-${year}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      <PageHeader icon={BarChart3} title="Budget vs Actual" subtitle="Per category, monthly variance · click cell to drill">
        <div className="flex items-center gap-2">
          <FinanceCasinoSwitcher />
          {overrunCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {overrunCount} overrun{overrunCount === 1 ? "" : "s"}
            </Badge>
          )}
          <YearSelect value={year} onChange={setYear} />
          <Button size="sm" variant="outline" onClick={exportXlsx}>
            <Download className="w-3.5 h-3.5 mr-1" />XLSX
          </Button>
        </div>
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-auto max-h-[75vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">Category</th>
                {MONTHS.map(m => <th key={m} className="text-right px-1.5">{m}</th>)}
                <th className="text-right px-2">YTD</th>
              </tr>
            </thead>
            <tbody>
              {expenseCats.map((c: any) => {
                let ytdP = 0, ytdA = 0;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td
                      className="px-2 py-1 cursor-pointer hover:text-primary"
                      onClick={() => setDrill({ catId: c.id, catName: c.name, month: null })}
                    >
                      {c.name}
                    </td>
                    {MONTHS.map((_, i) => {
                      const p = planned[c.id]?.[i + 1] || 0;
                      const a = actual[c.id]?.[i + 1] || 0;
                      ytdP += p; ytdA += a;
                      const ratio = p > 0 ? a / p : 0;
                      const over = p > 0 && a > p;
                      const warn = p > 0 && ratio >= 0.9 && ratio < 1;
                      const hasData = p > 0 || a > 0;
                      return (
                        <td
                          key={i}
                          className={`px-1 text-right font-mono ${hasData ? "cursor-pointer hover:bg-muted/50" : ""} ${over ? "bg-destructive/10" : warn ? "bg-amber-500/10" : ""}`}
                          onClick={() => hasData && setDrill({ catId: c.id, catName: c.name, month: i + 1 })}
                          title={p > 0 ? `${(ratio * 100).toFixed(0)}% of plan` : undefined}
                        >
                          <div className="text-[10px] text-muted-foreground">{p ? formatNumberSpaces(p) : "·"}</div>
                          <div className={over ? "cms-amount-negative font-semibold" : ""}>{a ? formatNumberSpaces(a) : "·"}</div>
                        </td>
                      );
                    })}
                    <td className="px-2 text-right font-mono">
                      <div className="text-[10px] text-muted-foreground">{formatNumberSpaces(ytdP)}</div>
                      <div className={ytdA > ytdP ? "cms-amount-negative font-semibold" : ""}>{formatNumberSpaces(ytdA)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {drill?.catName} · {drill?.month !== null ? MONTHS[(drill?.month || 1) - 1] : "YTD"} {year}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-md border border-border overflow-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Wallet</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Amount TZS</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-1 font-mono">{fmtDate(r.business_date)}</td>
                    <td className="px-3 py-1">{r.fin_wallets?.name || "—"}</td>
                    <td className="px-3 py-1">{r.description || "—"}</td>
                    <td className="px-3 py-1 text-right font-mono">{formatNumberSpaces(Number(r.amount_tzs || r.amount || 0))}</td>
                  </tr>
                ))}
                {!drillRows.length && (
                  <tr><td colSpan={4} className="text-center text-muted-foreground py-6">No transactions</td></tr>
                )}
              </tbody>
              {drillRows.length > 0 && (
                <tfoot className="bg-muted sticky bottom-0">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total ({drillRows.length})</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatNumberSpaces(drillTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
