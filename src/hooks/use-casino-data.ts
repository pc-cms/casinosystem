import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";

// ============ PLAYERS ============
export const usePlayers = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["players", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("players")
        .select("*, player_cards(*), player_tags(*)")
        .eq("casino_id", casinoId)
        .order("last_name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreatePlayer = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { first_name: string; last_name: string; nickname: string; phone: string }) => {
      if (!casinoId) throw new Error("No casino");
      const { data: player, error } = await supabase
        .from("players")
        .insert({ ...input, casino_id: casinoId })
        .select()
        .single();
      if (error) throw error;

      // Generate card
      const { data: cardNum } = await supabase.rpc("generate_card_number" as any);
      await supabase.from("player_cards").insert({
        player_id: player.id,
        card_number: cardNum || `0001${Date.now().toString().slice(-4)}+`,
        card_type: "manual",
        issued_by: user?.id,
      });

      await logAction(casinoId, "player", "PLAYER_CREATED", { player_id: player.id, name: `${input.first_name} ${input.last_name}` });
      return player;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); toast.success("Player created"); },
    onError: (e) => toast.error(e.message),
  });
};

export const useUpdatePlayerStatus = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "blacklist" }) => {
      const { error } = await supabase.from("players").update({ status }).eq("id", id);
      if (error) throw error;
      await logAction(casinoId!, "player", "STATUS_CHANGED", { player_id: id, status });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); },
  });
};

export const useAddPlayerTag = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async ({ playerId, tag }: { playerId: string; tag: string }) => {
      const { error } = await supabase.from("player_tags").insert({
        player_id: playerId,
        tag,
        created_by: user?.id,
      });
      if (error) throw error;
      await logAction(casinoId!, "edit", "TAG_ADDED", { player_id: playerId, tag });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); },
    onError: (e) => toast.error(e.message),
  });
};

export const useRemovePlayerTag = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async ({ playerId, tag }: { playerId: string; tag: string }) => {
      const { error } = await supabase.from("player_tags").delete().eq("player_id", playerId).eq("tag", tag);
      if (error) throw error;
      await logAction(casinoId!, "edit", "TAG_REMOVED", { player_id: playerId, tag });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); },
  });
};

export const useIssueCard = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async ({ playerId, rfidUid }: { playerId: string; rfidUid?: string }) => {
      const { data: cardNum } = await supabase.rpc("generate_card_number" as any);
      const { error } = await supabase.from("player_cards").insert({
        player_id: playerId,
        card_number: cardNum || `0001${Date.now().toString().slice(-4)}+`,
        card_type: rfidUid ? "rfid" : "manual",
        rfid_uid: rfidUid || null,
        issued_by: user?.id,
      });
      if (error) throw error;
      await logAction(casinoId!, "player", "CARD_ISSUED", { player_id: playerId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); toast.success("Card issued"); },
    onError: (e) => toast.error(e.message),
  });
};

// ============ TRANSACTIONS ============
export const useTransactions = (date?: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["transactions", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      let query = supabase
        .from("transactions")
        .select("*, players(first_name, last_name, nickname), gaming_tables(name)")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false });
      
      if (date) {
        query = query.gte("created_at", `${date}T00:00:00`).lte("created_at", `${date}T23:59:59`);
      }
      
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreateTransaction = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      player_id: string;
      table_id: string | null;
      type: "buy" | "cashout";
      amount: number;
      chips?: Record<string, number>;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          casino_id: casinoId,
          player_id: input.player_id,
          table_id: input.table_id,
          type: input.type,
          amount: input.amount,
          chips: input.chips || null,
          operator_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      await logAction(casinoId, "transaction", input.type === "buy" ? "BUY_IN" : "CASHOUT", {
        player_id: input.player_id, amount: input.amount, table_id: input.table_id,
      });
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["player-economy"] });
      toast.success(`${vars.type === "buy" ? "Buy-in" : "Cashout"} recorded: €${vars.amount}`);
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ TABLES ============
export const useGamingTables = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["gaming-tables", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("gaming_tables")
        .select("*")
        .eq("casino_id", casinoId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

// ============ EXPENSES ============
export const useExpenses = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["expenses", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*, players(first_name, last_name)")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreateExpense = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      category: string;
      amount: number;
      description: string;
      player_id: string | null;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("expenses").insert({
        casino_id: casinoId,
        category: input.category as any,
        amount: input.amount,
        description: input.description,
        player_id: input.player_id,
        created_by: user.id,
      });
      if (error) throw error;
      await logAction(casinoId, "expense", "EXPENSE_CREATED", { category: input.category, amount: input.amount });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense recorded"); },
    onError: (e) => toast.error(e.message),
  });
};

export const useApproveExpense = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("expenses").update({
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      await logAction(casinoId!, "expense", "EXPENSE_APPROVED", { expense_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense approved"); },
  });
};

// ============ PLAYER ECONOMY ============
export const usePlayerEconomy = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["player-economy", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("player_economy")
        .select("*")
        .eq("casino_id", casinoId);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

// ============ LOGS ============
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

// ============ DEALERS ============
export const useDealers = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["dealers", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("dealers")
        .select("*")
        .eq("casino_id", casinoId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreateDealer = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase.from("dealers").insert({ casino_id: casinoId, name });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dealers"] }); toast.success("Dealer added"); },
  });
};

// ============ PIT ROTA ============
export const usePitRota = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["pit-rota", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("pit_rota")
        .select("*, dealers(name)")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useSetPitRota = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { dealer_id: string; date: string; shift: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("pit_rota").upsert({
        casino_id: casinoId,
        dealer_id: input.dealer_id,
        date: input.date,
        shift: input.shift as any,
        created_by: user.id,
      }, { onConflict: "dealer_id,date" });
      if (error) throw error;
      await logAction(casinoId, "pit", "ROTA_SET", input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pit-rota"] }); },
  });
};

// ============ BREAKLIST ============
export const useBreaklistData = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["breaklist", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("breaklist")
        .select("*, dealers(name), gaming_tables(name)")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useSetBreaklistCell = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      dealer_id: string;
      time_slot: string;
      role: string;
      table_id: string | null;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("breaklist").upsert({
        casino_id: casinoId,
        date: input.date,
        dealer_id: input.dealer_id,
        time_slot: input.time_slot,
        role: input.role as any,
        table_id: input.table_id,
        created_by: user.id,
        updated_by: user.id,
      }, { onConflict: "casino_id,date,dealer_id,time_slot" });
      if (error) throw error;
      await logAction(casinoId, "breaklist", "CELL_SET", input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["breaklist"] }); },
    onError: (e) => toast.error(e.message),
  });
};

export const useLockBreaklistCell = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, lock }: { id: string; lock: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("breaklist").update({
        is_locked: lock,
        locked_by: lock ? user.id : null,
        updated_by: user.id,
      }).eq("id", id);
      if (error) throw error;
      await logAction(casinoId!, "lock", lock ? "CELL_LOCKED" : "CELL_UNLOCKED", { breaklist_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["breaklist"] }); },
  });
};

// ============ TABLE TRACKER ============
export const useTableTracker = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["table-tracker", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("table_tracker")
        .select("*, gaming_tables(name)")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useSetTableTrackerValue = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { table_id: string; date: string; time_slot: string; value: number }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("table_tracker").upsert({
        casino_id: casinoId,
        table_id: input.table_id,
        date: input.date,
        time_slot: input.time_slot,
        value: input.value,
        recorded_by: user.id,
      }, { onConflict: "table_id,date,time_slot" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["table-tracker"] }); },
  });
};

// ============ GROUPS ============
export const usePlayerGroups = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["player-groups", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("player_groups")
        .select("*, group_members(*, players(first_name, last_name, nickname))")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreateGroup = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("player_groups").insert({
        casino_id: casinoId, name, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["player-groups"] }); toast.success("Group created"); },
  });
};

export const useAddGroupMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, playerId }: { groupId: string; playerId: string }) => {
      const { error } = await supabase.from("group_members").insert({
        group_id: groupId, player_id: playerId,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["player-groups"] }); toast.success("Member added"); },
    onError: (e) => toast.error(e.message),
  });
};

export const useRemoveGroupMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("group_members").update({
        left_at: new Date().toISOString(),
      }).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["player-groups"] }); },
  });
};
