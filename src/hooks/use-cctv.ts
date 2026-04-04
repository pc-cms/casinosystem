import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const useCctvObservations = (casinoId: string | null, date: string) => {
  return useQuery({
    queryKey: ["cctv-observations", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("cctv_observations")
        .select("*")
        .eq("casino_id", casinoId)
        .gte("created_at", `${date}T00:00:00`)
        .lte("created_at", `${date}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!casinoId,
  });
};

export const useCreateObservation = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ casinoId, content, observationType, shiftId }: {
      casinoId: string;
      content: string;
      observationType?: string;
      shiftId?: string;
    }) => {
      const { data, error } = await supabase
        .from("cctv_observations")
        .insert({
          casino_id: casinoId,
          observer_id: user!.id,
          content,
          observation_type: observationType || "general",
          shift_id: shiftId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cctv-observations"] });
    },
  });
};
