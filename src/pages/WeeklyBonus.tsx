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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_LABELS: Record<string, string> = {
  trainee: "T",
  dealer: "D",
  inspector: "I",
  expert: "E",
  pit_boss: "PB",
};
const CATEGORY_ORDER: Record<string, number> = {
  trainee: 0, dealer: 1, inspector: 2, expert: 3, pit_boss: 4,
};

// Border color per shift type (frames the cell instead of fill).
const SHIFT_BORDER: Record<string, string> = {
  D: "border-amber-400 dark:border-amber-400",
  M: "border-teal-500 dark:border-teal-400",
  N: "border-blue-600 dark:border-blue-400",
  G: "border-indigo-500 dark:border-indigo-400",
  L: "border-emerald-500 dark:border-emerald-400",
  E: "border-purple-500 dark:border-purple-400",
};

const DENOMS = [10000, 5000, 2000, 1000];

const parseHours = (val: string | null | undefined): { hours: number; absent: boolean; sick: boolean } => {
  if (!val) return { hours: 0, absent: false, sick: false };
  if (val === "A") return { hours: 0, absent: true, sick: false };
  if (val === "S") return { hours: 0, absent: false, sick: true };
  const m = /^(\d+)(S?)$/.exec(val);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n)) return { hours: n, absent: false, sick: !!m[2] };
  }
  return { hours: 0, absent: false, sick: false };
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

// Greedy breakdown for amounts that are multiples of 1000.
const breakdown = (amt: number): Record<number, number> => {
  const out: Record<number, number> = {};
  let rem = Math.max(0, Math.round(amt));
  for (const d of DENOMS) {
    out[d] = Math.floor(rem / d);
    rem -= out[d] * d;
  }
  return out;
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

  const rows = useMemo(() => {
    const activeDealers = (dealers as any[]).filter((d) => d.is_active !== false);
    const attMap = new Map<string, string>();
    attendance.forEach((a: any) => attMap.set(`${a.dealer_id}|${a.date}`, a.value));
    const rotaMap = new Map<string, string>();
    rota.forEach((r: any) => rotaMap.set(`${r.dealer_id}|${r.date}`, r.shift));
    const entryMap = new Map<string, { extra_override: number | null; bonus_points: number }>();
    entries.forEach((e: any) => entryMap.set(e.dealer_id, { extra_override: e.extra_override, bonus_points: e.bonus_points }));

    const out = activeDealers.map((d) => {
      let hours = 0;
      let extraComputed = 0;
      let hasAbsent = false;
      const cells = days.map((day) => {
        const att = attMap.get(`${d.id}|${day}`) ?? "";
        const shift = rotaMap.get(`${d.id}|${day}`) ?? "";
        const p = parseHours(att);
        if (p.absent) hasAbsent = true;
        hours += p.hours;
        if (shift === "E") extraComputed += 1;
        return { att, shift, parsed: p };
      });
      const entry = entryMap.get(d.id);
      const extra = entry?.extra_override ?? extraComputed;
      const bonusPts = entry?.bonus_points ?? 0;
      const points = hasAbsent ? 0 : (hours + extra + bonusPts);
      const cat = d.is_pit_boss ? "pit_boss" : (d.category || "dealer");
      return { dealer: d, cells, hours, extraComputed, extra, bonusPts, hasAbsent, points, cat };
    });

    return out.sort((a, b) => {
      const c = (CATEGORY_ORDER[a.cat] ?? 99) - (CATEGORY_ORDER[b.cat] ?? 99);
      if (c !== 0) return c;
      return a.dealer.name.localeCompare(b.dealer.name);
    });
  }, [dealers, attendance, rota, entries, days]);

  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const poolAmount = calculated ? (parseInt(poolInput.replace(/\s/g, ""), 10) || 0) : 0;
  const valuePerPoint = totalPoints > 0 && poolAmount > 0 ? poolAmount / totalPoints : 0;

  // Round each individual bonus to nearest 1000.
  const roundedBonus = (pts: number) =>
    Math.round((pts * valuePerPoint) / 1000) * 1000;

  const totalDistributed = rows.reduce(
    (s, r) => s + (calculated && !r.hasAbsent ? roundedBonus(r.points) : 0),
    0,
  );

  // Column totals per denomination
  const denomTotals: Record<number, number> = useMemo(() => {
    const t: Record<number, number> = { 10000: 0, 5000: 0, 2000: 0, 1000: 0 };
    if (!calculated) return t;
    rows.forEach((r) => {
      if (r.hasAbsent) return;
      const b = breakdown(roundedBonus(r.points));
      for (const d of DENOMS) t[d] += b[d];
    });
    return t;
  }, [rows, calculated, valuePerPoint]);

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
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Bonus Balance</div>
              <div
                className={cn(
                  "font-semibold",
                  poolAmount > 0 && totalDistributed - poolAmount > 0 && "cms-amount-negative",
                  poolAmount > 0 && totalDistributed - poolAmount < 0 && "cms-amount-positive",
                )}
                title="Pool − Distributed (positive = leftover, negative = overspend due to rounding)"
              >
                {poolAmount > 0
                  ? `${totalDistributed - poolAmount > 0 ? "+" : ""}${fmtMoney(totalDistributed - poolAmount)}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        <DataTable className="text-xs">
          <DTHead>
            <DTRow className="bg-primary text-primary-foreground hover:bg-primary [&_th]:text-primary-foreground [&_th]:font-semibold">
              <DTHeader className="w-8 text-center">#</DTHeader>
              <DTHeader className="min-w-[260px]">Name</DTHeader>
              <DTHeader align="center" className="w-12">Cat</DTHeader>
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
              {DENOMS.map((d) => (
                <DTHeader key={d} align="center" className="w-12">
                  {d / 1000}k
                </DTHeader>
              ))}
            </DTRow>
          </DTHead>
          <DTBody>
            {rows.length === 0 && (
              <DTRow>
                <DTCell colSpan={18} className="text-center text-muted-foreground py-6">
                  No staff found
                </DTCell>
              </DTRow>
            )}
            {rows.map((r, idx) => {
              const bonus = calculated && !r.hasAbsent ? roundedBonus(r.points) : 0;
              const bd = bonus > 0 ? breakdown(bonus) : null;
              return (
                <DTRow key={r.dealer.id} className={cn(r.hasAbsent && "opacity-60")}>
                  <DTCell align="center" className="text-muted-foreground font-mono text-[11px] py-1">{idx + 1}</DTCell>
                  <DTCell className="font-medium py-1 whitespace-nowrap min-w-[260px]">
                    {r.dealer.name}
                  </DTCell>
                  <DTCell align="center" className="font-mono text-[10px] font-semibold py-1 text-muted-foreground">
                    {CATEGORY_LABELS[r.cat] ?? r.cat}
                  </DTCell>
                  {r.cells.map((c, i) => {
                    const border = c.shift ? SHIFT_BORDER[c.shift] : "border-transparent";
                    const display = c.parsed.absent
                      ? "A"
                      : c.parsed.sick && c.parsed.hours === 0
                        ? "S"
                        : c.parsed.hours > 0
                          ? `${c.parsed.hours}${c.parsed.sick ? "S" : ""}`
                          : "";
                    const textCls = c.parsed.absent
                      ? "text-destructive font-bold"
                      : c.parsed.sick
                        ? "text-orange-600 dark:text-orange-300 font-semibold"
                        : "";
                    return (
                      <DTCell
                        key={i}
                        align="center"
                        className={cn(
                          "px-1 py-0.5 font-mono text-[11px] leading-none border-2",
                          border,
                          textCls,
                        )}
                      >
                        {display || <span className="text-muted-foreground/40">·</span>}
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
                    {bonus > 0
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
                  {DENOMS.map((d) => (
                    <DTCell
                      key={d}
                      align="center"
                      numeric
                      className={cn("py-1 font-mono text-[11px]", !bd && "text-muted-foreground/40")}
                    >
                      {bd ? (bd[d] || <span className="text-muted-foreground/30">·</span>) : "·"}
                    </DTCell>
                  ))}
                </DTRow>
              );
            })}
            {calculated && rows.length > 0 && (
              <DTRow className="bg-muted/40 font-semibold">
                <DTCell colSpan={11 + 7} className="text-right py-2 text-xs uppercase tracking-wider">
                  Totals
                </DTCell>
                <DTCell align="right" numeric className="py-2">{fmtMoney(totalDistributed)}</DTCell>
                <DTCell />
                {DENOMS.map((d) => (
                  <DTCell key={d} align="center" numeric className="py-2 font-mono">
                    {denomTotals[d] || <span className="text-muted-foreground/30">·</span>}
                  </DTCell>
                ))}
              </DTRow>
            )}
          </DTBody>
        </DataTable>

        {!calculated && (
          <p className="mt-3 text-xs text-muted-foreground print:hidden">
            Enter the total bonus amount and press <strong>Calculate</strong>. Bonuses round to the nearest 1,000 TZS. Then <strong>Lock</strong> to save.
          </p>
        )}
      </PageSection>
    </PageShell>
  );
}
