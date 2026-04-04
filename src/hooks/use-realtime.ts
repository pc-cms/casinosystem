import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Realtime subscriptions for wired LAN environment.
 * Always uses full Supabase realtime — no polling fallback needed.
 * Brief disconnections are handled by Supabase client reconnection.
 */
export const useRealtimeSubscriptions = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!casinoId) return;

    // Cleanup previous
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("cms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["player-economy"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["players"] });
          qc.invalidateQueries({ queryKey: ["player-economy"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "breaklist", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["breaklist"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["expenses"] });
          qc.invalidateQueries({ queryKey: ["player-economy"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_tags" },
        () => {
          qc.invalidateQueries({ queryKey: ["players"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_cards" },
        () => {
          qc.invalidateQueries({ queryKey: ["players"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_tracker", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["table-tracker"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pit_rota", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["pit-rota"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["activity-logs"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "casino_visits", filter: `casino_id=eq.${casinoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["casino-visits-today"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [casinoId, qc]);
};
