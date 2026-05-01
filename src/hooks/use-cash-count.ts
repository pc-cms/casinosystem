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

/** Get the latest snapshot for each (wallet_type, currency) combo */
export function useLatestCashCounts() {
  const { casinoId } = useAuth() as any;
  return useQuery({
    queryKey: ["cash_count_latest", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("cash_count_snapshots")
        .select("*")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const latest = new Map<string, CashCountSnapshot>();
      for (const snap of (data || []) as CashCountSnapshot[]) {
        const key = `${snap.wallet_type}__${snap.currency}`;
        if (!latest.has(key)) {
          latest.set(key, snap);
        }
      }
      return Array.from(latest.values());
    },
    enabled: !!casinoId,
  });
}

/**
 * Safe input for `cash_count_snapshots`.
 *
 * Server-computed fields are intentionally excluded from this type to prevent
 * client tampering. The `cash_count_snapshot_compute` trigger fills them:
 *   - `discrepancy`         = expected_balance − physical_total_tzs
 *   - `physical_total_tzs`  = physical_total × exchange_rate (when not provided)
 *
 * `expected_balance` is also a *reference* value, but it is supplied by the UI
 * because it reflects the ledger snapshot at the moment of counting (audit
 * trail). The trigger uses it as-is to compute discrepancy.
 */
export type CashCountInput = {
  wallet_type: WalletType;
  currency: string;
  denominations: Record<string, number>;
  physical_total: number;
  expected_balance: number;
  exchange_rate: number;
  note?: string;
};

export function useCreateCashCount() {
  const { casinoId } = useAuth() as any;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snapshot: CashCountInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !casinoId) throw new Error("Not authenticated");
      // NOTE: `discrepancy` and `physical_total_tzs` are deliberately omitted —
      // they are computed by the `cash_count_snapshot_compute` DB trigger.
      const { error } = await supabase.from("cash_count_snapshots").insert({
        casino_id: casinoId,
        wallet_type: snapshot.wallet_type,
        currency: snapshot.currency,
        denominations: snapshot.denominations as any,
        physical_total: snapshot.physical_total,
        expected_balance: snapshot.expected_balance,
        exchange_rate: snapshot.exchange_rate,
        counted_by: user.id,
        note: snapshot.note || "",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_count_snapshots"] });
      qc.invalidateQueries({ queryKey: ["cash_count_latest"] });
      toast.success("Cash count recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
