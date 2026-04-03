import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { offlineMutation } from "@/lib/offline-mutation";
import { toast } from "sonner";
import { formatNumberSpaces } from "@/lib/currency";

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
    staleTime: 1000 * 60 * 5, // 5 min — players rarely change
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
    staleTime: 1000 * 30, // 30s
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
      shift_id?: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const payload = {
        casino_id: casinoId,
        player_id: input.player_id,
        table_id: input.table_id,
        type: input.type,
        amount: input.amount,
        chips: input.chips || null,
        operator_id: user.id,
        shift_id: input.shift_id || null,
      };

      const result = await offlineMutation({
        table: "transactions",
        operation: "insert",
        payload,
        meta: { type: input.type, amount: input.amount },
      });

      if (result.error) throw new Error(result.error);
      return { offline: result.offline };
    },
    // Optimistic update — instant UI feedback before server confirms
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const { getBusinessDate } = await import("@/lib/business-day");
      const today = getBusinessDate();
      const prevTxs = qc.getQueryData(["transactions", casinoId, today]);

      const optimisticTx = {
        id: `optimistic-${Date.now()}`,
        casino_id: casinoId,
        player_id: vars.player_id,
        table_id: vars.table_id,
        type: vars.type,
        amount: vars.amount,
        chips: vars.chips || null,
        operator_id: user?.id,
        shift_id: vars.shift_id || null,
        created_at: new Date().toISOString(),
        _optimistic: true,
      };

      qc.setQueryData(["transactions", casinoId, today], (old: any[] = []) => [optimisticTx, ...old]);
      toast.success(`${vars.type === "buy" ? "Buy-in" : "Cashout"} recorded: TZS ${formatNumberSpaces(vars.amount)}`);
      return { prevTxs, today };
    },
    onError: (e, _vars, context) => {
      // Rollback optimistic update
      if (context?.prevTxs !== undefined) {
        qc.setQueryData(["transactions", casinoId, context.today], context.prevTxs);
      }
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["player-economy"] });
    },
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
    staleTime: 1000 * 60 * 5, // 5 min
  });
};

export const useCloseTable = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      table_id: string;
      closing_chips: Record<number, number>;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      // DB trigger calculate_table_result computes closing_result automatically
      const { error } = await supabase
        .from("gaming_tables")
        .update({
          status: "closed" as any,
          closing_chips: input.closing_chips as any,
        })
        .eq("id", input.table_id);
      if (error) throw error;
      await logAction(casinoId, "system", "TABLE_CLOSED", {
        table_id: input.table_id,
        closing_chips: input.closing_chips,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gaming-tables"] });
      toast.success("Table closed");
    },
    onError: (e) => toast.error(e.message),
  });
};

export const useReopenTable = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (tableId: string) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("gaming_tables")
        .update({
          status: "open" as any,
          closing_chips: null as any,
          closing_result: null as any,
        })
        .eq("id", tableId);
      if (error) throw error;
      await logAction(casinoId, "system", "TABLE_REOPENED", { table_id: tableId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gaming-tables"] });
      toast.success("Table reopened");
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ EXPENSES ============
export const useExpenses = (date?: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["expenses", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      let query = supabase
        .from("expenses")
        .select("*, players(first_name, last_name)")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false });
      
      if (date) {
        query = query.gte("created_at", `${date}T00:00:00`).lte("created_at", `${date}T23:59:59`);
      } else {
        query = query.limit(200);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 60 * 2,
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
      shift_id?: string | null;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const payload = {
        casino_id: casinoId,
        category: input.category as any,
        amount: input.amount,
        description: input.description,
        player_id: input.player_id,
        shift_id: input.shift_id || null,
        created_by: user.id,
      };

      const result = await offlineMutation({
        table: "expenses",
        operation: "insert",
        payload,
        meta: { category: input.category, amount: input.amount },
      });

      if (result.error) throw new Error(result.error);

      if (!result.offline) {
        await logAction(casinoId, "expense", "EXPENSE_CREATED", { category: input.category, amount: input.amount });
      }
      return { offline: result.offline };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      if (!res.offline) toast.success("Expense recorded");
    },
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
    staleTime: 1000 * 60 * 3, // 3 min — heavy view, cache longer
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
    mutationFn: async ({ name, category, is_pit_boss }: { name: string; category: string; is_pit_boss: boolean }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase.from("dealers").insert({ casino_id: casinoId, name, category: category as any, is_pit_boss });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dealers"] }); toast.success("Staff added"); },
  });
};

export const useUpdateDealer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; salary?: number | null; contract_start?: string | null; contract_end?: string | null; onboarding_date?: string | null; is_active?: boolean; category?: string; is_pit_boss?: boolean }) => {
      const { error } = await supabase.from("dealers").update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dealers"] }),
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

export const usePitRotaRange = (startDate: string, endDate: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["pit-rota-range", casinoId, startDate, endDate],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("pit_rota")
        .select("*, dealers(name)")
        .eq("casino_id", casinoId)
        .gte("date", startDate)
        .lte("date", endDate);
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
    onMutate: async (input) => {
      // Optimistic update for all matching rota-range queries
      await qc.cancelQueries({ queryKey: ["pit-rota-range"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["pit-rota-range"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((r: any) => r.dealer_id === input.dealer_id && r.date === input.date);
        const newEntry = { dealer_id: input.dealer_id, date: input.date, shift: input.shift, casino_id: casinoId, id: `temp-${Date.now()}`, created_by: user?.id };
        const updated = [...data];
        if (idx >= 0) { updated[idx] = { ...updated[idx], shift: input.shift }; } else { updated.push(newEntry); }
        qc.setQueryData(key, updated);
      });
      return { queries };
    },
    onError: (_err) => {
      // Don't rollback — keep optimistic data, just warn
      toast.error("Sync error (rota) — will retry", { duration: 2000 });
    },
    onSettled: () => {
      // Don't invalidate immediately — keep buffered data
    },
  });
};

export const useDeletePitRota = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async ({ dealer_id, date }: { dealer_id: string; date: string }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("pit_rota")
        .delete()
        .eq("casino_id", casinoId)
        .eq("dealer_id", dealer_id)
        .eq("date", date);
      if (error) throw error;
    },
    onMutate: async ({ dealer_id, date }) => {
      await qc.cancelQueries({ queryKey: ["pit-rota-range"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["pit-rota-range"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, data.filter((r: any) => !(r.dealer_id === dealer_id && r.date === date)));
      });
      return { queries };
    },
    onError: (_err) => {
      toast.error("Sync error (rota delete) — will retry", { duration: 2000 });
    },
    onSettled: () => {},
  });
};

// ============ DEALER ATTENDANCE ============
export const useDealerAttendance = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["dealer-attendance", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("dealer_attendance" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!casinoId,
  });
};

export const useSetDealerAttendance = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { dealer_id: string; date: string; value: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("dealer_attendance" as any).upsert({
        casino_id: casinoId,
        dealer_id: input.dealer_id,
        date: input.date,
        value: input.value,
        recorded_by: user.id,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "casino_id,dealer_id,date" });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["dealer-attendance-range"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["dealer-attendance-range"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((a: any) => a.dealer_id === input.dealer_id && a.date === input.date);
        const updated = [...data];
        const entry = { dealer_id: input.dealer_id, date: input.date, value: input.value, casino_id: casinoId };
        if (idx >= 0) { updated[idx] = { ...updated[idx], value: input.value }; } else { updated.push(entry); }
        qc.setQueryData(key, updated);
      });
      return { queries };
    },
    onError: (_err) => {
      toast.error("Sync error (attendance) — will retry", { duration: 2000 });
    },
    onSettled: () => {},
  });
};

export const useDealerAttendanceRange = (startDate: string, endDate: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["dealer-attendance-range", casinoId, startDate, endDate],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("dealer_attendance" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!casinoId,
  });
};

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

      const payload = {
        casino_id: casinoId,
        date: input.date,
        dealer_id: input.dealer_id,
        time_slot: input.time_slot,
        role: input.role as any,
        table_id: input.table_id,
        created_by: user.id,
        updated_by: user.id,
      };

      const result = await offlineMutation({
        table: "breaklist",
        operation: "upsert",
        payload,
        upsertConflict: "casino_id,date,dealer_id,time_slot",
        meta: { role: input.role, dealer_id: input.dealer_id, time_slot: input.time_slot },
      });

      if (result.error) throw new Error(result.error);

      // Only do detailed logging when online (offline actions log on sync)
      if (!result.offline) {
        const { data: existing } = await supabase
          .from("breaklist")
          .select("id, role, table_id")
          .eq("casino_id", casinoId)
          .eq("date", input.date)
          .eq("dealer_id", input.dealer_id)
          .eq("time_slot", input.time_slot)
          .maybeSingle();

        if (existing) {
          await supabase.from("breaklist_logs").insert({
            casino_id: casinoId,
            breaklist_id: existing.id,
            dealer_id: input.dealer_id,
            date: input.date,
            time_slot: input.time_slot,
            action: "CELL_UPDATED",
            old_role: null,
            new_role: input.role,
            old_table_id: null,
            new_table_id: input.table_id,
            operator_id: user.id,
          });
        }

        await logAction(casinoId, "breaklist", "CELL_SET", input);
      }

      return { offline: result.offline };
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["breaklist"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["breaklist"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((b: any) => b.dealer_id === input.dealer_id && b.time_slot === input.time_slot);
        const updated = [...data];
        const entry = { dealer_id: input.dealer_id, time_slot: input.time_slot, role: input.role, table_id: input.table_id, date: input.date, casino_id: casinoId, id: `temp-${Date.now()}`, is_locked: false };
        if (idx >= 0) { updated[idx] = { ...updated[idx], role: input.role, table_id: input.table_id }; } else { updated.push(entry); }
        qc.setQueryData(key, updated);
      });
      return { queries };
    },
    onError: (_err) => {
      toast.error("Sync error (breaklist) — will retry", { duration: 2000 });
    },
    onSettled: () => {},
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
      const payload = {
        casino_id: casinoId,
        table_id: input.table_id,
        date: input.date,
        time_slot: input.time_slot,
        value: input.value,
        recorded_by: user.id,
      };

      const result = await offlineMutation({
        table: "table_tracker",
        operation: "upsert",
        payload,
        upsertConflict: "table_id,date,time_slot",
      });

      if (result.error) throw new Error(result.error);
      return { offline: result.offline };
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["table-tracker"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["table-tracker"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((t: any) => t.table_id === input.table_id && t.time_slot === input.time_slot);
        const updated = [...data];
        const entry = { table_id: input.table_id, date: input.date, time_slot: input.time_slot, value: input.value, casino_id: casinoId, id: `temp-${Date.now()}` };
        if (idx >= 0) { updated[idx] = { ...updated[idx], value: input.value }; } else { updated.push(entry); }
        qc.setQueryData(key, updated);
      });
    },
    onError: (_err) => {
      toast.error("Sync error (tracker) — will retry", { duration: 2000 });
    },
    onSettled: () => {},
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

// ============ CLIENT SESSIONS (for analytics drop) ============
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
