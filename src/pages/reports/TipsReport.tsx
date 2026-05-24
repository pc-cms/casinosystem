/**
 * TipsReport — single consolidated tips record for manager / floor_manager /
 * surveillance / finance_manager / super_admin. Shows totals per type for the
 * selected month at the top, then a per-shift breakdown of all tip
 * transactions (Live / Poker / Floor).
 */
import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { useTipsByRange } from "@/hooks/use-tips";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateOnly, fmtDateTime } from "@/lib/format-date";

interface ShiftRow {
  id: string;
  business_date: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
}

const useShiftsByRange = (startIso: string, endIso: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["shifts-range", casinoId, startIso, endIso],
    enabled: !!casinoId,
    queryFn: async () => {
      if (!casinoId) return [] as ShiftRow[];
      const { data, error } = await supabase
        .from("shifts")
        .select("id, business_date, opened_at, closed_at, status")
        .eq("casino_id", casinoId)
        .gte("business_date", startIso)
        .lte("business_date", endIso)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ShiftRow[];
    },
    staleTime: 30_000,
  });
};

export default function TipsReport() {
  const [anchor, setAnchor] = useState(new Date());
  const monthStart = format(startOfMonth(anchor), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(anchor), "yyyy-MM-dd");

  const { data: rows = [] } = useTipsByRange(
    ["tips_live", "tips_poker", "tips_floor"],
    monthStart,
    monthEnd,
  );
  const { data: shifts = [] } = useShiftsByRange(monthStart, monthEnd);

  const totals = useMemo(() => {
    let live = 0, poker = 0, floor = 0;
    rows.forEach(r => {
      const a = Number(r.amount) || 0;
      if (r.type === "tips_live") live += a;
      else if (r.type === "tips_poker") poker += a;
      else if (r.type === "tips_floor") floor += a;
    });
    return { live, poker, floor, total: live + poker + floor };
  }, [rows]);

  const byShift = useMemo(() => {
    const m = new Map<string, { live: number; poker: number; floor: number; rows: typeof rows }>();
    rows.forEach(r => {
      const k = r.shift_id || "no_shift";
      const cur = m.get(k) || { live: 0, poker: 0, floor: 0, rows: [] as typeof rows };
      const a = Number(r.amount) || 0;
      if (r.type === "tips_live") cur.live += a;
      else if (r.type === "tips_poker") cur.poker += a;
      else if (r.type === "tips_floor") cur.floor += a;
      cur.rows.push(r);
      m.set(k, cur);
    });
    return m;
  }, [rows]);

  const shiftRows = useMemo(() => {
    return shifts
      .map(s => ({ shift: s, agg: byShift.get(s.id) }))
      .filter(x => x.agg);
  }, [shifts, byShift]);

  return (
    <PageShell>
      <PageHeader icon={Coins} title="Tips" subtitle={format(anchor, "MMMM yyyy")}>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setAnchor(addMonths(anchor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addMonths(anchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      {/* Period totals — Live total is the headline */}
      <PageSection>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-primary/10 p-4">
            <div className="text-xs uppercase text-muted-foreground">Live · Period Total</div>
            <div className="text-2xl font-mono font-bold mt-1">{formatNumberSpaces(totals.live)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase text-muted-foreground">Poker</div>
            <div className="text-2xl font-mono mt-1">{formatNumberSpaces(totals.poker)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase text-muted-foreground">Floor</div>
            <div className="text-2xl font-mono mt-1">{formatNumberSpaces(totals.floor)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase text-muted-foreground">All Tips</div>
            <div className="text-2xl font-mono mt-1">{formatNumberSpaces(totals.total)}</div>
          </div>
        </div>
      </PageSection>

      {/* Per-shift breakdown */}
      <PageSection>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Business Day</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Shift</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Live</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Poker</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Floor</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {shiftRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No tips this month</td></tr>
              ) : shiftRows.map(({ shift, agg }) => {
                const total = (agg!.live + agg!.poker + agg!.floor);
                return (
                  <tr key={shift.id} className="border-t">
                    <td className="px-3 py-2">{fmtDateOnly(shift.business_date)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {fmtDateTime(shift.opened_at)}
                      {shift.closed_at ? ` → ${fmtDateTime(shift.closed_at)}` : " · open"}
                    </td>
                    <td className="px-3 py-2 text-right">{agg!.live ? formatNumberSpaces(agg!.live) : "·"}</td>
                    <td className="px-3 py-2 text-right">{agg!.poker ? formatNumberSpaces(agg!.poker) : "·"}</td>
                    <td className="px-3 py-2 text-right">{agg!.floor ? formatNumberSpaces(agg!.floor) : "·"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatNumberSpaces(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
