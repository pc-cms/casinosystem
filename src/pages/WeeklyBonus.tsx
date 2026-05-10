import { useMemo, useState } from "react";
import { Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell,
} from "@/components/ui/data-table";
import { useDealers, useDealerAttendanceRange } from "@/hooks/use-dealers";
import { usePitRotaRange } from "@/hooks/use-dealers";
import {
  useWeeklyBonusEntries, useWeeklyBonusPool,
  useUpsertBonusEntry, useUpsertBonusPool,
  getWeekStartSunday, addDaysIso,
} from "@/hooks/use-weekly-bonus";
import { fmtDateOnly } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Parse attendance value to {kind, hours}, mirroring AttendanceGrid.
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

  // Local pool input, synced with server value
  const [poolInput, setPoolInput] = useState<string>("");
  useMemo(() => {
    setPoolInput(pool?.pool_amount ? String(pool.pool_amount) : "");
  }, [pool?.pool_amount]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);

  // Build row data
  const rows = useMemo(() => {
    const activeDealers = (dealers as any[]).filter((d) => d.is_active !== false);
    const attMap = new Map<string, string>();
    attendance.forEach((a: any) => attMap.set(`${a.dealer_id}|${a.date}`, a.value));
    const rotaMap = new Map<string, string>();
    rota.forEach((r: any) => rotaMap.set(`${r.dealer_id}|${r.date}`, r.shift));
    const entryMap = new Map<string, { extra_override: number | null; bonus_points: number }>();
    entries.forEach((e: any) => entryMap.set(e.dealer_id, { extra_override: e.extra_override, bonus_points: e.bonus_points }));

    return activeDealers.map((d) => {
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
  }, [dealers, attendance, rota, entries, days]);

  const totalPoints = useMemo(() => rows.reduce((s, r) => s + r.points, 0), [rows]);
  const poolAmount = pool?.is_calculated ? pool.pool_amount : 0;
  const valuePerPoint = totalPoints > 0 && poolAmount > 0 ? poolAmount / totalPoints : 0;

  const navWeek = (offset: number) => setWeekStart((w) => addDaysIso(w, offset * 7));

  const handleCalculate = async () => {
    const amt = parseInt(poolInput.replace(/\s/g, ""), 10);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid bonus amount");
      return;
    }
    await upsertPool.mutateAsync({ week_start: weekStart, pool_amount: amt, calculate: true });
    toast.success("Bonus calculated");
  };

  const handleClear = async () => {
    await upsertPool.mutateAsync({ week_start: weekStart, pool_amount: 0, calculate: false });
    setPoolInput("");
  };

  const isThisWeek = weekStart === getWeekStartSunday(new Date());
  const totalDistributed = rows.reduce((s, r) => s + Math.round(r.points * valuePerPoint), 0);

  return (
    <PageShell>
      <PageHeader
        icon={Gift}
        title="Weekly Bonus"
        subtitle="Distribute a bonus pool across Live Game staff (Sun – Sat)"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-mono px-2 min-w-[180px] text-center">
            {fmtDateOnly(weekStart)} – {fmtDateOnly(weekEnd)}
            {isThisWeek && <span className="ml-2 text-xs text-primary">(this week)</span>}
          </div>
          <Button variant="outline" size="icon" onClick={() => navWeek(1)} aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </PageHeader>

      <PageSection>
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-md border border-border bg-muted/20">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Bonus Pool (TZS)</label>
            <Input
              type="number"
              inputMode="numeric"
              className="w-44 font-mono"
              value={poolInput}
              onChange={(e) => setPoolInput(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button onClick={handleCalculate} disabled={upsertPool.isPending}>
            OK · Calculate
          </Button>
          {pool?.is_calculated && (
            <Button variant="outline" onClick={handleClear}>Reset</Button>
          )}
          <div className="ml-auto flex items-center gap-6 text-sm font-mono">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Total Points</div>
              <div className="font-semibold">{totalPoints}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Per Point</div>
              <div className="font-semibold">{valuePerPoint > 0 ? fmtMoney(valuePerPoint) : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Distributed</div>
              <div className="font-semibold">{poolAmount > 0 ? fmtMoney(totalDistributed) : "—"}</div>
            </div>
          </div>
        </div>

        <DataTable>
          <DTHead>
            <DTRow>
              <DTHeader>Name</DTHeader>
              {DAYS.map((d, i) => (
                <DTHeader key={d} align="center" className="px-1">
                  <div className="text-[10px]">{d}</div>
                  <div className="text-[9px] font-normal opacity-70">{fmtDateOnly(days[i]).slice(0, 5)}</div>
                </DTHeader>
              ))}
              <DTHeader align="center">Hours</DTHeader>
              <DTHeader align="center">Extra</DTHeader>
              <DTHeader align="center">Bonus Pts</DTHeader>
              <DTHeader align="center">Points</DTHeader>
              <DTHeader align="right">Bonus (TZS)</DTHeader>
              <DTHeader align="center">Status</DTHeader>
            </DTRow>
          </DTHead>
          <DTBody>
            {rows.length === 0 && (
              <DTRow>
                <DTCell colSpan={7 + 6} className="text-center text-muted-foreground py-6">
                  No staff found
                </DTCell>
              </DTRow>
            )}
            {rows.map((r) => {
              const bonus = pool?.is_calculated && !r.hasAbsent
                ? Math.round(r.points * valuePerPoint)
                : 0;
              return (
                <DTRow key={r.dealer.id} className={cn(r.hasAbsent && "opacity-60")}>
                  <DTCell className="font-medium">
                    {r.dealer.name}
                    {r.dealer.is_pit_boss && <span className="ml-1 text-[10px] text-muted-foreground">(PB)</span>}
                  </DTCell>
                  {r.cells.map((c, i) => (
                    <DTCell key={i} align="center" className="px-1 font-mono text-xs">
                      <div>{c.att || <span className="text-muted-foreground">·</span>}</div>
                      {c.shift && <div className="text-[9px] text-muted-foreground">{c.shift}</div>}
                    </DTCell>
                  ))}
                  <DTCell align="center" numeric>{r.hours}</DTCell>
                  <DTCell align="center">
                    <Input
                      type="number"
                      className="w-16 h-8 text-center font-mono mx-auto"
                      value={r.extra}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        upsertEntry.mutate({
                          dealer_id: r.dealer.id,
                          week_start: weekStart,
                          extra_override: isNaN(v) ? 0 : v,
                          bonus_points: r.bonusPts,
                        });
                      }}
                    />
                  </DTCell>
                  <DTCell align="center">
                    <Input
                      type="number"
                      className="w-16 h-8 text-center font-mono mx-auto"
                      value={r.bonusPts || ""}
                      placeholder="0"
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        upsertEntry.mutate({
                          dealer_id: r.dealer.id,
                          week_start: weekStart,
                          extra_override: r.extra,
                          bonus_points: isNaN(v) ? 0 : v,
                        });
                      }}
                    />
                  </DTCell>
                  <DTCell align="center" numeric className="font-semibold">{r.points}</DTCell>
                  <DTCell align="right" numeric className="font-semibold">
                    {pool?.is_calculated ? fmtMoney(bonus) : <span className="text-muted-foreground">—</span>}
                  </DTCell>
                  <DTCell align="center" className="text-xs">
                    {r.hasAbsent ? (
                      <span className="text-destructive font-semibold">Excluded</span>
                    ) : (
                      <span className="text-muted-foreground">Eligible</span>
                    )}
                  </DTCell>
                </DTRow>
              );
            })}
          </DTBody>
        </DataTable>

        {!pool?.is_calculated && (
          <p className="mt-3 text-xs text-muted-foreground">
            Enter the total bonus amount above and press <strong>OK · Calculate</strong> to distribute.
          </p>
        )}
      </PageSection>
    </PageShell>
  );
}
