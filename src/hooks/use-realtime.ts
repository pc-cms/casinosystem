import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getConnectionTier, onConnectionChange, initConnectionMonitor, type ConnectionTier } from "@/lib/connection-quality";

/**
 * Adaptive realtime subscriptions.
 * - Fast connection: full Supabase realtime on all tables
 * - Slow connection (2G/3G): polling only on critical tables
 * - Offline: no subscriptions, rely on cached data
 */
export const useRealtimeSubscriptions = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  const [tier, setTier] = useState<ConnectionTier>(getConnectionTier);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitor connection quality
  useEffect(() => {
    initConnectionMonitor();
    const unsub = onConnectionChange(setTier);
    return unsub;
  }, []);

  useEffect(() => {
    if (!casinoId) return;

    // Cleanup previous
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (tier === "offline") return;

    if (tier === "fast") {
      // Full realtime — all critical tables with casino_id filter where possible
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
          (payload) => {
            // player_tags has no casino_id — invalidate players which will re-fetch with casino filter
            qc.invalidateQueries({ queryKey: ["players"] });
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "player_cards" },
          () => {
            // player_cards has no casino_id — invalidate players
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
    } else {
      // Slow connection — realtime ONLY for transactions + breaklist (critical)
      const channel = supabase
        .channel("cms-realtime-lite")
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
          { event: "*", schema: "public", table: "breaklist", filter: `casino_id=eq.${casinoId}` },
          () => {
            qc.invalidateQueries({ queryKey: ["breaklist"] });
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Poll other tables every 60s on slow connections
      pollRef.current = setInterval(() => {
        if (navigator.onLine) {
          qc.invalidateQueries({ queryKey: ["players"] });
          qc.invalidateQueries({ queryKey: ["expenses"] });
          qc.invalidateQueries({ queryKey: ["table-tracker"] });
          qc.invalidateQueries({ queryKey: ["pit-rota"] });
          qc.invalidateQueries({ queryKey: ["casino-visits-today"] });
        }
      }, 60_000);
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [casinoId, qc, tier]);
};
