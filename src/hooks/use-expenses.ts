import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { offlineMutation } from "@/lib/offline-mutation";
import { toast } from "sonner";
import type { SafeExpenseInsert } from "@/lib/safe-inserts";

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
        // Business day in Africa/Dar_es_Salaam runs 05:00 → 05:00 next day.
        // EAT = UTC+3, so business day D in UTC = [D 02:00 UTC, D+1 02:00 UTC).
        const start = new Date(`${date}T02:00:00.000Z`).toISOString();
        const endDate = new Date(`${date}T02:00:00.000Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        const end = endDate.toISOString();
        query = query.gte("created_at", start).lt("created_at", end);
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
      player_name?: string;
      shift_id?: string | null;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const payload: SafeExpenseInsert = {
        casino_id: casinoId,
        category: input.category as any,
        amount: input.amount,
        description: input.description,
        player_id: input.player_id,
        player_name: input.player_name || "",
        shift_id: input.shift_id || null,
        created_by: user.id,
      } as any;

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

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (exp: { id: string; amount: number; category: string }) => {
      if (!user || !casinoId) throw new Error("Not authenticated");
      const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
      if (error) throw error;
      await logAction(casinoId, "expense", "EXPENSE_DELETED", {
        expense_id: exp.id,
        category: exp.category,
        amount: exp.amount,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
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
