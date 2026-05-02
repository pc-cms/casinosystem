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

// Most recent closed shift (used to carry the float into the next open).
export const useLastClosedShift = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["last-closed-shift", casinoId],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};
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
      closing_count: Record<string, any>;
      closing_cash: Record<string, any>;
      notes: string;
      // The fields below are intentionally IGNORED on the server side —
      // they're sent only as a UI-side reference and are overwritten by the
      // authoritative `compute_shift_close` RPC result before persisting.
      cash_result?: number;
      miss_total?: number;
      shift_result?: number;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");

      // 1. Authoritative recomputation server-side. The DB function reads
      //    transactions/expenses/miss_chips for the shift and returns the
      //    canonical totals. UI-supplied numbers are never trusted.
      const { data: rpcData, error: rpcError } = await (supabase as any)
        .rpc("compute_shift_close", { p_shift_id: input.shift_id });
      if (rpcError) throw rpcError;
      const totals = (rpcData || {}) as {
        cash_result?: number;
        miss_total?: number;
        shift_result?: number;
        expected_cash?: number;
      };

      // 2. Persist the closing snapshot using server-truth values.
      const { error } = await supabase
        .from("shifts")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          closing_count: input.closing_count,
          closing_cash: {
            ...input.closing_cash,
            // Overwrite with authoritative numbers in case the UI drifted.
            cash_result: Number(totals.cash_result ?? input.cash_result ?? 0),
            shift_result: Number(totals.shift_result ?? input.shift_result ?? 0),
            expected_authoritative: Number(totals.expected_cash ?? 0),
          },
          notes: input.notes,
          cash_result: Number(totals.cash_result ?? input.cash_result ?? 0),
          miss_total: Number(totals.miss_total ?? input.miss_total ?? 0),
          shift_result: Number(totals.shift_result ?? input.shift_result ?? 0),
        } as any)
        .eq("id", input.shift_id);
      if (error) throw error;
      await logAction(casinoId, "system", "SHIFT_CLOSED", {
        shift_id: input.shift_id,
        server_totals: totals,
      });
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
