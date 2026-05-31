/**
 * Unified expenses-by-business-day hook for the Closings · Expenses tab
 * and the /expenses/daily manager page. Returns ALL sources (live_game, slots, office).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const useDailyExpenses = (businessDate?: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["daily-expenses", casinoId, businessDate],
    queryFn: async () => {
      if (!casinoId || !businessDate) return [];
      const { businessDayHourUTC } = await import("@/lib/business-day");
      const { data, error } = await supabase
        .from("expenses")
        .select("*, players(id, first_name, last_name)")
        .eq("casino_id", casinoId)
        .gte("created_at", businessDayHourUTC(businessDate, 11))
        .lt("created_at", businessDayHourUTC(businessDate, 11 + 24))
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId && !!businessDate,
    staleTime: 30_000,
  });
};
