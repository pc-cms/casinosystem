/**
 * Prefetch critical data after login so it's available instantly
 * and cached for offline use.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function usePrefetchCriticalData() {
  const qc = useQueryClient();
  const { casinoId, user, roles } = useAuth();

  useEffect(() => {
    if (!casinoId || !user) return;

    // Prefetch players — must match usePlayers() select & queryKey exactly
    qc.prefetchQuery({
      queryKey: ["players", casinoId],
      queryFn: async () => {
        const { data } = await supabase
          .from("players")
          .select("*, player_cards(*), player_tags(*)")
          .eq("casino_id", casinoId)
          .order("last_name");
        return data ?? [];
      },
      staleTime: 1000 * 60 * 5,
    });

    // Prefetch active visits — align key with Dashboard's useTodayVisits
    const { getBusinessDate } = require("@/lib/business-day");
    const today = getBusinessDate();
    qc.prefetchQuery({
      queryKey: ["casino-visits-today", casinoId, today],
      queryFn: async () => {
        const { data } = await supabase
          .from("casino_visits")
          .select("*, players(first_name, last_name, nickname, photo_url, status, player_tags(tag), id_number)")
          .eq("casino_id", casinoId)
          .eq("date", today)
          .is("checked_out_at", null);
        return data ?? [];
      },
      staleTime: 1000 * 60 * 2,
    });

    // Prefetch tables — must match useGamingTables() exactly
    if (roles.some(r => ["cashier", "pit", "manager", "finance_manager"].includes(r))) {
      qc.prefetchQuery({
        queryKey: ["gaming-tables", casinoId],
        queryFn: async () => {
          const { data } = await supabase
            .from("gaming_tables")
            .select("*")
            .eq("casino_id", casinoId)
            .order("name");
          return data ?? [];
        },
        staleTime: 1000 * 60 * 5,
      });
    }

    // Prefetch dealers — must match useDealers() exactly
    if (roles.some(r => ["pit", "manager"].includes(r))) {
      qc.prefetchQuery({
        queryKey: ["dealers", casinoId],
        queryFn: async () => {
          const { data } = await supabase
            .from("dealers")
            .select("*")
            .eq("casino_id", casinoId)
            .order("name");
          return data ?? [];
        },
        staleTime: 1000 * 60 * 10,
      });
    }
  }, [casinoId, user, roles, qc]);
}
