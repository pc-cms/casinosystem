/**
 * useCashChecksByBusinessDate — fetches all cash_counts of count_type='check'
 * for the user's casino on a given business date (Africa/Dar_es_Salaam, 05:00 rollover).
 * Used by Manager / Pit / Surveillance / Finance / Super Admin to browse history.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const businessDayWindowUtc = (businessDate: string) => {
  // Africa/Dar_es_Salaam = UTC+3 fixed (no DST). Business day starts 05:00 EAT.
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
      const { data, error } = await supabase
        .from("cash_counts")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("count_type", "check")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!casinoId && !!businessDate,
  });
};
