/**
 * POS Shift hooks — current waiter's open shift, open/close shift, Z-report.
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
  z_report: PosZReport | null;
  created_at: string;
};

export type PosZReportTotals = {
  gross_tzs: number;
  cash: number;
  card: number;
  comp_player: number;
  comp_house: number;
};

export type PosZReportCounts = {
  tabs_closed: number;
  tabs_voided: number;
  orders_total: number;
  orders_void: number;
};

export type PosZReportLine = {
  category_name?: string;
  item_id?: string;
  item_name?: string;
  qty: number;
  total_tzs: number;
};

export type PosZReport = {
  shift_id: string;
  casino_id: string;
  waiter_user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  totals: PosZReportTotals;
  expected_cash: number;
  cash_delta: number;
  counts: PosZReportCounts;
  by_category: PosZReportLine[];
  by_item: PosZReportLine[];
  computed_at: string;
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
      return (data ?? null) as unknown as PosShift | null;
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
      return data as unknown as PosShift;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.casino_id, vars.waiter_user_id) });
    },
  });
}

/** Any open POS shift in a casino (used by Pit quick-order). */
export function usePosAnyOpenShift(casinoId: string | null) {
  return useQuery({
    queryKey: ["pos-shift", "any-open", casinoId],
    enabled: !!casinoId,
    queryFn: async (): Promise<PosShift | null> => {
      const { data, error } = await supabase
        .from("pos_shifts")
        .select("*")
        .eq("casino_id", casinoId!)
        .is("closed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PosShift | null;
    },
    staleTime: 15_000,
  });
}

/** Preview Z-report for an OPEN shift (closing_cash treated as 0 until close). Read-only. */
export function usePosZReportPreview(shiftId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["pos-zreport", "preview", shiftId],
    enabled: !!shiftId && enabled,
    queryFn: async (): Promise<PosZReport> => {
      const { data, error } = await supabase.rpc("pos_compute_z_report", { _shift_id: shiftId! });
      if (error) throw error;
      return data as unknown as PosZReport;
    },
  });
}

export function useClosePosShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shift_id: string; closing_cash: number }): Promise<PosZReport> => {
      const { data, error } = await supabase.rpc("pos_close_shift", {
        _shift_id: input.shift_id,
        _closing_cash: input.closing_cash,
      });
      if (error) throw error;
      return data as unknown as PosZReport;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-shift"] });
      qc.invalidateQueries({ queryKey: ["pos-tabs"] });
      qc.invalidateQueries({ queryKey: ["pos-zreport"] });
    },
  });
}
