/**
 * useCashChecksByBusinessDate — fetches all cash_counts of count_type='check'
 * for the user's casino on a given business date (Africa/Dar_es_Salaam, 05:00 rollover).
 *
 * A check belongs to the BUSINESS DAY of its shift, not to the calendar day of
 * its `created_at`. This matters for the closing seed (inserted right after
 * 05:00 EAT — technically next calendar day, but operationally it closes the
 * previous business day). We resolve membership via the shift's `opened_at`:
 *  - find shifts whose `opened_at` falls in the business-day window
 *  - return all cash_counts attached to those shifts
 *  - plus orphan checks (no shift_id) whose `created_at` falls in the window
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const businessDayWindowUtc = (businessDate: string) => {
  // Africa/Dar_es_Salaam = UTC+3 fixed (no DST). Business day starts 05:00 EAT
  // → 02:00 UTC of the same calendar date, ends 02:00 UTC of next date.
  const start = new Date(`${businessDate}T02:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const useCashChecksByBusinessDate = (businessDate: string | undefined, enabled = true) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["cash-checks-by-date", casinoId, businessDate],
    queryFn: async () => {
      if (!casinoId || !businessDate) return [];
      const { start, end } = businessDayWindowUtc(businessDate);

      // 1. Find shifts whose opening time falls within this business day.
      const { data: shifts, error: shiftErr } = await supabase
        .from("shifts")
        .select("id")
        .eq("casino_id", casinoId)
        .gte("opened_at", start)
        .lt("opened_at", end);
      if (shiftErr) throw shiftErr;
      const shiftIds = (shifts || []).map((s: any) => s.id);

      // 2. Fetch all checks attached to those shifts (covers closing seed that
      //    lands after the 05:00 rollover).
      const byShiftPromise = shiftIds.length
        ? supabase
            .from("cash_counts")
            .select("*")
            .eq("casino_id", casinoId)
            .eq("count_type", "check")
            .in("shift_id", shiftIds)
        : Promise.resolve({ data: [], error: null } as any);

      // 3. Fetch orphan checks (no shift_id) for completeness.
      const orphanPromise = supabase
        .from("cash_counts")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("count_type", "check")
        .is("shift_id", null)
        .gte("created_at", start)
        .lt("created_at", end);

      const [byShift, orphan] = await Promise.all([byShiftPromise, orphanPromise]);
      if ((byShift as any).error) throw (byShift as any).error;
      if (orphan.error) throw orphan.error;

      const merged = [...((byShift as any).data || []), ...(orphan.data || [])];
      // De-dupe by id, then sort newest first.
      const seen = new Set<string>();
      const unique = merged.filter((r: any) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      unique.sort((a: any, b: any) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      return unique;
    },
    enabled: enabled && !!casinoId && !!businessDate,
  });
};
