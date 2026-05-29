import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatChipLabel, formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import ChipToken from "@/components/ChipToken";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtDateOnly } from "@/lib/format-date";

// Denominations sorted descending (largest → smallest), per project rule.
const DENOMS_DESC = [...CHIP_DENOMS].sort((a, b) => b - a);

interface ShiftMissRow {
  business_date: string; // EAT date derived from opened_at
  opened_at: string;
  closed_at: string | null;
  by_denom: Record<number, number>;
  total_tzs: number;
}

// EAT business date = (opened_at - 5h)::date, where business day rolls at 05:00 EAT.
const eatBusinessDate = (iso: string): string => {
  const t = new Date(iso).getTime() - 3 * 3600 * 1000 - 5 * 3600 * 1000;
  return new Date(t).toISOString().slice(0, 10);
};

const MissChips = () => {
  const { casinoId } = useAuth();
  const today = new Date();
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));

  const monthLabel = format(monthAnchor, "MMMM yyyy");
  const fromIso = `${format(startOfMonth(monthAnchor), "yyyy-MM-dd")}T02:00:00Z`;
  // include shifts opened up to next month's 02:00 UTC of day 1+1
  const nextStart = startOfMonth(addMonths(monthAnchor, 1));
  const toIso = `${format(nextStart, "yyyy-MM-dd")}T02:00:00Z`;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["miss-chips-daily", casinoId, fromIso, toIso],
    queryFn: async (): Promise<ShiftMissRow[]> => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("shifts")
        .select("opened_at, closed_at, closing_count")
        .eq("casino_id", casinoId)
        .eq("status", "closed")
        .gte("opened_at", fromIso)
        .lt("opened_at", toIso)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s: any) => {
        const cc = s.closing_count || {};
        const by = (cc.chip_miss_by_denom || {}) as Record<string, number>;
        const byDenom: Record<number, number> = {};
        Object.entries(by).forEach(([d, q]) => {
          const dn = Number(d);
          const qn = Number(q);
          if (dn) byDenom[dn] = (byDenom[dn] || 0) + qn;
        });
        return {
          business_date: eatBusinessDate(s.opened_at),
          opened_at: s.opened_at,
          closed_at: s.closed_at,
          by_denom: byDenom,
          total_tzs: Number(cc.chip_miss_total ?? 0),
        };
      });
    },
    enabled: !!casinoId,
  });

  // Aggregate per business_date (multiple shifts on same day → summed)
  const dailyRows = useMemo(() => {
    const m = new Map<string, ShiftMissRow>();
    rows.forEach((r) => {
      const ex = m.get(r.business_date);
      if (!ex) {
        m.set(r.business_date, {
          ...r,
          by_denom: { ...r.by_denom },
        });
      } else {
        Object.entries(r.by_denom).forEach(([d, q]) => {
          const dn = Number(d);
          ex.by_denom[dn] = (ex.by_denom[dn] || 0) + q;
        });
        ex.total_tzs += r.total_tzs;
      }
    });
    return Array.from(m.values()).sort((a, b) => b.business_date.localeCompare(a.business_date));
  }, [rows]);

  const monthSum = useMemo(() => {
    const by: Record<number, number> = {};
    let total = 0;
    dailyRows.forEach((r) => {
      DENOMS_DESC.forEach((d) => {
        if (r.by_denom[d]) by[d] = (by[d] || 0) + r.by_denom[d];
      });
      total += r.total_tzs;
    });
    return { by, total };
  }, [dailyRows]);

  const goPrev = () => setMonthAnchor((d) => startOfMonth(subMonths(d, 1)));
  const goNext = () => setMonthAnchor((d) => startOfMonth(addMonths(d, 1)));
  const goCurrent = () => setMonthAnchor(startOfMonth(today));
  const nextDisabled = monthAnchor >= startOfMonth(today);

  const cellClass = (v: number) =>
    cn(
      "px-2 py-1 whitespace-nowrap text-center",
      v > 0 ? "text-success" : v < 0 ? "text-danger" : "text-muted-foreground"
    );

  return (
    <div className="container mx-auto p-4 space-y-3 max-w-[1600px]">
      <PageHeader
        icon={Coins}
        title="Miss Chips"
        subtitle={`Daily cage chip count delta · ${monthLabel}`}
        date
        centerSlot={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 font-mono min-w-[140px]"
              onClick={goCurrent}
            >
              {monthLabel}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goNext}
              disabled={nextDisabled}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <span
          className={cn(
            "text-base font-mono font-semibold whitespace-nowrap",
            monthSum.total > 0
              ? "text-success"
              : monthSum.total < 0
              ? "text-danger"
              : "text-muted-foreground"
          )}
        >
          {formatNumberSpaces(monthSum.total)} TZS
        </span>
      </PageHeader>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead className="bg-muted/40 border-b sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 whitespace-nowrap border-r">Date</th>
                {DENOMS_DESC.map((d) => (
                  <th key={d} className="px-2 py-2 whitespace-nowrap border-r text-center">
                    {formatChipLabel(d)}
                  </th>
                ))}
                <th className="text-right px-3 py-2 whitespace-nowrap bg-muted/60">Total TZS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={DENOMS_DESC.length + 2} className="text-center py-6 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && dailyRows.length === 0 && (
                <tr>
                  <td colSpan={DENOMS_DESC.length + 2} className="text-center py-6 text-muted-foreground">
                    No closed shifts with miss chips in this month
                  </td>
                </tr>
              )}
              {dailyRows.map((r) => (
                <tr key={r.business_date} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-1.5 whitespace-nowrap border-r">{fmtDateOnly(r.business_date)}</td>
                  {DENOMS_DESC.map((d) => {
                    const v = r.by_denom[d] ?? 0;
                    return (
                      <td key={d} className={cn(cellClass(v), "border-r")}>
                        {v === 0 ? "·" : (v > 0 ? `+${formatNumberSpaces(v)}` : formatNumberSpaces(v))}
                      </td>
                    );
                  })}
                  <td className={cn(cellClass(r.total_tzs), "font-semibold bg-muted/30")}>
                    {formatNumberSpaces(r.total_tzs)}
                  </td>
                </tr>
              ))}
            </tbody>
            {dailyRows.length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/40">
                <tr>
                  <td className="px-3 py-2 font-semibold border-r">MONTH SUM</td>
                  {DENOMS_DESC.map((d) => {
                    const v = monthSum.by[d] ?? 0;
                    return (
                      <td key={d} className={cn(cellClass(v), "font-semibold border-r")}>
                        {v === 0 ? "·" : (v > 0 ? `+${formatNumberSpaces(v)}` : formatNumberSpaces(v))}
                      </td>
                    );
                  })}
                  <td className={cn(cellClass(monthSum.total), "font-bold text-base")}>
                    {formatNumberSpaces(monthSum.total)} TZS
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MissChips;
