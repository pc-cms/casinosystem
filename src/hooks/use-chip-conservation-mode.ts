import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type ChipConservationMode = "strict" | "observation";

/**
 * Strict mode: для нового казино — жёсткий инвариант.
 * Observation mode: для внедрения в работающее казино —
 *   аномалии не блокируются, но фиксируются в miss_chips и видны в ежемесячном отчёте.
 */
export const useChipConservationMode = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-conservation-mode", casinoId],
    queryFn: async (): Promise<ChipConservationMode> => {
      if (!casinoId) return "strict";
      const { data, error } = await supabase
        .from("casinos")
        .select("chip_conservation_mode")
        .eq("id", casinoId)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.chip_conservation_mode ?? "strict") as ChipConservationMode;
    },
    enabled: !!casinoId,
  });
};

export const useUpdateChipConservationMode = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (mode: ChipConservationMode) => {
      if (!casinoId) throw new Error("No active casino");
      const { error } = await supabase
        .from("casinos")
        .update({ chip_conservation_mode: mode } as any)
        .eq("id", casinoId);
      if (error) throw error;
      return mode;
    },
    onSuccess: (mode) => {
      qc.invalidateQueries({ queryKey: ["chip-conservation-mode"] });
      toast.success(
        mode === "strict"
          ? "Strict mode: hard chip invariant enforced"
          : "Observation mode: anomalies tracked monthly, no hard block"
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
