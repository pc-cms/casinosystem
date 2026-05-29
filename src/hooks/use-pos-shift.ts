/**
 * POS Shift hooks — current waiter's open shift + open shift.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PosShift = {
  id: string;
  casino_id: string;
  waiter_user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  business_date: string | null;
  z_report: any | null;
  created_at: string;
};

const key = (casinoId: string | null, userId: string | null) =>
  ["pos-shift", "current", casinoId, userId] as const;

export function usePosCurrentShift(casinoId: string | null, userId: string | null) {
  return useQuery({
    queryKey: key(casinoId, userId),
    enabled: !!casinoId && !!userId,
    queryFn: async (): Promise<PosShift | null> => {
      const { data, error } = await supabase
        .from("pos_shifts")
        .select("*")
        .eq("casino_id", casinoId!)
        .eq("waiter_user_id", userId!)
        .is("closed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PosShift | null;
    },
  });
}

export function useOpenPosShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { casino_id: string; waiter_user_id: string; opening_cash: number }) => {
      const { data, error } = await supabase
        .from("pos_shifts")
        .insert({
          casino_id: input.casino_id,
          waiter_user_id: input.waiter_user_id,
          opening_cash: input.opening_cash,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as PosShift;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.casino_id, vars.waiter_user_id) });
    },
  });
}
