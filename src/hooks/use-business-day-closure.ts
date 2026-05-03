import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";
import { toast } from "sonner";

/**
 * Returns the currently OPEN business date for this casino, computed by
 * the server based on the latest closure record. Falls back to the legacy
 * 05:00-EAT calculation if the RPC is unavailable.
 */
export function useEffectiveBusinessDate() {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["effective-business-date", casinoId],
    queryFn: async (): Promise<string> => {
      if (!casinoId) return getBusinessDate();
      const { data, error } = await supabase.rpc("get_current_business_date", {
        _casino_id: casinoId,
      });
      if (error || !data) return getBusinessDate();
      return data as string;
    },
    enabled: !!casinoId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Most recent closure record (or null). */
export function useLastBusinessDayClosure() {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["last-business-day-closure", casinoId],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("business_day_closures")
        .select("*")
        .eq("casino_id", casinoId)
        .order("business_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!casinoId,
    staleTime: 30_000,
  });
}

/** Manual close. Authorized DB-side: Pit or Manager only. */
export function useCloseBusinessDay() {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!casinoId) throw new Error("No casino");
      const { data, error } = await supabase.rpc("close_business_day", {
        _casino_id: casinoId,
        _method: "manual",
      });
      if (error) throw error;
      return data as { status: string; business_date: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["effective-business-date"] });
      qc.invalidateQueries({ queryKey: ["last-business-day-closure"] });
      if (res?.status === "already_closed") {
        toast.info(`Day ${res.business_date} is already closed`);
      } else {
        toast.success(`Business day ${res.business_date} closed`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
