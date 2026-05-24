/**
 * ClubPokerTipsTab — one row per day with day total + month period total.
 */
import { ReactNode, useMemo, useState } from "react";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { fmtDateOnly } from "@/lib/format-date";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { useTipsByRange } from "@/hooks/use-tips";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TipsLedgerTable } from "./TipsLedgerTable";

export default function ClubPokerTipsTab({ belowHeader }: { belowHeader?: ReactNode }) {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const monthStart = useMemo(() => format(startOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const monthEnd = useMemo(() => format(endOfMonth(anchor), "yyyy-MM-dd"), [anchor]);
  const { data: rows = [] } = useTipsByRange("tips_poker", monthStart, monthEnd);

  const monthTotal = useMemo(() => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [rows]);

  return (
    <PageShell>
      <PageHeader
        icon={Coins}
        title="Club Poker Tips"
        subtitle="Per-employee Club Poker tips"
        centerSlot={<div className="text-center"><div className="text-[11px] uppercase text-muted-foreground">Month Total</div><div className="font-mono text-lg font-bold">{formatCurrency(monthTotal)}</div></div>}
        belowHeader={belowHeader}
      >
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={() => setAnchor(d => subMonths(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-mono px-2 min-w-[160px] text-center">
            {fmtDateOnly(monthStart)} – {fmtDateOnly(monthEnd)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(d => addMonths(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </PageHeader>
      <PageSection card={false}>
        <TipsLedgerTable rows={rows} emptyMessage="No Club Poker tips this month" fallbackEmployee="Unknown" />
      </PageSection>
    </PageShell>
  );
}
