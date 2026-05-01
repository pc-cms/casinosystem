import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate, businessDayHourUTC } from "@/lib/business-day";

/**
 * Returns visits for the current business day, with the operational entry window:
 *
 *  - "In Casino" = visits open (checked_out_at IS NULL) AND checked_in_at >= today 13:00 EAT.
 *    Visits started before 13:00 EAT of the current business day are intentionally hidden.
 *  - "Checked out" = visits with date = today AND checked_out_at IS NOT NULL.
 *
 * The 05:00 EAT auto-close cron closes any open visits at the rollover.
 */
export const useVisitsToday = (selectFields = "*, players(first_name, last_name, nickname, photo_url, status, id_number, category, player_type, player_cards(*), player_tags(*))") => {
  const { casinoId } = useAuth();
  const today = getBusinessDate();
  const windowStartUTC = businessDayHourUTC(today, 13); // 13:00 EAT of current business day

  return useQuery({
    queryKey: ["casino-visits-live", casinoId, today, selectFields],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select(selectFields)
        .eq("casino_id", casinoId)
        .eq("date", today)
        // Either still inside the casino AND checked in after 13:00 EAT,
        // or already checked out today (kept for the "Checked out" tab).
        .or(`and(checked_out_at.is.null,checked_in_at.gte.${windowStartUTC}),checked_out_at.not.is.null`)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 30,
  });
};
