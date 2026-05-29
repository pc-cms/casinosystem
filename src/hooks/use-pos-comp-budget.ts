/**
 * Comp budget — per-casino monthly limit on house comps issued through POS.
 * Reads via pos_comp_budget_status RPC; writes via pos_comp_budgets table.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompBudgetStatus = {
  month_start: string;
  limit_tzs: number;
  used_house_tzs: number;
  used_player_tzs: number;
  remaining_tzs: number;
  percent_used: number | null;
  is_over: boolean;
};

export function usePosCompBudgetStatus(casinoId: string | null) {
  return useQuery({
    queryKey: ["pos-comp-budget-status", casinoId],
    enabled: !!casinoId,
    queryFn: async (): Promise<CompBudgetStatus | null> => {
      const { data, error } = await supabase.rpc("pos_comp_budget_status", {
        _casino_id: casinoId!,
        _month_start: null,
      } as any);
      if (error) throw error;
      return data as unknown as CompBudgetStatus;
    },
    staleTime: 30_000,
  });
}

export function useSetPosCompBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { casino_id: string; month_start: string; limit_tzs: number; note?: string }) => {
      const { error } = await supabase
        .from("pos_comp_budgets")
        .upsert(
          {
            casino_id: input.casino_id,
            month_start: input.month_start,
            limit_tzs: input.limit_tzs,
            note: input.note ?? "",
          },
          { onConflict: "casino_id,month_start" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pos-comp-budget-status", v.casino_id] });
    },
  });
}
