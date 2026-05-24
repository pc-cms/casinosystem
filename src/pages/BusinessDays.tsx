import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Clock, User } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, fmtDateOnly } from "@/lib/format-date";
import { useBusinessDayHistory } from "@/hooks/use-business-day-history";
import { ClosureDetail } from "@/components/business-days/ClosureDetail";
import CasinoBadge from "@/components/player/CasinoBadge";
import { useCasino } from "@/lib/casino-context";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const BusinessDays = () => {
  const [month, setMonth] = useState(currentMonth());
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: closures = [], isLoading } = useBusinessDayHistory(month);
  const { isSummaryMode } = useCasino();

  return (
    <PageShell>
      <PageHeader
        icon={CalendarDays}
        title="Business Days"
        subtitle="History of closed business days. Edits are audited."
      />

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-muted-foreground">Month</label>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {closures.length} closure{closures.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : closures.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No business days closed in this month.
        </p>
      ) : (
        <div className="space-y-2">
          {closures.map((c) => {
            const isOpen = openId === c.id;
            return (
              <Card key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  className="w-full text-left"
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <div className="font-mono text-sm font-semibold w-28">{fmtDateOnly(c.business_date)}</div>
                    {isSummaryMode && <CasinoBadge casinoId={c.casino_id} />}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {fmtDateTime(c.closed_at)}
                    </div>
                    <Badge variant={c.closed_method === "manual" ? "default" : "secondary"} className="text-[10px]">
                      {c.closed_method}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                      <User className="w-3 h-3" />
                      {c.closed_by ? c.closed_by.slice(0, 8) : "system"}
                    </div>
                  </CardContent>
                </button>
                {isOpen && (
                  <CardContent className="pt-0 pb-3 px-3 border-t">
                    <ClosureDetail closure={c} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
};

export default BusinessDays;
