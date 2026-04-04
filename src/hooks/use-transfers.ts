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

export const useInterCasinoTransfers = () => {
  const { activeCasinoId } = useCasino();
  const { roles } = useAuth();
  const isSuperOrFM = roles.includes("super_admin") || roles.includes("finance_manager");

  return useQuery({
    queryKey: ["inter-casino-transfers", isSuperOrFM ? "all" : activeCasinoId],
    queryFn: async () => {
      // RLS handles filtering — super_admin/FM see all, managers see their casino's
      const { data, error } = await supabase
        .from("inter_casino_transfers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InterCasinoTransfer[];
    },
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
