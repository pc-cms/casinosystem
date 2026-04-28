import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface ChipConservationRow {
  casino_id: string;
  denomination: number;
  initial_quantity: number;
  in_locations: number;
  archived_miss: number;
  live_floor: number;
}

/** Live статус закона сохранения фишек по номиналам */
export const useChipConservation = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-conservation", casinoId],
    queryFn: async (): Promise<ChipConservationRow[]> => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("chip_conservation_status" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .order("denomination", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        casino_id: r.casino_id,
        denomination: Number(r.denomination),
        initial_quantity: Number(r.initial_quantity),
        in_locations: Number(r.in_locations),
        archived_miss: Number(r.archived_miss),
        live_floor: Number(r.live_floor),
      }));
    },
    enabled: !!casinoId,
    refetchInterval: 30_000,
  });
};

/** Initial baseline (источник истины) */
export const useChipInitialBaseline = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-initial-baseline", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("chip_initial_baseline" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .order("denomination", { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown) as Array<{
        id: string;
        casino_id: string;
        denomination: number;
        initial_quantity: number;
      }>;
    },
    enabled: !!casinoId,
  });
};

/** Bulk инициализация baseline (Manager) */
export const useInitializeChipBaseline = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (rows: Array<{ denomination: number; initial_quantity: number }>) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const payload = rows
        .filter((r) => r.initial_quantity > 0)
        .map((r) => ({
          casino_id: casinoId,
          denomination: r.denomination,
          initial_quantity: r.initial_quantity,
          created_by: user.id,
        }));
      if (!payload.length) return;
      const { error } = await supabase.from("chip_initial_baseline" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip-initial-baseline"] });
      qc.invalidateQueries({ queryKey: ["chip-conservation"] });
      toast.success("Initial baseline set");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============ MISS CHIPS ARCHIVE ============
export interface MissChipRow {
  id: string;
  casino_id: string;
  shift_id: string | null;
  business_date: string;
  denomination: number;
  quantity: number;
  total_value_tzs: number;
  created_at: string;
}

export const useMissChipsArchive = (params?: { fromDate?: string; toDate?: string }) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["miss-chips", casinoId, params?.fromDate, params?.toDate],
    queryFn: async (): Promise<MissChipRow[]> => {
      if (!casinoId) return [];
      let q = supabase
        .from("miss_chips" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .order("business_date", { ascending: false });
      if (params?.fromDate) q = q.gte("business_date", params.fromDate);
      if (params?.toDate) q = q.lte("business_date", params.toDate);
      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as unknown) as MissChipRow[];
    },
    enabled: !!casinoId,
  });
};

// ============ CHIP EMISSIONS ============
export interface ChipEmissionRow {
  id: string;
  casino_id: string;
  denomination: number;
  quantity_added: number;
  reason: string;
  operator_id: string;
  created_at: string;
}

export const useChipEmissions = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-emissions", casinoId],
    queryFn: async (): Promise<ChipEmissionRow[]> => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("chip_emissions" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data || []) as unknown) as ChipEmissionRow[];
    },
    enabled: !!casinoId,
  });
};

export const useCreateChipEmission = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { denomination: number; quantity_added: number; reason: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      if (!input.reason.trim()) throw new Error("Reason is required");
      if (input.quantity_added <= 0) throw new Error("Quantity must be > 0");
      const { error } = await supabase.from("chip_emissions" as any).insert({
        casino_id: casinoId,
        denomination: input.denomination,
        quantity_added: input.quantity_added,
        reason: input.reason.trim(),
        operator_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip-emissions"] });
      qc.invalidateQueries({ queryKey: ["chip-initial-baseline"] });
      qc.invalidateQueries({ queryKey: ["chip-conservation"] });
      toast.success("Chip emission recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============ MISS CHIPS BY SHIFT (Monthly Report) ============
export interface MissChipsByShiftRow {
  shift_id: string | null;
  business_date: string;
  closed_at: string | null;
  denoms: Record<number, number>; // denomination -> quantity
  total_value_tzs: number;
}

export const useMissChipsByShift = (params: { fromDate: string; toDate: string }) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["miss-chips-by-shift", casinoId, params.fromDate, params.toDate],
    queryFn: async (): Promise<MissChipsByShiftRow[]> => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("miss_chips" as any)
        .select("shift_id, business_date, denomination, quantity, total_value_tzs")
        .eq("casino_id", casinoId)
        .gte("business_date", params.fromDate)
        .lte("business_date", params.toDate);
      if (error) throw error;

      const shiftIds = Array.from(
        new Set((data || []).map((r: any) => r.shift_id).filter(Boolean) as string[])
      );
      let closedMap = new Map<string, string>();
      if (shiftIds.length) {
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, closed_at")
          .in("id", shiftIds);
        (shifts || []).forEach((s: any) => closedMap.set(s.id, s.closed_at));
      }

      const grouped = new Map<string, MissChipsByShiftRow>();
      (data || []).forEach((r: any) => {
        const key = r.shift_id ?? `nodate-${r.business_date}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            shift_id: r.shift_id,
            business_date: r.business_date,
            closed_at: r.shift_id ? closedMap.get(r.shift_id) ?? null : null,
            denoms: {},
            total_value_tzs: 0,
          });
        }
        const row = grouped.get(key)!;
        row.denoms[Number(r.denomination)] =
          (row.denoms[Number(r.denomination)] ?? 0) + Number(r.quantity);
        row.total_value_tzs += Number(r.total_value_tzs);
      });

      return Array.from(grouped.values()).sort((a, b) => {
        if (a.business_date !== b.business_date) return b.business_date.localeCompare(a.business_date);
        return (b.closed_at ?? "").localeCompare(a.closed_at ?? "");
      });
    },
    enabled: !!casinoId,
  });
};
