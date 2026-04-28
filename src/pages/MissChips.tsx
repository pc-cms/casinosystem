import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMissChipsArchive, useMissChipsByShift } from "@/hooks/use-chip-conservation";
import { ChipEmissionDialog } from "@/components/chips/ChipEmissionDialog";
import { ChipConservationCard } from "@/components/chips/ChipConservationCard";
import { formatChipLabel, formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { Coins, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const fmtTime = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "—");

const MissChips = () => {
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

  const { data: shiftRows = [], isLoading: shiftsLoading } = useMissChipsByShift({ fromDate, toDate });
  const { data: rawRows = [], isLoading: rawLoading } = useMissChipsArchive({ fromDate, toDate });

  const periodTotal = shiftRows.reduce((s, r) => s + r.total_value_tzs, 0);

  // Aggregations from raw archive
  const byDay = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    rawRows.forEach((r) => {
      if (!map.has(r.business_date)) map.set(r.business_date, new Map());
      const dm = map.get(r.business_date)!;
      dm.set(r.denomination, (dm.get(r.denomination) ?? 0) + Number(r.quantity));
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rawRows]);

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
    <div className="container mx-auto p-4 space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-semibold">Miss Chips</h1>
            <p className="text-xs text-muted-foreground">
              Conservation status, per-shift breakdown and historical archive
            </p>
          </div>
        </div>
        <ChipEmissionDialog />
      </div>

      <ChipConservationCard />

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
              <Button variant={mode === "custom" ? "default" : "outline"} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {mode === "custom" && customFrom ? `From ${format(customFrom, "dd MMM")}` : "Custom from"}
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
              <Button variant={mode === "custom" ? "default" : "outline"} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {mode === "custom" && customTo ? `To ${format(customTo, "dd MMM")}` : "Custom to"}
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

      <Tabs defaultValue="per-shift">
        <TabsList>
          <TabsTrigger value="per-shift">Per Shift</TabsTrigger>
          <TabsTrigger value="by-day">By Day</TabsTrigger>
          <TabsTrigger value="by-month">By Month</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="per-shift">
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
                    <tr key={`${r.shift_id ?? "nx"}-${idx}`} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-1.5 whitespace-nowrap">{r.business_date}</td>
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{fmtTime(r.closed_at)}</td>
                      {CHIP_DENOMS.map((d) => {
                        const v = r.denoms[d] ?? 0;
                        return (
                          <td
                            key={d}
                            className={cn(
                              "text-right px-3 py-1.5",
                              v < 0 ? "text-cms-amount-negative" : v > 0 ? "text-amber-500" : "text-muted-foreground"
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
        </TabsContent>

        <TabsContent value="by-day">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    {CHIP_DENOMS.map((d) => (
                      <th key={d} className="text-right px-3 py-2">{formatChipLabel(d)}</th>
                    ))}
                    <th className="text-right px-3 py-2">Net (TZS)</th>
                  </tr>
                </thead>
                <tbody>
                  {rawLoading && <tr><td colSpan={CHIP_DENOMS.length + 2} className="text-center py-4 text-muted-foreground">Loading…</td></tr>}
                  {!rawLoading && byDay.length === 0 && <tr><td colSpan={CHIP_DENOMS.length + 2} className="text-center py-4 text-muted-foreground">No data in this period</td></tr>}
                  {byDay.map(([date, denomMap]) => {
                    const net = Array.from(denomMap.entries()).reduce((s, [d, q]) => s + d * q, 0);
                    return (
                      <tr key={date} className="border-b border-border/40">
                        <td className="px-3 py-1.5">{date}</td>
                        {CHIP_DENOMS.map((d) => {
                          const v = denomMap.get(d) ?? 0;
                          return (
                            <td key={d} className={`text-right px-3 py-1.5 ${v < 0 ? "text-cms-amount-negative" : v > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                              {v === 0 ? "·" : formatNumberSpaces(v)}
                            </td>
                          );
                        })}
                        <td className={`text-right px-3 py-1.5 font-semibold ${net < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"}`}>
                          {formatNumberSpaces(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-month">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Month</th>
                    {CHIP_DENOMS.map((d) => (
                      <th key={d} className="text-right px-3 py-2">{formatChipLabel(d)}</th>
                    ))}
                    <th className="text-right px-3 py-2">Net (TZS)</th>
                  </tr>
                </thead>
                <tbody>
                  {byMonth.map(([month, denomMap]) => {
                    const net = Array.from(denomMap.entries()).reduce((s, [d, q]) => s + d * q, 0);
                    return (
                      <tr key={month} className="border-b border-border/40">
                        <td className="px-3 py-1.5">{month}</td>
                        {CHIP_DENOMS.map((d) => {
                          const v = denomMap.get(d) ?? 0;
                          return (
                            <td key={d} className={`text-right px-3 py-1.5 ${v < 0 ? "text-cms-amount-negative" : v > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                              {v === 0 ? "·" : formatNumberSpaces(v)}
                            </td>
                          );
                        })}
                        <td className={`text-right px-3 py-1.5 font-semibold ${net < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"}`}>
                          {formatNumberSpaces(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Shift</th>
                    <th className="text-right px-3 py-2">Denom</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Value TZS</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="px-3 py-1.5">{r.business_date}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.shift_id?.slice(0, 8) ?? "—"}</td>
                      <td className="text-right px-3 py-1.5">{formatChipLabel(r.denomination)}</td>
                      <td className={`text-right px-3 py-1.5 ${r.quantity < 0 ? "text-cms-amount-negative" : "text-amber-500"}`}>
                        {formatNumberSpaces(r.quantity)}
                      </td>
                      <td className={`text-right px-3 py-1.5 ${r.total_value_tzs < 0 ? "text-cms-amount-negative" : "text-cms-amount-positive"}`}>
                        {formatNumberSpaces(r.total_value_tzs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MissChips;
