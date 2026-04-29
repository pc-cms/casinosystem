import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Single player + cards + tags. */
export const usePlayer = (id: string | undefined) => {
  return useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("players")
        .select("*, player_cards(*), player_tags(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

/** All visits for a player (cross-casino if RLS allows). */
export const usePlayerVisits = (playerId: string | undefined) => {
  return useQuery({
    queryKey: ["player-visits", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select("*, casinos(name, code)")
        .eq("player_id", playerId)
        .order("checked_in_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });
};

/** Client (table) sessions filtered by date range. */
export const usePlayerSessions = (
  playerId: string | undefined,
  range?: { from: string; to: string }
) => {
  return useQuery({
    queryKey: ["player-sessions", playerId, range?.from, range?.to],
    queryFn: async () => {
      if (!playerId) return [];
      let q = supabase
        .from("client_sessions")
        .select("*, gaming_tables(name, game_type)")
        .eq("player_id", playerId)
        .order("started_at", { ascending: false })
        .limit(1000);
      if (range?.from) q = q.gte("started_at", `${range.from}T00:00:00`);
      if (range?.to) q = q.lte("started_at", `${range.to}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });
};

/** All buy/cashout transactions for a player. */
export const usePlayerTransactions = (playerId: string | undefined) => {
  return useQuery({
    queryKey: ["player-transactions", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("id, casino_id, table_id, type, amount, created_at, gaming_tables(name)")
        .eq("player_id", playerId)
        .in("type", ["buy", "cashout"])
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });
};

/** Group memberships — current and historical. */
export const usePlayerGroupHistory = (playerId: string | undefined) => {
  return useQuery({
    queryKey: ["player-group-history", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from("group_members")
        .select("*, player_groups(name, casino_id, created_at)")
        .eq("player_id", playerId)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });
};

/** Notes timeline. */
export const usePlayerNotes = (playerId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ["player-notes", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from("player_notes")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId && enabled,
  });
};
