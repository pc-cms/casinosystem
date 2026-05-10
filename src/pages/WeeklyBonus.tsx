import { useEffect, useMemo, useState } from "react";
import { Gift, ChevronLeft, ChevronRight, Printer, Lock, Unlock, Calculator } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell,
} from "@/components/ui/data-table";
import { useDealers, useDealerAttendanceRange, usePitRotaRange } from "@/hooks/use-dealers";
import {
  useWeeklyBonusEntries, useWeeklyBonusPool,
  useUpsertBonusEntry, useUpsertBonusPool,
  getWeekStartSunday, addDaysIso,
} from "@/hooks/use-weekly-bonus";
import { fmtDateOnly } from "@/lib/format-date";
import { UNIFIED_SHIFT_COLORS, UNIFIED_ATT_COLORS, UNIFIED_SHIFT_TINTS } from "@/lib/shift-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_LABELS: Record<string, string> = {
  trainee: "Trainee",
  dealer: "Dealer",
  inspector: "Inspector",
  expert: "Expert",
  pit_boss: "Pit Boss",
};
const CATEGORY_ORDER: Record<string, number> = {
  trainee: 0, dealer: 1, inspector: 2, expert: 3, pit_boss: 4,
};
const CATEGORY_BAR: Record<string, string> = {
  trainee: "bg-orange-500/15 text-orange-900 dark:text-orange-200",
  dealer: "bg-blue-500/15 text-blue-900 dark:text-blue-200",
  inspector: "bg-violet-500/15 text-violet-900 dark:text-violet-200",
  expert: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  pit_boss: "bg-rose-500/15 text-rose-900 dark:text-rose-200",
};

const parseValue = (val: string | null | undefined) => {
  if (!val) return { kind: "empty" as const, hours: 0 };
  if (val === "A") return { kind: "absent" as const, hours: 0 };
  if (val === "S") return { kind: "sick" as const, hours: 0 };
  const m = /^(\d+)(S?)$/.exec(val);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n)) return { kind: m[2] ? "hours-sick" as const : "hours" as const, hours: n };
  }
  return { kind: "empty" as const, hours: 0 };
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

// Decide background color for a single day cell from attendance + shift.
const cellColor = (att: string, shift: string): string => {
  if (att === "A" || att === "S") return UNIFIED_ATT_COLORS[att] ?? "";
  // Has hours → use shift color (full) when shift known, otherwise neutral.
  if (att && /^\d+S?$/.test(att)) {
    return UNIFIED_SHIFT_COLORS[shift] ?? "bg-muted/40";
  }
  // No attendance recorded — show scheduled shift as a tint.
  if (shift) return UNIFIED_SHIFT_TINTS[shift] ?? UNIFIED_SHIFT_COLORS[shift] ?? "";
  return "";
};

export default function WeeklyBonus() {
  const [weekStart, setWeekStart] = useState<string>(() => getWeekStartSunday(new Date()));
  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);

  const { data: dealers = [] } = useDealers();
  const { data: rota = [] } = usePitRotaRange(weekStart, weekEnd);
  const { data: attendance = [] } = useDealerAttendanceRange(weekStart, weekEnd);
  const { data: entries = [] } = useWeeklyBonusEntries(weekStart);
  const { data: pool } = useWeeklyBonusPool(weekStart);

  const upsertEntry = useUpsertBonusEntry();
  const upsertPool = useUpsertBonusPool();

  const [poolInput, setPoolInput] = useState<string>("");
  const [calculated, setCalculated] = useState<boolean>(false);
  const locked = !!pool?.is_calculated;

  useEffect(() => {
    setPoolInput(pool?.pool_amount ? String(pool.pool_amount) : "");
    setCalculated(!!pool?.is_calculated);
  }, [pool?.pool_amount, pool?.is_calculated, weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);

  // Build & group rows by category
  const grouped = useMemo(() => {
    const activeDealers = (dealers as any[]).filter((d) => d.is_active !== false);
    const attMap = new Map<string, string>();
    attendance.forEach((a: any) => attMap.set(`${a.dealer_id}|${a.date}`, a.value));
    const rotaMap = new Map<string, string>();
    rota.forEach((r: any) => rotaMap.set(`${r.dealer_id}|${r.date}`, r.shift));
    const entryMap = new Map<string, { extra_override: number | null; bonus_points: number }>();
    entries.forEach((e: any) => entryMap.set(e.dealer_id, { extra_override: e.extra_override, bonus_points: e.bonus_points }));

    const rows = activeDealers.map((d) => {
      let hours = 0;
      let extraComputed = 0;
      let hasAbsent = false;
      const cells = days.map((day) => {
        const att = attMap.get(`${d.id}|${day}`) ?? "";
        const shift = rotaMap.get(`${d.id}|${day}`) ?? "";
        const p = parseValue(att);
        if (p.kind === "absent") hasAbsent = true;
        if (p.kind === "hours" || p.kind === "hours-sick") hours += p.hours;
        if (shift === "E") extraComputed += 1;
        return { att, shift };
      });
      const entry = entryMap.get(d.id);
      const extra = entry?.extra_override ?? extraComputed;
      const bonusPts = entry?.bonus_points ?? 0;
      const points = hasAbsent ? 0 : (hours + extra + bonusPts);
      return { dealer: d, cells, hours, extraComputed, extra, bonusPts, hasAbsent, points };
    });

    // group
    const map = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const cat = r.dealer.is_pit_boss ? "pit_boss" : (r.dealer.category || "dealer");
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    });
    const sortedCats = Array.from(map.keys()).sort(
      (a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99),
    );
    return sortedCats.map((cat) => ({
      cat,
      rows: map.get(cat)!.sort((a, b) => a.dealer.name.localeCompare(b.dealer.name)),
    }));
  }, [dealers, attendance, rota, entries, days]);

  const allRows = useMemo(() => grouped.flatMap((g) => g.rows), [grouped]);
  const totalPoints = allRows.reduce((s, r) => s + r.points, 0);
  const poolAmount = calculated ? (parseInt(poolInput.replace(/\s/g, ""), 10) || 0) : 0;
  const valuePerPoint = totalPoints > 0 && poolAmount > 0 ? poolAmount / totalPoints : 0;
  const totalDistributed = allRows.reduce((s, r) => s + Math.round(r.points * valuePerPoint), 0);

  const navWeek = (offset: number) => setWeekStart((w) => addDaysIso(w, offset * 7));

  const handleCalculate = () => {
    const amt = parseInt(poolInput.replace(/\s/g, ""), 10);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid bonus amount");
      return;
    }
    setCalculated(true);
    toast.success("Bonus recalculated");
  };

  const handleLock = async () => {
    const amt = parseInt(poolInput.replace(/\s/g, ""), 10);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid bonus amount");
      return;
    }
    await upsertPool.mutateAsync({ week_start: weekStart, pool_amount: amt, calculate: !locked });
    toast.success(locked ? "Bonus unlocked" : "Bonus locked");
  };

  const isThisWeek = weekStart === getWeekStartSunday(new Date());

  return (
    <PageShell>
      <PageHeader
        icon={Gift}
        title="Weekly Bonus"
        subtitle="Distribute a bonus pool across Live Game staff (Sun – Sat)"
      >
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={() => navWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-mono px-2 min-w-[200px] text-center">
            {fmtDateOnly(weekStart)} – {fmtDateOnly(weekEnd)}
            {isThisWeek && <span className="ml-2 text-xs text-primary">(this week)</span>}
          </div>
          <Button variant="outline" size="icon" onClick={() => navWeek(1)} aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </PageHeader>

      <PageSection>
        <div className="flex flex-wrap items-end gap-3 mb-3 p-3 rounded-md border border-border bg-muted/20 print:hidden">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Bonus Pool (TZS)</label>
            <Input
              type="number"
              inputMode="numeric"
              className="w-44 font-mono"
              value={poolInput}
              onChange={(e) => { setPoolInput(e.target.value); setCalculated(false); }}
              placeholder="0"
              disabled={locked}
            />
          </div>
          <Button onClick={handleCalculate} disabled={locked} className="gap-2">
            <Calculator className="w-4 h-4" /> Calculate
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button
            variant={locked ? "destructive" : "default"}
            onClick={handleLock}
            className="gap-2"
            disabled={upsertPool.isPending}
          >
            {locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {locked ? "Unlock" : "Lock"}
          </Button>

          <div className="ml-auto flex items-center gap-6 text-sm font-mono">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Total Points</div>
              <div className="font-semibold">{totalPoints}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Per Point</div>
              <div className="font-semibold">{valuePerPoint > 0 ? fmtMoney(valuePerPoint) : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Distributed</div>
              <div className="font-semibold">{poolAmount > 0 ? fmtMoney(totalDistributed) : "—"}</div>
            </div>
          </div>
        </div>

        <DataTable className="text-xs">
          <DTHead>
            <DTRow className="bg-primary text-primary-foreground hover:bg-primary [&_th]:text-primary-foreground [&_th]:font-semibold">
              <DTHeader className="w-8 text-center">#</DTHeader>
              <DTHeader>Name</DTHeader>
              {DAYS.map((d, i) => (
                <DTHeader key={d} align="center" className="px-1 w-12">
                  <div className="text-[10px] leading-tight">{d}</div>
                  <div className="text-[9px] font-normal opacity-80">{fmtDateOnly(days[i]).slice(0, 5)}</div>
                </DTHeader>
              ))}
              <DTHeader align="center" className="w-14">Hours</DTHeader>
              <DTHeader align="center" className="w-16">Extra</DTHeader>
              <DTHeader align="center" className="w-16">Bonus</DTHeader>
              <DTHeader align="center" className="w-14">Pts</DTHeader>
              <DTHeader align="right" className="w-24">Bonus TZS</DTHeader>
              <DTHeader align="center" className="w-16">Status</DTHeader>
            </DTRow>
          </DTHead>
          <DTBody>
            {grouped.length === 0 && (
              <DTRow>
                <DTCell colSpan={15} className="text-center text-muted-foreground py-6">
                  No staff found
                </DTCell>
              </DTRow>
            )}
            {grouped.map(({ cat, rows }) => {
              let idx = 0;
              return (
                <>
                  <DTRow key={`hdr-${cat}`} className={cn("hover:bg-transparent", CATEGORY_BAR[cat])}>
                    <DTCell colSpan={15} className="py-1 px-2 text-[11px] font-bold uppercase tracking-wider">
                      {CATEGORY_LABELS[cat] ?? cat} <span className="opacity-60 font-normal">· {rows.length}</span>
                    </DTCell>
                  </DTRow>
                  {rows.map((r) => {
                    idx += 1;
                    const bonus = calculated && !r.hasAbsent ? Math.round(r.points * valuePerPoint) : 0;
                    return (
                      <DTRow key={r.dealer.id} className={cn(r.hasAbsent && "opacity-60")}>
                        <DTCell align="center" className="text-muted-foreground font-mono text-[11px] py-1">{idx}</DTCell>
                        <DTCell className="font-medium py-1 whitespace-nowrap">
                          {r.dealer.name}
                          {r.dealer.is_pit_boss && <span className="ml-1 text-[10px] text-muted-foreground">(PB)</span>}
                        </DTCell>
                        {r.cells.map((c, i) => {
                          const display = c.att || c.shift || "";
                          return (
                            <DTCell
                              key={i}
                              align="center"
                              className={cn(
                                "px-1 py-0.5 font-mono text-[11px] leading-none border-l border-border/40",
                                cellColor(c.att, c.shift),
                              )}
                            >
                              {display || <span className="text-muted-foreground">·</span>}
                            </DTCell>
                          );
                        })}
                        <DTCell align="center" numeric className="py-1">{r.hours}</DTCell>
                        <DTCell align="center" className="py-1">
                          <Input
                            type="number"
                            className="w-14 h-7 text-center font-mono mx-auto px-1 text-xs"
                            value={r.extra}
                            disabled={locked}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setCalculated(false);
                              upsertEntry.mutate({
                                dealer_id: r.dealer.id,
                                week_start: weekStart,
                                extra_override: isNaN(v) ? 0 : v,
                                bonus_points: r.bonusPts,
                              });
                            }}
                          />
                        </DTCell>
                        <DTCell align="center" className="py-1">
                          <Input
                            type="number"
                            className="w-14 h-7 text-center font-mono mx-auto px-1 text-xs"
                            value={r.bonusPts || ""}
                            placeholder="0"
                            disabled={locked}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setCalculated(false);
                              upsertEntry.mutate({
                                dealer_id: r.dealer.id,
                                week_start: weekStart,
                                extra_override: r.extra,
                                bonus_points: isNaN(v) ? 0 : v,
                              });
                            }}
                          />
                        </DTCell>
                        <DTCell align="center" numeric className="font-semibold py-1">{r.points}</DTCell>
                        <DTCell align="right" numeric className="font-semibold py-1">
                          {calculated && !r.hasAbsent
                            ? fmtMoney(bonus)
                            : <span className="text-muted-foreground">—</span>}
                        </DTCell>
                        <DTCell align="center" className="text-[10px] py-1">
                          {r.hasAbsent ? (
                            <span className="text-destructive font-semibold">Excluded</span>
                          ) : (
                            <span className="text-muted-foreground">Eligible</span>
                          )}
                        </DTCell>
                      </DTRow>
                    );
                  })}
                </>
              );
            })}
          </DTBody>
        </DataTable>

        {!calculated && (
          <p className="mt-3 text-xs text-muted-foreground print:hidden">
            Enter the total bonus amount and press <strong>Calculate</strong>. Then <strong>Lock</strong> to save the distribution.
          </p>
        )}
      </PageSection>
    </PageShell>
  );
}
