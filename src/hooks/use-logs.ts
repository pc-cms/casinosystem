import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const useActivityLogs = (limit = 100) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["activity-logs", casinoId, limit],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useClientSessionsTotalBet = (date?: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["client-sessions-total-bet", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return 0;
      let query = supabase
        .from("client_sessions")
        .select("total_bet")
        .eq("casino_id", casinoId)
        .not("stopped_at", "is", null);
      if (date) {
        query = query.gte("started_at", `${date}T00:00:00`).lte("started_at", `${date}T23:59:59`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reduce((sum, s) => sum + Number(s.total_bet || 0), 0);
    },
    enabled: !!casinoId,
    staleTime: 1000 * 60 * 2,
  });
};
