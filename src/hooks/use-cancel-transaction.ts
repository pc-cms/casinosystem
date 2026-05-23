import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useCancelTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("cancel_transaction" as any, {
        p_transaction_id: id,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction cancelled");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["player-economy"] });
      qc.invalidateQueries({ queryKey: ["transaction_cancellations"] });
      qc.invalidateQueries({ queryKey: ["drop-split"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to cancel"),
  });
};
