import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";

/**
 * Returns visits relevant to the operator NOW:
 *  - every visit currently open (`checked_out_at IS NULL`) regardless of business day
 *    → guarantees "In Casino" stays correct even if some guests were not checked out
 *      before the 05:00 EAT rollover
 *  - PLUS every visit checked in OR out during today's business day, so the
 *    "Checked out" tab on /in-casino still works.
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
        // open visits OR visits with today's business date (closed or open)
        .or(`checked_out_at.is.null,date.eq.${today}`)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 30,
  });
};
