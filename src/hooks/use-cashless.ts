import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";

export type CashlessProvider = "AIRTEL" | "MPESA" | "TIGO" | "HALOTEL";
export type CashlessDirection = "IN" | "OUT";
export type CashlessStatus = "pending" | "recorded" | "approved";

export interface CashlessRow {
  id: string;
  casino_id: string;
  business_date: string;
  direction: CashlessDirection;
  provider: CashlessProvider;
  player_id: string | null;
  player_name: string;
  amount: number;
  currency: string;
  reference: string;
  note: string;
  status: CashlessStatus;
  operator_id: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  players?: { first_name: string; last_name: string } | null;
}

export const useCashless = (date?: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["cashless", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [] as CashlessRow[];
      let q = (supabase as any)
        .from("cashless_transactions")
        .select("*, players(first_name, last_name)")
        .eq("casino_id", casinoId)
        .eq("cage_type", "live_game")
        .order("created_at", { ascending: false });
      if (date) q = q.eq("business_date", date);
      else q = q.limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CashlessRow[];
    },
    enabled: !!casinoId,
    staleTime: 1000 * 60,
  });
};

/**
 * Per-provider IN / OUT / NET aggregates of /cashless transactions
 * for a given business day and cage type. Used as gray "suggestion"
 * placeholders inside Check / Close Shift screens — the cashier may
 * accept (leave field empty) or override with a manual number.
 */
export const useCashlessSuggestions = (
  businessDate: string | undefined,
  cageType: "live_game" | "slots",
) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["cashless-suggestions", casinoId, cageType, businessDate],
    queryFn: async () => {
      const empty = { in: {} as Record<string, number>, out: {} as Record<string, number>, net: {} as Record<string, number> };
      if (!casinoId || !businessDate) return empty;
      const { data, error } = await (supabase as any)
        .from("cashless_transactions")
        .select("provider,direction,amount")
        .eq("casino_id", casinoId)
        .eq("cage_type", cageType)
        .eq("business_date", businessDate);
      if (error) throw error;
      const acc = { in: {} as Record<string, number>, out: {} as Record<string, number>, net: {} as Record<string, number> };
      (data || []).forEach((r: { provider: string; direction: string; amount: number | string }) => {
        const amt = Number(r.amount) || 0;
        if (r.direction === "IN") acc.in[r.provider] = (acc.in[r.provider] || 0) + amt;
        else acc.out[r.provider] = (acc.out[r.provider] || 0) + amt;
      });
      const providers = new Set([...Object.keys(acc.in), ...Object.keys(acc.out)]);
      providers.forEach(p => { acc.net[p] = (acc.in[p] || 0) - (acc.out[p] || 0); });
      return acc;
    },
    enabled: !!casinoId && !!businessDate,
    staleTime: 1000 * 30,
  });
};


export const useCreateCashless = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      direction: CashlessDirection;
      provider: CashlessProvider;
      player_id?: string | null;
      player_name: string;
      amount: number;
      reference?: string;
      note?: string;
      business_date: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("cashless_transactions").insert({
        casino_id: casinoId,
        operator_id: user.id,
        business_date: input.business_date,
        direction: input.direction,
        provider: input.provider,
        player_id: input.player_id ?? null,
        player_name: input.player_name,
        amount: input.amount,
        currency: "TZS",
        reference: input.reference || "",
        note: input.note || "",
      });
      if (error) throw error;
      await logAction(casinoId, "expense", "CASHLESS_CREATED", {
        direction: input.direction, provider: input.provider, amount: input.amount,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashless"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useApproveCashless = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("cashless_transactions")
        .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      if (casinoId) await logAction(casinoId, "expense", "CASHLESS_APPROVED", { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashless"] });
      toast.success("Cashless approved");
    },
    onError: (e: any) => toast.error(e.message),
  });
};
