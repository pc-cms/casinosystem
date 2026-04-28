import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMissChipsArchive, useMissChipsByShift } from "@/hooks/use-chip-conservation";
import { formatChipLabel, formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  startOfYear,
  endOfYear,
  subYears,
  addYears,
} from "date-fns";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const fmtTime = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "—");

type ViewMode = "per-shift" | "by-month";

const MissChips = () => {
  const today = new Date();
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const [yearAnchor, setYearAnchor] = useState<Date>(startOfYear(today));
  const [view, setView] = useState<ViewMode>("per-shift");

  // Period depends on view: month for per-shift, year for by-month
  const { fromDate, toDate, periodLabel } =
    view === "per-shift"
      ? {
          fromDate: fmtDate(startOfMonth(monthAnchor)),
          toDate: fmtDate(endOfMonth(monthAnchor)),
          periodLabel: format(monthAnchor, "MMMM yyyy"),
        }
      : {
          fromDate: fmtDate(startOfYear(yearAnchor)),
          toDate: fmtDate(endOfYear(yearAnchor)),
          periodLabel: format(yearAnchor, "yyyy"),
        };

  const { data: shiftRows = [], isLoading: shiftsLoading } = useMissChipsByShift({ fromDate, toDate });
  const { data: rawRows = [], isLoading: rawLoading } = useMissChipsArchive({ fromDate, toDate });

  // CASH (Cage) PERSPECTIVE:
  // +N chips miss = chips went OUT to players, cash STAYED in cage → +TZS → green
  // -N chips miss = chips RETURNED to cage (emission cancelled), cash LEFT cage → -TZS → red
  const periodTotal = useMemo(() => {
    return view === "per-shift"
      ? shiftRows.reduce((s, r) => s + r.total_value_tzs, 0)
      : rawRows.reduce((s, r) => s + Number(r.total_value_tzs), 0);
  }, [view, shiftRows, rawRows]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    rawRows.forEach((r) => {
      const key = r.business_date.slice(0, 7);
      if (!map.has(key)) map.set(key, new Map());
      const dm = map.get(key)!;
      dm.set(r.denomination, (dm.get(r.denomination) ?? 0) + Number(r.quantity));
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rawRows]);

  // Unified period nav handlers
  const goPrev = () => {
    if (view === "per-shift") setMonthAnchor((d) => startOfMonth(subMonths(d, 1)));
    else setYearAnchor((d) => startOfYear(subYears(d, 1)));
  };
  const goNext = () => {
    if (view === "per-shift") setMonthAnchor((d) => startOfMonth(addMonths(d, 1)));
    else setYearAnchor((d) => startOfYear(addYears(d, 1)));
  };
  const goCurrent = () => {
    if (view === "per-shift") setMonthAnchor(startOfMonth(today));
    else setYearAnchor(startOfYear(today));
  };
  const nextDisabled =
    view === "per-shift"
      ? monthAnchor >= startOfMonth(today)
      : yearAnchor >= startOfYear(today);

  return (
    <div className="container mx-auto p-4 space-y-3 max-w-[1400px]">
      <PageHeader
        icon={Coins}
        title="Miss Chips"
        subtitle={`Total ${formatNumberSpaces(periodTotal)} TZS · ${periodLabel}`}
        date
        centerSlot={
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {/* Period nav */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 font-mono", view === "per-shift" ? "min-w-[140px]" : "min-w-[80px]")}
                onClick={goCurrent}
              >
                {periodLabel}
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
            {/* View switcher */}
            <div className="flex items-center gap-1 ml-2">
              <Button variant={view === "per-shift" ? "default" : "outline"} size="sm" className="h-8" onClick={() => setView("per-shift")}>
                Per Shift
              </Button>
              <Button variant={view === "by-month" ? "default" : "outline"} size="sm" className="h-8" onClick={() => setView("by-month")}>
                By Month
              </Button>
            </div>
          </div>
        }
      >
        <span
          className={cn(
            "text-base font-mono font-semibold whitespace-nowrap",
            periodTotal > 0 ? "text-cms-amount-positive" : periodTotal < 0 ? "text-cms-amount-negative" : "text-muted-foreground"
          )}
        >
          {formatNumberSpaces(periodTotal)} TZS
        </span>
      </PageHeader>

      {view === "per-shift" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-muted/40 border-b sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Closed</th>
                  {CHIP_DENOMS.map((d) => (
                    <th key={d} className="text-right px-3 py-2 whitespace-nowrap">
                      {formatChipLabel(d)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 whitespace-nowrap bg-muted/60">Total TZS</th>
                </tr>
              </thead>
              <tbody>
                {shiftsLoading && (
                  <tr>
                    <td colSpan={CHIP_DENOMS.length + 3} className="text-center py-6 text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!shiftsLoading && shiftRows.length === 0 && (
                  <tr>
                    <td colSpan={CHIP_DENOMS.length + 3} className="text-center py-6 text-muted-foreground">
                      No closed shifts with miss chips in this period
                    </td>
                  </tr>
                )}
                {shiftRows.map((r, idx) => (
                  <tr
                    key={`${r.shift_id ?? "nx"}-${idx}`}
                    className="border-b border-border/40 hover:bg-muted/20"
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.business_date}</td>
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                      {fmtTime(r.closed_at)}
                    </td>
                    {CHIP_DENOMS.map((d) => {
                      const v = r.denoms[d] ?? 0;
                      // Cage perspective: +chips → cash stays (green); -chips → cash leaves (red)
                      return (
                        <td
                          key={d}
                          className={cn(
                            "text-right px-3 py-1.5",
                            v > 0
                              ? "text-cms-amount-positive"
                              : v < 0
                              ? "text-cms-amount-negative"
                              : "text-muted-foreground"
                          )}
                        >
                          {v === 0 ? "·" : formatNumberSpaces(v)}
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "text-right px-3 py-1.5 font-semibold bg-muted/30",
                        r.total_value_tzs > 0 ? "text-cms-amount-positive" : r.total_value_tzs < 0 ? "text-cms-amount-negative" : "text-muted-foreground"
                      )}
                    >
                      {formatNumberSpaces(r.total_value_tzs)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {shiftRows.length > 0 && (
                <tfoot className="border-t-2 border-border bg-muted/40">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-semibold">
                      Total
                    </td>
                    {CHIP_DENOMS.map((d) => (
                      <td key={d} className="px-3 py-2" />
                    ))}
                    <td
                      className={cn(
                        "text-right px-3 py-2 font-semibold text-base",
                        periodTotal > 0 ? "text-cms-amount-positive" : periodTotal < 0 ? "text-cms-amount-negative" : "text-muted-foreground"
                      )}
                    >
                      {formatNumberSpaces(periodTotal)} TZS
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      )}

      {view === "by-month" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-3 py-2">Month</th>
                  {CHIP_DENOMS.map((d) => (
                    <th key={d} className="text-right px-3 py-2">
                      {formatChipLabel(d)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2">Net (TZS)</th>
                </tr>
              </thead>
              <tbody>
                {rawLoading && (
                  <tr>
                    <td colSpan={CHIP_DENOMS.length + 2} className="text-center py-4 text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!rawLoading && byMonth.length === 0 && (
                  <tr>
                    <td colSpan={CHIP_DENOMS.length + 2} className="text-center py-4 text-muted-foreground">
                      No data in this period
                    </td>
                  </tr>
                )}
                {byMonth.map(([month, denomMap]) => {
                  // Cage cash impact: sum of denomination * quantity
                  const netCash = Array.from(denomMap.entries()).reduce((s, [d, q]) => s + d * q, 0);
                  return (
                    <tr key={month} className="border-b border-border/40">
                      <td className="px-3 py-1.5">{month}</td>
                      {CHIP_DENOMS.map((d) => {
                        const v = denomMap.get(d) ?? 0;
                        return (
                          <td
                            key={d}
                            className={`text-right px-3 py-1.5 ${
                              v > 0
                                ? "text-cms-amount-positive"
                                : v < 0
                                ? "text-cms-amount-negative"
                                : "text-muted-foreground"
                            }`}
                          >
                            {v === 0 ? "·" : formatNumberSpaces(v)}
                          </td>
                        );
                      })}
                      <td
                        className={`text-right px-3 py-1.5 font-semibold ${
                          netCash > 0 ? "text-cms-amount-positive" : netCash < 0 ? "text-cms-amount-negative" : "text-muted-foreground"
                        }`}
                      >
                        {formatNumberSpaces(netCash)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MissChips;
