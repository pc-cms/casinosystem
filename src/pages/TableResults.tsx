import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDailyResults } from "@/hooks/use-import-reports";
import { formatSpaced } from "@/lib/import-helpers";
import { CalendarIcon, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/* ------------------------------------------------------------------ */
/* Layout config — order of columns in the horizontal report          */
/* ------------------------------------------------------------------ */
const AR_TABLES = ["AR1", "AR2", "AR3"] as const;
const PK_TABLES = ["P1", "P2", "P3", "P4", "P5"] as const;
const BJ_TABLES = ["BJ1"] as const;

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "30d", label: "30d" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayStr = () => isoDate(new Date());
const daysAgoStr = (n: number) => isoDate(new Date(Date.now() - n * 86400000));

/** Returns Sunday→Saturday week containing the given date (local time). */
const weekRangeFor = (d: Date): { from: string; to: string } => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - start.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Saturday
  return { from: isoDate(start), to: isoDate(end) };
};

/** ISO date → Sunday of that week (for week-grouping borders). */
const weekKey = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - d.getDay());
  return isoDate(d);
};

const presetRange = (key: PresetKey, weekAnchor: Date): { from: string; to: string } => {
  const t = todayStr();
  const now = new Date();
  switch (key) {
    case "today":
      return { from: t, to: t };
    case "week":
      return weekRangeFor(weekAnchor);
    case "30d":
      return { from: daysAgoStr(29), to: t };
    case "month": {
      const first = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from: first, to: t };
    }
    case "year": {
      const first = isoDate(new Date(now.getFullYear(), 0, 1));
      return { from: first, to: t };
    }
    default: {
      const first = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from: first, to: t };
    }
  }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
type Row = {
  id: string;
  date: string;
  table_id: string;
  open: number;
  fill: number;
  credit: number;
  close: number;
  drop_amount: number;
  result: number;
  source: string;
  gaming_tables?: { name?: string; game?: string } | null;
};

type DayCell = {
  drop: number;
  result: number;
  hasData: boolean;
};

type DayBucket = {
  date: string;
  cells: Record<string, DayCell>; // by table name
  fullRows: Row[];                // for inline drilldown
  arDrop: number; arResult: number;
  pkDrop: number; pkResult: number;
  bjDrop: number; bjResult: number;
  totalDrop: number; totalResult: number;
};

const emptyCell: DayCell = { drop: 0, result: 0, hasData: false };

const holdPct = (drop: number, result: number) =>
  drop > 0 ? (result / drop) * 100 : 0;

const fmtPct = (v: number) =>
  v === 0 ? "—" : `${v >= 0 ? "" : "-"}${Math.abs(v).toFixed(1)}%`;

const dayName = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

const monthShort = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });

const dayNum = (iso: string) => Number(iso.slice(8, 10));

/* ------------------------------------------------------------------ */

const TableResults = () => {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [customFrom, setCustomFrom] = useState(daysAgoStr(29));
  const [customTo, setCustomTo] = useState(todayStr());
  const [openDate, setOpenDate] = useState<string | null>(null);

  const { from, to } =
    preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset);

  const { data = [], isLoading } = useDailyResults(from, to);

  /* Group rows by date */
  const buckets: DayBucket[] = useMemo(() => {
    const byDate: Record<string, Row[]> = {};
    for (const r of data as Row[]) {
      (byDate[r.date] ||= []).push(r);
    }
    const list: DayBucket[] = Object.entries(byDate).map(([date, rows]) => {
      const cells: Record<string, DayCell> = {};
      // pick latest row per table name (deterministic by id)
      const byName = new Map<string, Row>();
      for (const r of rows) {
        const n = r.gaming_tables?.name;
        if (!n) continue;
        const existing = byName.get(n);
        if (!existing || r.id.localeCompare(existing.id) > 0) byName.set(n, r);
      }
      for (const [name, r] of byName.entries()) {
        cells[name] = {
          drop: Number(r.drop_amount || 0),
          result: Number(r.result || 0),
          hasData: true,
        };
      }
      const sumGroup = (names: readonly string[]) => {
        let d = 0,
          res = 0;
        for (const n of names) {
          const c = cells[n];
          if (c) {
            d += c.drop;
            res += c.result;
          }
        }
        return { d, res };
      };
      const ar = sumGroup(AR_TABLES);
      const pk = sumGroup(PK_TABLES);
      const bj = sumGroup(BJ_TABLES);
      return {
        date,
        cells,
        fullRows: rows,
        arDrop: ar.d,
        arResult: ar.res,
        pkDrop: pk.d,
        pkResult: pk.res,
        bjDrop: bj.d,
        bjResult: bj.res,
        totalDrop: ar.d + pk.d + bj.d,
        totalResult: ar.res + pk.res + bj.res,
      };
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  /* Period totals (bottom row) */
  const totals = useMemo(() => {
    const cellsTotal: Record<string, { drop: number; result: number }> = {};
    let arDrop = 0, arResult = 0;
    let pkDrop = 0, pkResult = 0;
    let bjDrop = 0, bjResult = 0;
    for (const b of buckets) {
      for (const name of [...AR_TABLES, ...PK_TABLES, ...BJ_TABLES]) {
        const c = b.cells[name];
        if (!c) continue;
        const acc = (cellsTotal[name] ||= { drop: 0, result: 0 });
        acc.drop += c.drop;
        acc.result += c.result;
      }
      arDrop += b.arDrop; arResult += b.arResult;
      pkDrop += b.pkDrop; pkResult += b.pkResult;
      bjDrop += b.bjDrop; bjResult += b.bjResult;
    }
    return {
      cellsTotal,
      arDrop, arResult,
      pkDrop, pkResult,
      bjDrop, bjResult,
      totalDrop: arDrop + pkDrop + bjDrop,
      totalResult: arResult + pkResult + bjResult,
    };
  }, [buckets]);

  /* ---------------------------------------------------------------- */
  /* Render helpers                                                   */
  /* ---------------------------------------------------------------- */
  const numCell = (v: number, opts?: { bold?: boolean; muted?: boolean }) => {
    const isNeg = v < 0;
    return (
      <span
        className={cn(
          "font-mono tabular-nums",
          opts?.bold && "font-semibold",
          isNeg && "text-destructive",
          v === 0 && opts?.muted && "text-muted-foreground/50",
        )}
      >
        {v === 0 ? "—" : formatSpaced(v)}
      </span>
    );
  };

  const pctCell = (drop: number, result: number) => {
    const v = holdPct(drop, result);
    if (drop === 0) return <span className="text-muted-foreground/50">—</span>;
    const isNeg = v < 0;
    return (
      <span
        className={cn(
          "font-mono tabular-nums text-xs",
          isNeg && "text-destructive",
        )}
      >
        {v >= 0 ? "" : "-"}{Math.abs(v).toFixed(1)}%
      </span>
    );
  };

  /* Column groups */
  const allTableCols = [...AR_TABLES, ...PK_TABLES, ...BJ_TABLES];

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-[100vw]">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Table Results</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Daily Drop / Result / Hold% per table — combined from imports and live shifts.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-3 md:p-4">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? "default" : "outline"}
                onClick={() => setPreset(p.key)}
                className="h-8"
              >
                {p.label}
              </Button>
            ))}
          </div>
          {preset === "custom" && (
            <>
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 w-40"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 w-40"
                />
              </div>
            </>
          )}
          <div className="ml-auto text-xs text-muted-foreground self-center">
            {from} → {to} · {buckets.length} {buckets.length === 1 ? "day" : "days"}
          </div>
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && buckets.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No results in the selected range.
        </Card>
      )}

      {/* Excel-style horizontal report */}
      {!isLoading && buckets.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              {/* Group headers */}
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="sticky left-0 bg-muted/40 z-10 w-32 min-w-32 border-r">
                    Date
                  </TableHead>
                  <TableHead
                    colSpan={AR_TABLES.length * 3}
                    className="text-center font-semibold border-r bg-warning/10"
                  >
                    American Roulette
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="text-center font-semibold border-r bg-warning/20"
                  >
                    Total AR
                  </TableHead>
                  <TableHead
                    colSpan={PK_TABLES.length * 3}
                    className="text-center font-semibold border-r bg-success/10"
                  >
                    Poker (PK)
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="text-center font-semibold border-r bg-success/20"
                  >
                    Total PK
                  </TableHead>
                  <TableHead
                    colSpan={BJ_TABLES.length * 3}
                    className="text-center font-semibold border-r bg-destructive/10"
                  >
                    Blackjack
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="text-center font-semibold border-r bg-destructive/20"
                  >
                    Total BJ
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="text-center font-semibold bg-primary/15"
                  >
                    Total Tables
                  </TableHead>
                </TableRow>

                {/* Sub-headers (D / R / %) */}
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="sticky left-0 bg-muted/20 z-10 w-32 min-w-32 border-r" />
                  {AR_TABLES.map((t) => (
                    <SubHead key={t} name={t} accent="amber" />
                  ))}
                  <SubHead name="AR" accent="amber" bold />

                  {PK_TABLES.map((t) => (
                    <SubHead key={t} name={t.replace("P", "PK")} accent="emerald" />
                  ))}
                  <SubHead name="PK" accent="emerald" bold />

                  {BJ_TABLES.map((t) => (
                    <SubHead key={t} name={t} accent="rose" />
                  ))}
                  <SubHead name="BJ" accent="rose" bold />

                  <SubHead name="ALL" accent="primary" bold />
                </TableRow>
              </TableHeader>

              <TableBody>
                {buckets.map((b) => {
                  const isOpen = openDate === b.date;
                  return (
                    <>
                      <TableRow
                        key={b.date}
                        className="cursor-pointer hover:bg-accent/30"
                        onClick={() => setOpenDate(isOpen ? null : b.date)}
                      >
                        {/* Date sticky */}
                        <TableCell className="sticky left-0 bg-background hover:bg-accent/30 z-10 border-r font-medium">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight
                              className={cn(
                                "w-3.5 h-3.5 transition-transform text-muted-foreground",
                                isOpen && "rotate-90",
                              )}
                            />
                            <div className="flex flex-col leading-tight">
                              <span className="font-mono">{b.date}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {monthShort(b.date)} · {dayName(b.date)} · {dayNum(b.date)}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* AR cells */}
                        {AR_TABLES.map((t) => {
                          const c = b.cells[t] || emptyCell;
                          return (
                            <DRCell
                              key={t}
                              drop={c.drop}
                              result={c.result}
                              hasData={c.hasData}
                            />
                          );
                        })}
                        <DRCell drop={b.arDrop} result={b.arResult} hasData bold />

                        {/* PK cells */}
                        {PK_TABLES.map((t) => {
                          const c = b.cells[t] || emptyCell;
                          return (
                            <DRCell
                              key={t}
                              drop={c.drop}
                              result={c.result}
                              hasData={c.hasData}
                            />
                          );
                        })}
                        <DRCell drop={b.pkDrop} result={b.pkResult} hasData bold />

                        {/* BJ cells */}
                        {BJ_TABLES.map((t) => {
                          const c = b.cells[t] || emptyCell;
                          return (
                            <DRCell
                              key={t}
                              drop={c.drop}
                              result={c.result}
                              hasData={c.hasData}
                            />
                          );
                        })}
                        <DRCell drop={b.bjDrop} result={b.bjResult} hasData bold />

                        {/* All */}
                        <DRCell drop={b.totalDrop} result={b.totalResult} hasData bold />
                      </TableRow>

                      {/* Inline drilldown — full per-table report (third photo) */}
                      {isOpen && (
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableCell
                            colSpan={
                              1 +
                              AR_TABLES.length * 3 + 3 +
                              PK_TABLES.length * 3 + 3 +
                              BJ_TABLES.length * 3 + 3 +
                              3
                            }
                            className="p-0"
                          >
                            <DayDetail rows={b.fullRows} date={b.date} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}

                {/* Period TOTAL row */}
                <TableRow className="bg-primary/10 hover:bg-primary/10 font-semibold border-t-2">
                  <TableCell className="sticky left-0 bg-primary/15 z-10 border-r">
                    TOTAL ({buckets.length}d)
                  </TableCell>
                  {AR_TABLES.map((t) => {
                    const c = totals.cellsTotal[t] || { drop: 0, result: 0 };
                    return (
                      <DRCell
                        key={t}
                        drop={c.drop}
                        result={c.result}
                        hasData
                        bold
                      />
                    );
                  })}
                  <DRCell drop={totals.arDrop} result={totals.arResult} hasData bold />

                  {PK_TABLES.map((t) => {
                    const c = totals.cellsTotal[t] || { drop: 0, result: 0 };
                    return (
                      <DRCell
                        key={t}
                        drop={c.drop}
                        result={c.result}
                        hasData
                        bold
                      />
                    );
                  })}
                  <DRCell drop={totals.pkDrop} result={totals.pkResult} hasData bold />

                  {BJ_TABLES.map((t) => {
                    const c = totals.cellsTotal[t] || { drop: 0, result: 0 };
                    return (
                      <DRCell
                        key={t}
                        drop={c.drop}
                        result={c.result}
                        hasData
                        bold
                      />
                    );
                  })}
                  <DRCell drop={totals.bjDrop} result={totals.bjResult} hasData bold />

                  <DRCell drop={totals.totalDrop} result={totals.totalResult} hasData bold />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

const accentBg: Record<string, string> = {
  amber: "bg-warning/5",
  emerald: "bg-success/5",
  rose: "bg-destructive/5",
  primary: "bg-primary/10",
};
const accentBgBold: Record<string, string> = {
  amber: "bg-warning/15",
  emerald: "bg-success/15",
  rose: "bg-destructive/15",
  primary: "bg-primary/20",
};

const SubHead = ({
  name,
  accent,
  bold,
}: {
  name: string;
  accent: keyof typeof accentBg;
  bold?: boolean;
}) => {
  const bg = bold ? accentBgBold[accent] : accentBg[accent];
  return (
    <>
      <TableHead
        className={cn(
          "text-right font-medium text-[10px] uppercase tracking-wide whitespace-nowrap px-2",
          bg,
        )}
      >
        {name} D
      </TableHead>
      <TableHead
        className={cn(
          "text-right font-medium text-[10px] uppercase tracking-wide whitespace-nowrap px-2",
          bg,
        )}
      >
        {name} R
      </TableHead>
      <TableHead
        className={cn(
          "text-right font-medium text-[10px] uppercase tracking-wide whitespace-nowrap px-2 border-r",
          bg,
        )}
      >
        {name} %
      </TableHead>
    </>
  );
};

const DRCell = ({
  drop,
  result,
  hasData,
  bold,
}: {
  drop: number;
  result: number;
  hasData: boolean;
  bold?: boolean;
}) => {
  if (!hasData && drop === 0 && result === 0) {
    return (
      <>
        <TableCell className="text-right text-muted-foreground/40 font-mono whitespace-nowrap px-2">—</TableCell>
        <TableCell className="text-right text-muted-foreground/40 font-mono whitespace-nowrap px-2">—</TableCell>
        <TableCell className="text-right text-muted-foreground/40 font-mono whitespace-nowrap px-2 border-r">—</TableCell>
      </>
    );
  }
  const isNeg = result < 0;
  const pct = drop > 0 ? (result / drop) * 100 : 0;
  return (
    <>
      <TableCell
        className={cn(
          "text-right font-mono tabular-nums whitespace-nowrap px-2",
          bold && "font-semibold",
        )}
      >
        {drop === 0 ? "—" : formatSpaced(drop)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono tabular-nums whitespace-nowrap px-2",
          bold && "font-semibold",
          isNeg && "text-destructive",
        )}
      >
        {result === 0 ? "—" : formatSpaced(result)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono tabular-nums text-xs whitespace-nowrap px-2 border-r",
          isNeg && "text-destructive",
        )}
      >
        {drop === 0 ? "—" : `${pct >= 0 ? "" : "-"}${Math.abs(pct).toFixed(1)}%`}
      </TableCell>
    </>
  );
};

/* Inline drilldown — like the third photo (per-table full breakdown) */
const DayDetail = ({ rows, date }: { rows: Row[]; date: string }) => {
  // Pick latest row per table name
  const byName = new Map<string, Row>();
  for (const r of rows) {
    const n = r.gaming_tables?.name;
    if (!n) continue;
    const existing = byName.get(n);
    if (!existing || r.id.localeCompare(existing.id) > 0) byName.set(n, r);
  }
  const order = [...AR_TABLES, ...PK_TABLES, ...BJ_TABLES];
  const sorted = order
    .map((n) => byName.get(n))
    .filter((r): r is Row => Boolean(r));

  const totals = sorted.reduce(
    (acc, r) => {
      acc.open += Number(r.open || 0);
      acc.fill += Number(r.fill || 0);
      acc.credit += Number(r.credit || 0);
      acc.close += Number(r.close || 0);
      acc.drop += Number(r.drop_amount || 0);
      acc.result += Number(r.result || 0);
      return acc;
    },
    { open: 0, fill: 0, credit: 0, close: 0, drop: 0, result: 0 },
  );

  return (
    <div className="p-3 md:p-4 border-l-4 border-l-primary/60">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h4 className="font-semibold text-sm">Day breakdown · {date}</h4>
        <div className="text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "table" : "tables"} · source:{" "}
          {Array.from(new Set(sorted.map((r) => r.source))).join(", ") || "—"}
        </div>
      </div>
      <div className="overflow-x-auto rounded border bg-background">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Table</TableHead>
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
            {sorted.map((r) => {
              const isNeg = Number(r.result) < 0;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">
                    {r.gaming_tables?.name}
                    <span className="text-[10px] text-muted-foreground ml-1.5">
                      {r.gaming_tables?.game}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatSpaced(r.open)}</TableCell>
                  <TableCell className="text-right font-mono">{formatSpaced(r.fill)}</TableCell>
                  <TableCell className="text-right font-mono">{formatSpaced(r.credit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatSpaced(r.close)}</TableCell>
                  <TableCell className="text-right font-mono">{formatSpaced(r.drop_amount)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold",
                      isNeg && "text-destructive",
                    )}
                  >
                    {formatSpaced(r.result)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.source === "imported" ? "secondary" : "default"}
                      className="text-[10px]"
                    >
                      {r.source}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40 font-semibold border-t-2">
              <TableCell>TOTAL</TableCell>
              <TableCell className="text-right font-mono">{formatSpaced(totals.open)}</TableCell>
              <TableCell className="text-right font-mono">{formatSpaced(totals.fill)}</TableCell>
              <TableCell className="text-right font-mono">{formatSpaced(totals.credit)}</TableCell>
              <TableCell className="text-right font-mono">{formatSpaced(totals.close)}</TableCell>
              <TableCell className="text-right font-mono">{formatSpaced(totals.drop)}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono",
                  totals.result < 0 && "text-destructive",
                )}
              >
                {formatSpaced(totals.result)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TableResults;
