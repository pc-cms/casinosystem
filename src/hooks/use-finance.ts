import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { SafeWalletTxInsert } from "@/lib/safe-inserts";

// Types matching DB enums
export type WalletType = "main_cash" | "office_safe" | "rent_reserve" | "license_reserve" | "tax_reserve" | "other_reserve" | "cage_slot" | "cage_table" | "mobile_money" | "bank_account" | "bar_cash";
export type WalletTxType = "transfer" | "allocate_reserve" | "use_reserve" | "manual_expense" | "daily_result" | "initial_balance" | "collection" | "adjustment" | "external_income";
export type OfficeExpenseCategory =
  | "salary" | "bonus" | "fuel" | "transport" | "repairs" | "internet_it" | "security_expense" | "cleaning"
  | "rent" | "utilities" | "office"
  | "gaming_tax" | "fixed_tax" | "license" | "visa"
  | "machines" | "parts"
  | "debts" | "adjustments" | "other_office";

export const EXPENSE_CATEGORY_GROUPS: Record<string, { label: string; categories: OfficeExpenseCategory[] }> = {
  operating: { label: "Operating", categories: ["salary", "bonus", "fuel", "transport", "repairs", "internet_it", "security_expense", "cleaning"] },
  fixed: { label: "Fixed", categories: ["rent", "utilities", "office"] },
  government: { label: "Government", categories: ["gaming_tax", "fixed_tax", "license", "visa"] },
  tech: { label: "Tech", categories: ["machines", "parts"] },
  other: { label: "Other", categories: ["debts", "adjustments", "other_office"] },
};

export const CATEGORY_LABELS: Record<OfficeExpenseCategory, string> = {
  salary: "Salary", bonus: "Bonus", fuel: "Fuel", transport: "Transport",
  repairs: "Repairs", internet_it: "Internet/IT", security_expense: "Security", cleaning: "Cleaning",
  rent: "Rent", utilities: "Utilities", office: "Office",
  gaming_tax: "Gaming Tax", fixed_tax: "Fixed Tax", license: "License", visa: "Visa",
  machines: "Machines", parts: "Parts",
  debts: "Debts", adjustments: "Adjustments", other_office: "Other",
};

export const WALLET_LABELS: Record<WalletType, string> = {
  main_cash: "Main Cash",
  office_safe: "Office Safe",
  rent_reserve: "Rent Reserve",
  license_reserve: "License Reserve",
  tax_reserve: "Tax Reserve",
  other_reserve: "Other Reserve",
  cage_slot: "Cage Slot",
  cage_table: "Cage Table",
  mobile_money: "Mobile Money",
  bank_account: "Bank Account",
  bar_cash: "Bar Cash",
};

export interface Wallet {
  id: string;
  casino_id: string;
  wallet_type: WalletType;
  current_balance: number;
}

export interface WalletTransaction {
  id: string;
  casino_id: string;
  tx_type: WalletTxType;
  from_wallet: WalletType | null;
  to_wallet: WalletType | null;
  amount: number;
  expense_category: OfficeExpenseCategory | null;
  description: string;
  operator_id: string;
  created_at: string;
  business_date: string | null;
}

export interface DailySummary {
  id: string;
  casino_id: string;
  date: string;
  tables_result: number;
  slots_result: number;
  total_result: number;
  total_expenses: number;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  comment: string;
}

export function useWallets() {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["financial_wallets", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("financial_wallets")
        .select("*")
        .eq("casino_id", casinoId);
      if (error) throw error;
      return (data || []) as Wallet[];
    },
    enabled: !!casinoId,
  });
}

export function useInitializeWallets() {
  const { casinoId } = useAuth() as any;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (initialBalances: Partial<Record<WalletType, number>>) => {
      if (!casinoId) throw new Error("No casino");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const walletTypes: WalletType[] = ["main_cash", "office_safe", "rent_reserve", "license_reserve", "tax_reserve", "other_reserve", "cage_slot", "cage_table", "mobile_money", "bank_account"];
      const wallets = walletTypes.map(wt => ({
        casino_id: casinoId,
        wallet_type: wt,
        current_balance: 0,
      }));
      const { error } = await supabase.from("financial_wallets").upsert(wallets, { onConflict: "casino_id,wallet_type" });
      if (error) throw error;

      const txs: SafeWalletTxInsert[] = Object.entries(initialBalances)
        .filter(([, amount]) => amount && amount > 0)
        .map(([wt, amount]) => ({
          casino_id: casinoId,
          tx_type: "initial_balance" as WalletTxType,
          to_wallet: wt as WalletType,
          amount: amount!,
          description: "Initial balance",
          operator_id: user.id,
        }));
      if (txs.length > 0) {
        const { error: txError } = await supabase.from("wallet_transactions").insert(txs);
        if (txError) throw txError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Wallets initialized");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useWalletTransactions(limit = 100) {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["wallet_transactions", casinoId, limit],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as WalletTransaction[];
    },
    enabled: !!casinoId,
  });
}

export function useCreateWalletTransaction() {
  const { casinoId } = useAuth() as any;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: {
      tx_type: WalletTxType;
      from_wallet?: WalletType | null;
      to_wallet?: WalletType | null;
      amount: number;
      expense_category?: OfficeExpenseCategory | null;
      description?: string;
      business_date?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const insertPayload: SafeWalletTxInsert = {
        casino_id: casinoId,
        tx_type: tx.tx_type,
        from_wallet: tx.from_wallet || null,
        to_wallet: tx.to_wallet || null,
        amount: tx.amount,
        expense_category: tx.expense_category || null,
        description: tx.description || "",
        operator_id: user.id,
        business_date: tx.business_date || null,
      };
      const { error } = await supabase.from("wallet_transactions").insert(insertPayload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      qc.invalidateQueries({ queryKey: ["monthly_actuals"] });
      qc.invalidateQueries({ queryKey: ["monthly_reserves"] });
      toast.success("Transaction recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDailySummaries(dateRange?: { from: string; to: string }) {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["daily_summaries", casinoId, dateRange],
    queryFn: async () => {
      if (!casinoId) return [];
      let q = supabase
        .from("daily_summaries")
        .select("*")
        .eq("casino_id", casinoId)
        .order("date", { ascending: false });
      if (dateRange) {
        q = q.gte("date", dateRange.from).lte("date", dateRange.to);
      }
      const { data, error } = await q.limit(90);
      if (error) throw error;
      return (data || []) as DailySummary[];
    },
    enabled: !!casinoId,
  });
}

export function useUpsertDailySummary() {
  const { casinoId } = useAuth() as any;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (summary: {
      date: string;
      tables_result: number;
      slots_result: number;
      total_expenses: number;
      confirmed?: boolean;
      comment?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const total_result = summary.tables_result + summary.slots_result;
      const { error } = await supabase.from("daily_summaries").upsert({
        casino_id: casinoId,
        date: summary.date,
        tables_result: summary.tables_result,
        slots_result: summary.slots_result,
        total_result,
        total_expenses: summary.total_expenses,
        confirmed: summary.confirmed || false,
        confirmed_by: summary.confirmed ? user.id : null,
        confirmed_at: summary.confirmed ? new Date().toISOString() : null,
        comment: summary.comment || "",
      }, { onConflict: "casino_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_summaries"] });
      toast.success("Daily summary saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Get shift closing money breakdown for a date (opening + closing data)
export function useShiftClosingForDate(date: string) {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["shift_closing_date", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return null;
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("shifts")
        .select("id, opening_float, closing_count, closing_cash, exchange_rates, status")
        .eq("casino_id", casinoId)
        .gte("opened_at", `${date}T00:00:00`)
        .lt("opened_at", `${nextDayStr}T00:00:00`)
        .eq("status", "closed")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId && !!date,
  });
}

// Get auto-calculated tables result for a date
export function useTablesResultForDate(date: string) {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["tables_result_date", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return 0;
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      // Canonical chip-based P&L: shifts.tables_result (computed by DB
      // trigger from compute_shift_table_results). Fallback to legacy
      // shift_result for old rows that may not yet have tables_result set.
      const { data, error } = await supabase
        .from("shifts")
        .select("tables_result, shift_result")
        .eq("casino_id", casinoId)
        .gte("opened_at", `${date}T00:00:00`)
        .lt("opened_at", `${nextDayStr}T00:00:00`);
      if (error) throw error;
      return (data || []).reduce((sum, s: any) => {
        const v = s.tables_result ?? s.shift_result ?? 0;
        return sum + Number(v);
      }, 0);
    },
    enabled: !!casinoId && !!date,
  });
}

// Get total expenses from cage for a date
export function useCageExpensesForDate(date: string) {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["cage_expenses_date", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return 0;
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("casino_id", casinoId)
        .eq("approved", true)
        .gte("created_at", `${date}T00:00:00`)
        .lt("created_at", `${nextDayStr}T00:00:00`);
      if (error) throw error;
      return (data || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    },
    enabled: !!casinoId && !!date,
  });
}
