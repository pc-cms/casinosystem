import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface BudgetCategory {
  id: string;
  casino_id: string;
  name: string;
  parent_group: string;
  expense_mapping: string | null;
  created_at: string;
  created_by: string;
}

export interface BudgetPeriod {
  id: string;
  casino_id: string;
  month: string;
  is_locked: boolean;
  locked_by: string | null;
  unlocked_by: string | null;
  unlocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: string;
  casino_id: string;
  period_id: string;
  category_id: string;
  item_name: string;
  logic_type: "reserve" | "direct_expense";
  monthly_amount: number;
  actual_amount: number;
  reserved_amount: number;
  status: "planned" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
}

export const PARENT_GROUPS = ["operating", "fixed", "government", "tech", "other"] as const;

export const PARENT_GROUP_LABELS: Record<string, string> = {
  operating: "Operating",
  fixed: "Fixed",
  government: "Government",
  tech: "Tech",
  other: "Other",
};

// ─── Categories ───

export function useBudgetCategories() {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["budget_categories", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await (supabase as any)
        .from("budget_categories")
        .select("*")
        .eq("casino_id", casinoId)
        .order("parent_group")
        .order("name");
      if (error) throw error;
      return (data || []) as BudgetCategory[];
    },
    enabled: !!casinoId,
  });
}

export function useCreateBudgetCategory() {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; parent_group: string; expense_mapping?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("budget_categories").insert({
        casino_id: casinoId,
        name: cat.name,
        parent_group: cat.parent_group,
        expense_mapping: cat.expense_mapping || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_categories"] });
      toast.success("Category created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Periods ───

export function useBudgetPeriod(month: string) {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["budget_period", casinoId, month],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await (supabase as any)
        .from("budget_periods")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data as BudgetPeriod | null;
    },
    enabled: !!casinoId && !!month,
  });
}

export function useCreateBudgetPeriod() {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).from("budget_periods").insert({
        casino_id: casinoId,
        month,
        is_locked: true,
        locked_by: user.id,
      }).select().single();
      if (error) throw error;
      await (supabase as any).from("budget_logs").insert({
        casino_id: casinoId,
        period_id: data.id,
        action: "period_created",
        details: { month },
        operator_id: user.id,
      });
      return data as BudgetPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_period"] });
      toast.success("Budget period created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useToggleBudgetLock() {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, lock }: { periodId: string; lock: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const updates: Record<string, any> = { is_locked: lock };
      if (lock) {
        updates.locked_by = user.id;
        updates.unlocked_by = null;
        updates.unlocked_at = null;
      } else {
        updates.unlocked_by = user.id;
        updates.unlocked_at = new Date().toISOString();
      }
      const { error } = await (supabase as any).from("budget_periods").update(updates).eq("id", periodId);
      if (error) throw error;
      await (supabase as any).from("budget_logs").insert({
        casino_id: casinoId,
        period_id: periodId,
        action: lock ? "period_locked" : "period_unlocked",
        details: {},
        operator_id: user.id,
      });
    },
    onSuccess: (_, { lock }) => {
      qc.invalidateQueries({ queryKey: ["budget_period"] });
      toast.success(lock ? "Budget locked" : "Budget unlocked");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Items ───

export function useBudgetItems(periodId: string | undefined) {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["budget_items", casinoId, periodId],
    queryFn: async () => {
      if (!casinoId || !periodId) return [];
      const { data, error } = await (supabase as any)
        .from("budget_items")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("period_id", periodId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as BudgetItem[];
    },
    enabled: !!casinoId && !!periodId,
  });
}

export function useCreateBudgetItem() {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      period_id: string;
      category_id: string;
      item_name: string;
      logic_type: "reserve" | "direct_expense";
      monthly_amount: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).from("budget_items").insert({
        casino_id: casinoId,
        ...item,
      }).select().single();
      if (error) throw error;
      await (supabase as any).from("budget_logs").insert({
        casino_id: casinoId,
        period_id: item.period_id,
        item_id: data.id,
        action: "item_created",
        details: { item_name: item.item_name, monthly_amount: item.monthly_amount },
        operator_id: user.id,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_items"] });
      toast.success("Budget item added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateBudgetItem() {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, periodId, ...updates }: {
      id: string;
      periodId: string;
      monthly_amount?: number;
      actual_amount?: number;
      reserved_amount?: number;
      status?: string;
      item_name?: string;
      category_id?: string;
      logic_type?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("budget_items").update(updates).eq("id", id);
      if (error) throw error;
      await (supabase as any).from("budget_logs").insert({
        casino_id: casinoId,
        period_id: periodId,
        item_id: id,
        action: "item_updated",
        details: updates,
        operator_id: user.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_items"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Monthly actuals from wallet transactions ───

export function useMonthlyActuals(month: string) {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["monthly_actuals", casinoId, month],
    queryFn: async () => {
      if (!casinoId || !month) return {};
      const startDate = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      // First day of next month for proper boundary
      const nextMonth = new Date(y, m, 1);
      const nextMonthStr = nextMonth.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("expense_category, amount")
        .eq("casino_id", casinoId)
        .in("tx_type", ["manual_expense", "use_reserve"])
        .gte("created_at", `${startDate}T00:00:00`)
        .lt("created_at", `${nextMonthStr}T00:00:00`);
      if (error) throw error;

      const actuals: Record<string, number> = {};
      for (const tx of data || []) {
        if (tx.expense_category) {
          actuals[tx.expense_category] = (actuals[tx.expense_category] || 0) + Number(tx.amount);
        }
      }
      return actuals;
    },
    enabled: !!casinoId && !!month,
  });
}
