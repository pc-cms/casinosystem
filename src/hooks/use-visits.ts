import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";

export const useVisitsToday = (selectFields = "*, players(first_name, last_name, nickname, photo_url, status, id_number, category, player_type, player_cards(*), player_tags(*))") => {
  const { casinoId } = useAuth();
  const today = getBusinessDate();
  return useQuery({
    queryKey: ["casino-visits-today", casinoId, today, selectFields],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select(selectFields)
        .eq("casino_id", casinoId)
        .eq("date", today);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 30,
  });
};
