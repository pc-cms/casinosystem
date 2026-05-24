/**
 * LiveGameTipsTab — read-only list of Live Game tips collected by cashier.
 * Records: date · time · chip breakdown by denomination · amount.
 * Grouped by day with subtotals. Period = 16th of previous month → 15th of
 * current month (same window as Monthly Tips), so the Monthly Tips "collected"
 * hint matches the Period Total shown here.
 */
import { ReactNode, useMemo, useState } from "react";
import { Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtDateOnly } from "@/lib/format-date";
import { useTipsByRange } from "@/hooks/use-tips";
import { getPeriodStart16, getPeriodEnd15, addMonthsPeriod } from "@/hooks/use-monthly-tips";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TipsLedgerTable } from "./TipsLedgerTable";

export default function LiveGameTipsTab({ belowHeader }: { belowHeader?: ReactNode }) {
  const [periodStart, setPeriodStart] = useState<string>(() => getPeriodStart16(new Date()));
  const periodEnd = useMemo(() => getPeriodEnd15(periodStart), [periodStart]);
  const { data: rows = [] } = useTipsByRange("tips_live", periodStart, periodEnd);

  const periodTotal = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [rows]);

  return (
    <PageShell>
      <PageHeader
        icon={Gift}
        title="Live Game Tips"
        subtitle="Cashier-recorded chip tips · dealer pool"
        centerSlot={<div className="text-center"><div className="text-[11px] uppercase text-muted-foreground">Period Total</div><div className="font-mono text-lg font-bold">{formatCurrency(periodTotal)}</div></div>}
        belowHeader={belowHeader}
      >
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={() => setPeriodStart(p => addMonthsPeriod(p, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-mono px-2 min-w-[230px] text-center">
            {fmtDateOnly(periodStart)} – {fmtDateOnly(periodEnd)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setPeriodStart(p => addMonthsPeriod(p, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </PageHeader>
      <PageSection card={false}>
        <TipsLedgerTable rows={rows} emptyMessage="No Live Game tips this period" fallbackEmployee="Live Game Pool" />
      </PageSection>
    </PageShell>
  );
}
