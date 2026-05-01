import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Returns visits relevant to "right now" — i.e. every visit for the current
 * casino that has NOT been checked out yet, regardless of which business day
 * it was opened on. This guarantees "In Casino" shows the true live count
 * even if some guests were not checked out before the 05:00 rollover.
 *
 * Closed visits from today can still be queried separately if needed via
 * `useVisitsByDate`.
 */
export const useVisitsToday = (selectFields = "*, players(first_name, last_name, nickname, photo_url, status, id_number, category, player_type, player_cards(*), player_tags(*))") => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["casino-visits-open", casinoId, selectFields],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select(selectFields)
        .eq("casino_id", casinoId)
        .is("checked_out_at", null)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 30,
  });
};

