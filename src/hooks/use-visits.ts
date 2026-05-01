import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";

/**
 * Returns visits for TODAY's business day only (Africa/Dar_es_Salaam, 05:00 rollover).
 *  - "In Casino" = visits with date = today AND checked_out_at IS NULL
 *  - "Checked out" = visits with date = today AND checked_out_at IS NOT NULL
 *
 * Guests who entered on a previous business day and were not checked out before
 * the 05:00 EAT rollover are intentionally excluded — the auto-close cron closes
 * them at rollover.
 */
export const useVisitsToday = (selectFields = "*, players(first_name, last_name, nickname, photo_url, status, id_number, category, player_type, player_cards(*), player_tags(*))") => {
  const { casinoId } = useAuth();
  const today = getBusinessDate();
  return useQuery({
    queryKey: ["casino-visits-live", casinoId, today, selectFields],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select(selectFields)
        .eq("casino_id", casinoId)
        .eq("date", today)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 30,
  });
};
