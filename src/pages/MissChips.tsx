import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMissChipsArchive, useMissChipsByShift } from "@/hooks/use-chip-conservation";
import { formatChipLabel, formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const fmtTime = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "—");

type ViewMode = "per-shift" | "by-month";

const MissChips = () => {
  const today = new Date();
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const [view, setView] = useState<ViewMode>("per-shift");

  const fromDate = fmtDate(startOfMonth(monthAnchor));
  const toDate = fmtDate(endOfMonth(monthAnchor));
  const periodLabel = format(monthAnchor, "MMMM yyyy");

  const { data: shiftRows = [], isLoading: shiftsLoading } = useMissChipsByShift({ fromDate, toDate });
  const { data: rawRows = [], isLoading: rawLoading } = useMissChipsArchive({
    fromDate,
    toDate,
  });

  const periodTotal = shiftRows.reduce((s, r) => s + r.total_value_tzs, 0);

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

  return (
    <div className="container mx-auto p-4 space-y-3 max-w-[1400px]">
      {/* Single compact header row */}
      <div className="flex items-center flex-wrap gap-2">
        <Coins className="h-5 w-5" />
        <h1 className="text-lg font-semibold mr-3">Miss Chips</h1>

        {/* Month nav */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonthAnchor((d) => startOfMonth(subMonths(d, 1)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[140px] font-mono"
            onClick={() => setMonthAnchor(startOfMonth(today))}
          >
            {periodLabel}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonthAnchor((d) => startOfMonth(addMonths(d, 1)))}
            disabled={monthAnchor >= startOfMonth(today)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant={view === "per-shift" ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setView("per-shift")}
          >
            Per Shift
          </Button>
          <Button
            variant={view === "by-month" ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setView("by-month")}
          >
            By Month
          </Button>
        </div>

        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Total</span>
          <span
            className={cn(
              "text-lg font-mono font-semibold",
              periodTotal < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"
            )}
          >
            {formatNumberSpaces(periodTotal)} TZS
          </span>
        </div>
      </div>

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
                      return (
                        <td
                          key={d}
                          className={cn(
                            "text-right px-3 py-1.5",
                            v < 0
                              ? "text-cms-amount-negative"
                              : v > 0
                              ? "text-amber-500"
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
                        r.total_value_tzs < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"
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
                        periodTotal < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"
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
                  const net = Array.from(denomMap.entries()).reduce((s, [d, q]) => s + d * q, 0);
                  return (
                    <tr key={month} className="border-b border-border/40">
                      <td className="px-3 py-1.5">{month}</td>
                      {CHIP_DENOMS.map((d) => {
                        const v = denomMap.get(d) ?? 0;
                        return (
                          <td
                            key={d}
                            className={`text-right px-3 py-1.5 ${
                              v < 0
                                ? "text-cms-amount-negative"
                                : v > 0
                                ? "text-amber-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {v === 0 ? "·" : formatNumberSpaces(v)}
                          </td>
                        );
                      })}
                      <td
                        className={`text-right px-3 py-1.5 font-semibold ${
                          net < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"
                        }`}
                      >
                        {formatNumberSpaces(net)}
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
