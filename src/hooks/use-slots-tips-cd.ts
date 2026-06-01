/**
 * Cash Desk Tips for slots shifts — COLLECTION LOG (informational).
 *
 * Each entry records tips collected from the floor and physically placed into
 * the cage. Tips are paid out before shift close via
 * `cage_slots_tips_cd_payouts` (Day / Evening), which is the real cash-out
 * event reflected in CDR. This log feeds the tips report so we can see how
 * much was collected per shift.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatNumberSpaces } from "@/lib/currency";

export const useSlotsTipsCd = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["slots-tips-cd", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cage_slots_tips_cd")
        .select("*")
        .eq("cage_slots_shift_id", shiftId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateSlotsTipsCd = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { shift_id: string; amount: number; bucket: "day" | "evening"; note?: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("cage_slots_tips_cd").insert({
        casino_id: casinoId,
        cage_slots_shift_id: input.shift_id,
        amount: Math.round(input.amount),
        bucket: input.bucket,
        note: input.note || "",
        operator_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Tips CD recorded: TZS ${formatNumberSpaces(vars.amount)}`);
      qc.invalidateQueries({ queryKey: ["slots-tips-cd", vars.shift_id] });
      qc.invalidateQueries({ queryKey: ["print-slots-shift"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
};
