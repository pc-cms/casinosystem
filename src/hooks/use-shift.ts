import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";

// ============ ACTIVE SHIFT ============
export const useActiveShift = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["active-shift", casinoId],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useOpenShift = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      exchange_rates: Record<string, number>;
      opening_float: Record<string, any>;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("shifts")
        .insert({
          casino_id: casinoId,
          opened_by: user.id,
          exchange_rates: input.exchange_rates,
          opening_float: input.opening_float,
        } as any)
        .select()
        .single();
      if (error) {
        if (error.message?.includes("shifts_one_open_per_casino")) {
          throw new Error("A shift is already open");
        }
        throw error;
      }
      await logAction(casinoId, "system", "SHIFT_OPENED", { shift_id: data.id });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-shift"] });
      toast.success("Shift opened");
    },
    onError: (e) => toast.error(e.message),
  });
};

export const useCloseShift = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      closing_count: Record<string, Record<string, number>>;
      closing_cash: Record<string, number>;
      notes: string;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("shifts")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          closing_count: input.closing_count,
          closing_cash: input.closing_cash,
          notes: input.notes,
        } as any)
        .eq("id", input.shift_id);
      if (error) throw error;
      await logAction(casinoId, "system", "SHIFT_CLOSED", { shift_id: input.shift_id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-shift"] });
      toast.success("Shift closed");
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ CASH COUNTS ============
export const useCashCounts = (shiftId: string | undefined) => {
  return useQuery({
    queryKey: ["cash-counts", shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("cash_counts")
        .select("*")
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!shiftId,
  });
};

export const useCreateCashCount = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      shift_id: string;
      count_type: "opening" | "closing" | "check";
      currency: string;
      denominations: Record<string, any>;
      total: number;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("cash_counts").insert({
        casino_id: casinoId,
        shift_id: input.shift_id,
        count_type: input.count_type as any,
        currency: input.currency,
        denominations: input.denominations,
        total: input.total,
        counted_by: user.id,
      } as any);
      if (error) throw error;
      await logAction(casinoId, "system", "CASH_COUNT", {
        shift_id: input.shift_id,
        type: input.count_type,
        currency: input.currency,
        total: input.total,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-counts"] });
      toast.success("Cash count recorded");
    },
    onError: (e) => toast.error(e.message),
  });
};
