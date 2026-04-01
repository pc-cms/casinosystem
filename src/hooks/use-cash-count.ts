import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { WalletType } from "@/hooks/use-finance";

export interface CashCountSnapshot {
  id: string;
  casino_id: string;
  wallet_type: WalletType;
  currency: string;
  denominations: Record<string, number>;
  physical_total: number;
  expected_balance: number;
  discrepancy: number;
  exchange_rate: number;
  physical_total_tzs: number;
  counted_by: string;
  note: string;
  created_at: string;
}

export function useCashCountHistory(limit = 50) {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["cash_count_snapshots", casinoId, limit],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("cash_count_snapshots")
        .select("*")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as CashCountSnapshot[];
    },
    enabled: !!casinoId,
  });
}

export function useCreateCashCount() {
  const { casinoId } = useAuth() as any;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snapshot: {
      wallet_type: WalletType;
      currency: string;
      denominations: Record<string, number>;
      physical_total: number;
      expected_balance: number;
      discrepancy: number;
      exchange_rate: number;
      physical_total_tzs: number;
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      const { error } = await supabase.from("cash_count_snapshots").insert({
        casino_id: casinoId,
        wallet_type: snapshot.wallet_type,
        currency: snapshot.currency,
        denominations: snapshot.denominations as any,
        physical_total: snapshot.physical_total,
        expected_balance: snapshot.expected_balance,
        discrepancy: snapshot.discrepancy,
        exchange_rate: snapshot.exchange_rate,
        physical_total_tzs: snapshot.physical_total_tzs,
        counted_by: user.id,
        note: snapshot.note || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_count_snapshots"] });
      toast.success("Cash count recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
