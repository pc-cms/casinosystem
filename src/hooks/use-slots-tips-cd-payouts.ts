/**
 * Cage Slots — Tips CD Payouts.
 * Real cash-out of collected tips, split into Day / Evening buckets.
 * Each bucket can be paid out at most once per shift (DB UNIQUE constraint).
 *
 * Effect on financials:
 *  - Money physically leaves the cage → closing cash decreases by `amount`.
 *  - `compute_slots_shift_balance_from_row` adds payout back into CDR so the
 *    shift balance is neutral relative to tips (matches Live Cage flow).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatNumberSpaces } from "@/lib/currency";
import type { TipsBucket } from "@/lib/slots-tips-bucket";

export type SlotsTipsCdPayoutRow = {
  id: string;
  casino_id: string;
  cage_slots_shift_id: string;
  bucket: TipsBucket;
  amount: number;
  collected_amount: number;
  note: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
};

export const useSlotsTipsCdPayouts = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["slots-tips-cd-payouts", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cage_slots_tips_cd_payouts")
        .select("*")
        .eq("cage_slots_shift_id", shiftId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SlotsTipsCdPayoutRow[];
    },
  });
};

export const useCashOutSlotsTipsCd = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      bucket: TipsBucket;
      amount: number;
      collected_amount: number;
      note?: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("cage_slots_tips_cd_payouts")
        .insert({
          casino_id: casinoId,
          cage_slots_shift_id: input.shift_id,
          bucket: input.bucket,
          amount: Math.round(input.amount),
          collected_amount: Math.round(input.collected_amount),
          note: input.note || "",
          operator_id: user.id,
        });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        `${vars.bucket === "day" ? "Day" : "Evening"} tips paid out: TZS ${formatNumberSpaces(vars.amount)}`,
      );
      qc.invalidateQueries({ queryKey: ["slots-tips-cd-payouts", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shifts"] });
      qc.invalidateQueries({ queryKey: ["print-slots-shift"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useReopenSlotsTipsCdPayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; shift_id: string }) => {
      const { error } = await (supabase as any)
        .from("cage_slots_tips_cd_payouts")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Payout reopened");
      qc.invalidateQueries({ queryKey: ["slots-tips-cd-payouts", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["cage-slots-shifts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};
