import { useMemo, useState } from "react";
import { FileSpreadsheet, ChevronRight, ChevronDown, Download } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMonthlyReport, type ReportCategory, type ReportGroup } from "@/hooks/use-fin-monthly-report";
import { useCasino } from "@/lib/casino-context";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateOnly } from "@/lib/format-date";
import { downloadXlsx } from "@/lib/excel-export";
import { cn } from "@/lib/utils";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmt = (n: number) => (n ? formatNumberSpaces(n) : "—");
const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—");

const cls = (n: number) => (n < 0 ? "cms-amount-negative" : n > 0 ? "cms-amount-positive" : "text-muted-foreground");

const CASINO_CODE: Record<string, string> = { arusha: "A", mwanza: "M", dodoma: "D", mbeya: "B" };

export default function FinancesMonthlyReportPage() {
  const now = new Date();
  const { accessibleCasinos, activeCasinoId } = useCasino();
  const isPremier = typeof window !== "undefined" && /(?:^|\.)premier\./.test(window.location.hostname);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [ytd, setYtd] = useState(false);
  const [scope, setScope] = useState<string>(activeCasinoId || "");
  const [usdRate, setUsdRate] = useState(2500);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useMonthlyReport({ year, month, ytd, scope: scope || activeCasinoId || "" });

  const toggle = (id: string) => setExpanded((e) => (e === id ? null : id));

  const exportXlsx = async () => {
    if (!data) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 8 }] });
    const scopeName = scope === "network" ? "Network" : (accessibleCasinos.find((c) => c.id === scope)?.name || "");

    // Title block
    ws.mergeCells("A1:K1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `${scopeName} · ${ytd ? "YTD " : ""}${MONTHS[month - 1]} ${year}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center" };

    // Incomes
    ws.getCell("A3").value = "Incomes";
    ws.getCell("A3").font = { bold: true };
    [["Live Game", data.incomes.live_game], ["Slots", data.incomes.slots], ["Other Incomes", data.incomes.other], ["Total in TZS", data.incomes.total]]
      .forEach(([label, v], i) => {
        ws.getCell(`G${4 + i}`).value = label as string;
        ws.getCell(`H${4 + i}`).value = v as number;
        ws.getCell(`H${4 + i}`).numFmt = "# ##0";
        if (label === "Total in TZS") {
          ws.getCell(`G${4 + i}`).font = { bold: true };
          ws.getCell(`H${4 + i}`).font = { bold: true };
        }
      });

    const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } } as const;
    const groupFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } } as const;
    const totalFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as const;

    let r = 10;
    const writeHeader = () => {
      const headers = ["Category", "Plan/Year TZS", "Plan/Year USD", "Plan/Month TZS", "Plan/Month USD", "Actual TZS", "Actual USD", "%", "Remain TZS", "Remain USD", "Remain %"];
      headers.forEach((h, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10 };
        cell.fill = headerFill as any;
        cell.alignment = { horizontal: i === 0 ? "left" : "right" };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
      });
      r++;
    };

    for (const g of data.groups) {
      ws.mergeCells(`A${r}:K${r}`);
      const gc = ws.getCell(`A${r}`);
      gc.value = g.name;
      gc.font = { bold: true, size: 12 };
      gc.fill = groupFill as any;
      r++;
      writeHeader();

      for (const c of g.categories) {
        const remTzs = c.plan_month_tzs - c.actual_tzs;
        const remUsd = c.plan_month_usd - c.actual_usd;
        const pctVal = c.plan_month_tzs ? c.actual_tzs / c.plan_month_tzs : null;
        const remPct = c.plan_month_tzs ? remTzs / c.plan_month_tzs : null;
        const row = ws.getRow(r);
        row.values = [c.name, c.plan_year_tzs, c.plan_year_usd, c.plan_month_tzs, c.plan_month_usd, c.actual_tzs, c.actual_usd, pctVal, remTzs, remUsd, remPct];
        for (let i = 2; i <= 11; i++) {
          const cell = row.getCell(i);
          cell.numFmt = (i === 8 || i === 11) ? "0%" : "# ##0;[Red](# ##0);—";
          cell.alignment = { horizontal: "right" };
        }
        r++;
      }

      // Group total
      const tr = ws.getRow(r);
      tr.values = ["Total", g.totals.plan_year_tzs, g.totals.plan_year_usd, g.totals.plan_month_tzs, g.totals.plan_month_usd, g.totals.actual_tzs, g.totals.actual_usd,
        g.totals.plan_month_tzs ? g.totals.actual_tzs / g.totals.plan_month_tzs : null,
        g.totals.plan_month_tzs - g.totals.actual_tzs, g.totals.plan_month_usd - g.totals.actual_usd,
        g.totals.plan_month_tzs ? (g.totals.plan_month_tzs - g.totals.actual_tzs) / g.totals.plan_month_tzs : null];
      for (let i = 1; i <= 11; i++) {
        const cell = tr.getCell(i);
        cell.font = { bold: true };
        cell.fill = totalFill as any;
        if (i > 1) {
          cell.numFmt = (i === 8 || i === 11) ? "0%" : "# ##0;[Red](# ##0);—";
          cell.alignment = { horizontal: "right" };
        }
      }
      r += 2;
    }

    // Grand total
    ws.mergeCells(`A${r}:K${r}`);
    ws.getCell(`A${r}`).value = "GRAND TOTAL";
    ws.getCell(`A${r}`).font = { bold: true, size: 12 };
    ws.getCell(`A${r}`).fill = totalFill as any;
    r++;
    const gr = ws.getRow(r);
    gr.values = ["", "", "", data.grand.plan_month_tzs, data.grand.plan_month_usd, data.grand.actual_tzs, data.grand.actual_usd,
      data.grand.plan_month_tzs ? data.grand.actual_tzs / data.grand.plan_month_tzs : null,
      data.grand.plan_month_tzs - data.grand.actual_tzs, data.grand.plan_month_usd - data.grand.actual_usd, null];
    for (let i = 4; i <= 11; i++) {
      const cell = gr.getCell(i);
      cell.font = { bold: true };
      cell.numFmt = (i === 8 || i === 11) ? "0%" : "# ##0;[Red](# ##0);—";
      cell.alignment = { horizontal: "right" };
    }

    // Column widths
    ws.getColumn(1).width = 36;
    for (let i = 2; i <= 11; i++) ws.getColumn(i).width = 14;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Monthly_Report_${year}_${String(month).padStart(2, "0")}${ytd ? "_YTD" : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      <PageHeader
        icon={FileSpreadsheet}
        title="Monthly Report"
        subtitle="Plan vs Actual, with drill-down per category"
        belowHeader={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 font-mono" />
            <div className="flex items-center gap-2 ml-2">
              <Switch id="ytd" checked={ytd} onCheckedChange={setYtd} />
              <Label htmlFor="ytd" className="text-xs">YTD</Label>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Label className="text-xs text-muted-foreground">USD rate</Label>
              <Input type="number" value={usdRate} onChange={(e) => setUsdRate(Number(e.target.value))} className="w-24 font-mono" />
            </div>
            <Tabs value={scope || activeCasinoId || ""} onValueChange={setScope} className="ml-auto">
              <TabsList>
                {accessibleCasinos.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>{c.name.replace(/\s*Cloud$/, "")}</TabsTrigger>
                ))}
                {isPremier && <TabsTrigger value="network">Network</TabsTrigger>}
              </TabsList>
            </Tabs>
          </div>
        }
      >
        <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!data}><Download className="w-4 h-4" /> XLSX</Button>
      </PageHeader>

      {/* INCOMES */}
      <PageSection title="Incomes" card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Income label="Live Game" v={data?.incomes.live_game ?? 0} />
          <Income label="Slots" v={data?.incomes.slots ?? 0} />
          <Income label="Other Incomes" v={data?.incomes.other ?? 0} />
          <Income label="Total in TZS" v={data?.incomes.total ?? 0} bold />
        </div>
      </PageSection>

      {/* GROUPS */}
      {isLoading && <div className="text-sm text-muted-foreground text-center py-6">Loading…</div>}
      {data?.groups.map((g) => (
        <GroupTable
          key={g.code}
          group={g}
          expandedId={expanded}
          onToggle={toggle}
          usdRate={usdRate}
          isNetwork={scope === "network"}
        />
      ))}

      {/* GRAND TOTAL */}
      {data && (
        <PageSection title="Grand Total" card>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <Kpi label="Plan Month TZS" v={data.grand.plan_month_tzs} />
            <Kpi label="Actual TZS" v={data.grand.actual_tzs} />
            <Kpi label="Remain TZS" v={data.grand.plan_month_tzs - data.grand.actual_tzs} signed />
            <Kpi label="Expenses USD" v={Math.round(data.grand.actual_tzs / usdRate)} />
            <Kpi
              label="Revenue USD"
              v={Math.round((data.incomes.total - data.grand.actual_tzs) / usdRate)}
              signed
            />
          </div>
        </PageSection>
      )}
    </PageShell>
  );
}

const Income = ({ label, v, bold }: { label: string; v: number; bold?: boolean }) => (
  <div className="rounded-md border border-border p-3">
    <div className="text-xs uppercase text-muted-foreground">{label}</div>
    <div className={cn("font-mono mt-1", bold ? "text-lg font-bold" : "text-base")}>{fmt(v)}</div>
  </div>
);

const Kpi = ({ label, v, signed }: { label: string; v: number; signed?: boolean }) => (
  <div className="rounded-md border border-border p-3">
    <div className="text-xs uppercase text-muted-foreground">{label}</div>
    <div className={cn("font-mono mt-1 text-base font-semibold", signed && cls(v))}>{formatNumberSpaces(v)}</div>
  </div>
);

const GroupTable = ({ group, expandedId, onToggle, usdRate, isNetwork }: {
  group: ReportGroup;
  expandedId: string | null;
  onToggle: (id: string) => void;
  usdRate: number;
  isNetwork: boolean;
}) => {
  return (
    <PageSection title={group.name} card={false}>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-[28%]">Category</th>
              <th className="text-right">Plan/Year TZS</th>
              <th className="text-right">USD</th>
              <th className="text-right">Plan/Month TZS</th>
              <th className="text-right">USD</th>
              <th className="text-right border-l border-border">Actual TZS</th>
              <th className="text-right">USD</th>
              <th className="text-right">%</th>
              <th className="text-right border-l border-border">Remain TZS</th>
              <th className="text-right">USD</th>
              <th className="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {group.categories.map((c) => (
              <Row key={c.id} c={c} expanded={expandedId === c.id} onToggle={() => onToggle(c.id)} usdRate={usdRate} isNetwork={isNetwork} />
            ))}
            <tr className="bg-muted/40 font-semibold border-t-2 border-border">
              <td className="px-3 py-2">Total</td>
              <td className="text-right font-mono">{fmt(group.totals.plan_year_tzs)}</td>
              <td className="text-right font-mono">{fmt(group.totals.plan_year_usd)}</td>
              <td className="text-right font-mono">{fmt(group.totals.plan_month_tzs)}</td>
              <td className="text-right font-mono">{fmt(group.totals.plan_month_usd)}</td>
              <td className="text-right font-mono border-l border-border">{fmt(group.totals.actual_tzs)}</td>
              <td className="text-right font-mono">{fmt(group.totals.actual_usd)}</td>
              <td className="text-right font-mono">{group.totals.plan_month_tzs ? pct(group.totals.actual_tzs / group.totals.plan_month_tzs) : "—"}</td>
              <td className={cn("text-right font-mono border-l border-border", cls(group.totals.plan_month_tzs - group.totals.actual_tzs))}>{fmt(group.totals.plan_month_tzs - group.totals.actual_tzs)}</td>
              <td className={cn("text-right font-mono", cls(group.totals.plan_month_usd - group.totals.actual_usd))}>{fmt(group.totals.plan_month_usd - group.totals.actual_usd)}</td>
              <td className="text-right font-mono pr-3">{group.totals.plan_month_tzs ? pct((group.totals.plan_month_tzs - group.totals.actual_tzs) / group.totals.plan_month_tzs) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageSection>
  );
};

const Row = ({ c, expanded, onToggle, usdRate, isNetwork }: {
  c: ReportCategory; expanded: boolean; onToggle: () => void; usdRate: number; isNetwork: boolean;
}) => {
  const remTzs = c.plan_month_tzs - c.actual_tzs;
  const remUsd = c.plan_month_usd - c.actual_usd;
  return (
    <>
      <tr className={cn("border-t border-border hover:bg-muted/30 cursor-pointer", expanded && "bg-muted/30")} onClick={onToggle}>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{c.name}</span>
            {c.expenses.length > 0 && <span className="text-[10px] text-muted-foreground">({c.expenses.length})</span>}
          </div>
        </td>
        <td className="text-right font-mono">{fmt(c.plan_year_tzs)}</td>
        <td className="text-right font-mono">{fmt(c.plan_year_usd)}</td>
        <td className="text-right font-mono">{fmt(c.plan_month_tzs)}</td>
        <td className="text-right font-mono">{fmt(c.plan_month_usd)}</td>
        <td className="text-right font-mono border-l border-border">{fmt(c.actual_tzs)}</td>
        <td className="text-right font-mono">{fmt(c.actual_usd)}</td>
        <td className="text-right font-mono">{c.plan_month_tzs ? pct(c.actual_tzs / c.plan_month_tzs) : "—"}</td>
        <td className={cn("text-right font-mono border-l border-border", cls(remTzs))}>{fmt(remTzs)}</td>
        <td className={cn("text-right font-mono", cls(remUsd))}>{fmt(remUsd)}</td>
        <td className="text-right font-mono pr-3">{c.plan_month_tzs ? pct(remTzs / c.plan_month_tzs) : "—"}</td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={11} className="px-4 py-3">
            {c.expenses.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">No expenses recorded</div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-background text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-24">Date</th>
                      {isNetwork && <th className="text-left w-14">Casino</th>}
                      <th className="text-left">Description</th>
                      <th className="text-left w-32">Wallet</th>
                      <th className="text-right w-32">Amount</th>
                      <th className="text-right w-24">CCY</th>
                      <th className="text-right w-32">TZS</th>
                      <th className="text-right w-28 pr-2">USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.expenses.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-2 py-1 font-mono">{fmtDateOnly(e.business_date)}</td>
                        {isNetwork && <td className="font-mono">{CASINO_CODE[e.casino_slug || ""] || (e.casino_slug || "").slice(0, 3).toUpperCase()}</td>}
                        <td className="text-foreground">{e.description || <span className="text-muted-foreground italic">—</span>}</td>
                        <td className="text-muted-foreground">{e.wallet_name || "—"}</td>
                        <td className="text-right font-mono">{formatNumberSpaces(e.amount)}</td>
                        <td className="text-right font-mono">{e.currency}</td>
                        <td className="text-right font-mono">{formatNumberSpaces(e.amount_tzs)}</td>
                        <td className="text-right font-mono pr-2">{formatNumberSpaces(Math.round(e.amount_tzs / (usdRate || 1)))}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-2 py-1" colSpan={isNetwork ? 6 : 5}>Total · {c.expenses.length}</td>
                      <td className="text-right font-mono">{formatNumberSpaces(c.actual_tzs)}</td>
                      <td className="text-right font-mono pr-2">{formatNumberSpaces(Math.round(c.actual_tzs / (usdRate || 1)))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};
