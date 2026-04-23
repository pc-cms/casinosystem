import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDailyResults } from "@/hooks/use-import-reports";
import { formatSpaced } from "@/lib/import-helpers";
import { Loader2 } from "lucide-react";

const TableResults = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data = [], isLoading } = useDailyResults(from, to);

  // Group by date
  const byDate = data.reduce((acc, r) => {
    (acc[r.date] ||= []).push(r);
    return acc;
  }, {} as Record<string, typeof data>);

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Table Results</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Combined daily results from imports and live shifts.
        </p>
      </div>

      <Card className="p-3 md:p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && dates.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">
          No results in the selected range.
        </p>
      )}

      {dates.map((date) => {
        const rows = byDate[date].slice().sort((a, b) =>
          ((a as any).gaming_tables?.name || "").localeCompare((b as any).gaming_tables?.name || "")
        );
        const totalResult = rows.reduce((s, r) => s + Number(r.result || 0), 0);
        return (
          <Card key={date} className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-bold text-base md:text-lg font-mono">{date}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Total Result:</span>
                <span className="font-mono font-bold">{formatSpaced(totalResult)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">Fill</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Close</TableHead>
                    <TableHead className="text-right">Drop</TableHead>
                    <TableHead className="text-right">Result</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">{r.gaming_tables?.name}</TableCell>
                      <TableCell className="text-right font-mono">{formatSpaced(r.open)}</TableCell>
                      <TableCell className="text-right font-mono">{formatSpaced(r.fill)}</TableCell>
                      <TableCell className="text-right font-mono">{formatSpaced(r.credit)}</TableCell>
                      <TableCell className="text-right font-mono">{formatSpaced(r.close)}</TableCell>
                      <TableCell className="text-right font-mono">{formatSpaced(r.drop_amount)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatSpaced(r.result)}</TableCell>
                      <TableCell>
                        <Badge variant={r.source === "imported" ? "secondary" : "default"} className="text-[10px]">
                          {r.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default TableResults;
