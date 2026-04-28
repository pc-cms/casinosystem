import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMissChipsByShift } from "@/hooks/use-chip-conservation";
import { formatChipLabel, formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { Coins, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const fmtTime = (iso: string | null) =>
  iso ? format(new Date(iso), "HH:mm") : "—";

const MissChipsReport = () => {
  const today = new Date();
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [mode, setMode] = useState<"month" | "custom">("month");

  const { fromDate, toDate, periodLabel } = useMemo(() => {
    if (mode === "custom" && customFrom && customTo) {
      return {
        fromDate: fmtDate(customFrom),
        toDate: fmtDate(customTo),
        periodLabel: `${format(customFrom, "dd MMM yyyy")} — ${format(customTo, "dd MMM yyyy")}`,
      };
    }
    return {
      fromDate: fmtDate(startOfMonth(monthAnchor)),
      toDate: fmtDate(endOfMonth(monthAnchor)),
      periodLabel: format(monthAnchor, "MMMM yyyy"),
    };
  }, [mode, monthAnchor, customFrom, customTo]);

  const { data: rows = [], isLoading } = useMissChipsByShift({ fromDate, toDate });

  const periodTotal = rows.reduce((s, r) => s + r.total_value_tzs, 0);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Miss Chips — Monthly Report</h1>
            <p className="text-xs text-muted-foreground">
              Per-shift breakdown of unreturned chips for the selected period
            </p>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setMode("month");
                setMonthAnchor((d) => startOfMonth(subMonths(d, 1)));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={mode === "month" ? "default" : "outline"}
              onClick={() => {
                setMode("month");
                setMonthAnchor(startOfMonth(today));
              }}
            >
              Current month
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setMode("month");
                setMonthAnchor((d) => startOfMonth(addMonths(d, 1)));
              }}
              disabled={monthAnchor >= startOfMonth(today)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={mode === "custom" ? "default" : "outline"}
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {mode === "custom" && customFrom
                  ? `From ${format(customFrom, "dd MMM")}`
                  : "Custom from"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(d) => {
                  setCustomFrom(d);
                  setMode("custom");
                }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={mode === "custom" ? "default" : "outline"}
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {mode === "custom" && customTo
                  ? `To ${format(customTo, "dd MMM")}`
                  : "Custom to"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(d) => {
                  setCustomTo(d);
                  setMode("custom");
                }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Period Miss Total</div>
            <div
              className={cn(
                "text-2xl font-mono font-semibold",
                periodTotal < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"
              )}
            >
              {formatNumberSpaces(periodTotal)} TZS
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report table */}
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
                <th className="text-right px-3 py-2 whitespace-nowrap bg-muted/60">
                  Total TZS
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={CHIP_DENOMS.length + 3}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={CHIP_DENOMS.length + 3}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No closed shifts with miss chips in this period
                  </td>
                </tr>
              )}
              {rows.map((r, idx) => (
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
                      r.total_value_tzs < 0
                        ? "text-cms-amount-negative"
                        : "text-cms-amount-positive"
                    )}
                  >
                    {formatNumberSpaces(r.total_value_tzs)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
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
                      periodTotal < 0
                        ? "text-cms-amount-negative"
                        : "text-cms-amount-positive"
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
    </div>
  );
};

export default MissChipsReport;
