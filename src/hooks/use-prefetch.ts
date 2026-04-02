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

    // Prefetch players (needed by cage, reception, pit, guests)
    qc.prefetchQuery({
      queryKey: ["players", casinoId],
      queryFn: async () => {
        const { data } = await supabase
          .from("players")
          .select("*, player_tags(tag), player_cards(card_number, rfid_uid, is_active)")
          .eq("casino_id", casinoId);
        return data ?? [];
      },
      staleTime: 1000 * 60 * 5, // 5 min
    });

    // Prefetch active visits (reception, guests)
    qc.prefetchQuery({
      queryKey: ["casino-visits-active", casinoId],
      queryFn: async () => {
        const { data } = await supabase
          .from("casino_visits")
          .select("*")
          .eq("casino_id", casinoId)
          .is("checked_out_at", null);
        return data ?? [];
      },
      staleTime: 1000 * 60 * 2,
    });

    // Prefetch tables (cage, pit)
    if (roles.some(r => ["cashier", "pit", "manager", "finance_manager"].includes(r))) {
      qc.prefetchQuery({
        queryKey: ["gaming-tables", casinoId],
        queryFn: async () => {
          const { data } = await supabase
            .from("gaming_tables")
            .select("*")
            .eq("casino_id", casinoId);
          return data ?? [];
        },
        staleTime: 1000 * 60 * 5,
      });
    }

    // Prefetch dealers (pit)
    if (roles.some(r => ["pit", "manager"].includes(r))) {
      qc.prefetchQuery({
        queryKey: ["dealers", casinoId],
        queryFn: async () => {
          const { data } = await supabase
            .from("dealers")
            .select("*")
            .eq("casino_id", casinoId)
            .eq("is_active", true);
          return data ?? [];
        },
        staleTime: 1000 * 60 * 10,
      });
    }
  }, [casinoId, user, roles, qc]);
}
