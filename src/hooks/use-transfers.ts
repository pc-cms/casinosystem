import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";

export type InterCasinoTransfer = {
  id: string;
  from_casino_id: string;
  to_casino_id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  initiated_by: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Inter-casino transfers visible on the current surface.
 *
 * Per-domain rule:
 *   - On premier (summary) — all transfers across the network.
 *   - On a casino subdomain — only transfers where this casino is the source
 *     OR the destination. Applies uniformly to every role, including
 *     super_admin / finance_manager.
 */
export const useInterCasinoTransfers = () => {
  const { activeCasinoId, isSummaryMode } = useCasino();

  return useQuery({
    queryKey: ["inter-casino-transfers", isSummaryMode ? "summary" : activeCasinoId],
    queryFn: async () => {
      let q = supabase
        .from("inter_casino_transfers")
        .select("*")
        .order("created_at", { ascending: false });
      if (!isSummaryMode && activeCasinoId) {
        q = q.or(`from_casino_id.eq.${activeCasinoId},to_casino_id.eq.${activeCasinoId}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InterCasinoTransfer[];
    },
    enabled: isSummaryMode || !!activeCasinoId,
  });
};

export const useCreateTransfer = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      from_casino_id: string;
      to_casino_id: string;
      amount: number;
      description: string;
      currency?: string;
    }) => {
      const { error } = await supabase.from("inter_casino_transfers").insert({
        ...params,
        initiated_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inter-casino-transfers"] });
    },
  });
};

export const useConfirmTransfer = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase
        .from("inter_casino_transfers")
        .update({
          status: "confirmed",
          confirmed_by: user!.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", transferId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inter-casino-transfers"] });
    },
  });
};

export const useRejectTransfer = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ transferId, reason }: { transferId: string; reason: string }) => {
      const { error } = await supabase
        .from("inter_casino_transfers")
        .update({
          status: "rejected",
          confirmed_by: user!.id,
          confirmed_at: new Date().toISOString(),
          rejected_reason: reason,
        })
        .eq("id", transferId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inter-casino-transfers"] });
    },
  });
};
