import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMissChipsArchive } from "@/hooks/use-chip-conservation";
import { ChipEmissionDialog } from "@/components/chips/ChipEmissionDialog";
import { ChipConservationCard } from "@/components/chips/ChipConservationCard";
import { formatChipLabel, formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import { format, startOfMonth, subMonths } from "date-fns";
import { Coins } from "lucide-react";

const MissChips = () => {
  const [fromDate, setFromDate] = useState<string>(format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const { data: rows = [], isLoading } = useMissChipsArchive({ fromDate, toDate });

  // Aggregations
  const byDay = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    rows.forEach((r) => {
      if (!map.has(r.business_date)) map.set(r.business_date, new Map());
      const denomMap = map.get(r.business_date)!;
      denomMap.set(r.denomination, (denomMap.get(r.denomination) ?? 0) + Number(r.quantity));
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    rows.forEach((r) => {
      const key = r.business_date.slice(0, 7);
      if (!map.has(key)) map.set(key, new Map());
      const denomMap = map.get(key)!;
      denomMap.set(r.denomination, (denomMap.get(r.denomination) ?? 0) + Number(r.quantity));
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const totalValue = rows.reduce((s, r) => s + Number(r.total_value_tzs), 0);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Miss Chips Archive</h1>
        </div>
        <ChipEmissionDialog />
      </div>

      <ChipConservationCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Total value (period)</div>
            <div className="text-2xl font-mono">{formatNumberSpaces(totalValue)} TZS</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="by-day">
        <TabsList>
          <TabsTrigger value="by-day">By Day</TabsTrigger>
          <TabsTrigger value="by-month">By Month</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

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
                  {isLoading && <tr><td colSpan={CHIP_DENOMS.length + 2} className="text-center py-4 text-muted-foreground">Loading…</td></tr>}
                  {!isLoading && byDay.length === 0 && <tr><td colSpan={CHIP_DENOMS.length + 2} className="text-center py-4 text-muted-foreground">No data in this period</td></tr>}
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
                  {rows.map((r) => (
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
