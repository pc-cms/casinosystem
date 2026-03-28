import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { CHIP_DENOMS, CHIP_DISTRIBUTION } from "@/lib/currency";

// ============ CHIP INVENTORY ============
export const useChipInventory = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-inventory", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("chip_inventory")
        .select("*")
        .eq("casino_id", casinoId);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useUpdateChipInventory = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      location_type: string;
      location_id: string | null;
      denomination: number;
      quantity: number;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      // Upsert: try update first, then insert
      const { data: existing } = await supabase
        .from("chip_inventory")
        .select("id")
        .eq("casino_id", casinoId)
        .eq("location_type", input.location_type)
        .eq("denomination", input.denomination)
        .eq("location_id", input.location_id ?? "")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("chip_inventory")
          .update({ quantity: input.quantity, updated_by: user.id } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("chip_inventory")
          .insert({
            casino_id: casinoId,
            location_type: input.location_type,
            location_id: input.location_id,
            denomination: input.denomination,
            quantity: input.quantity,
            updated_by: user.id,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip-inventory"] });
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ CHIP SNAPSHOTS ============
export const useChipSnapshots = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-snapshots", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("chip_snapshots")
        .select("*")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreateChipSnapshot = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      location_type: string;
      location_id: string | null;
      denomination: number;
      expected_quantity: number;
      actual_quantity: number;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chip_snapshots")
        .insert({
          casino_id: casinoId,
          date: input.date,
          location_type: input.location_type,
          location_id: input.location_id,
          denomination: input.denomination,
          expected_quantity: input.expected_quantity,
          actual_quantity: input.actual_quantity,
          recorded_by: user.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip-snapshots"] });
    },
    onError: (e) => toast.error(e.message),
  });
};

export const useBatchChipSnapshot = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      counts: Array<{
        location_type: string;
        location_id: string | null;
        denomination: number;
        expected_quantity: number;
        actual_quantity: number;
      }>;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const rows = input.counts.map(c => ({
        casino_id: casinoId,
        date: input.date,
        location_type: c.location_type,
        location_id: c.location_id,
        denomination: c.denomination,
        expected_quantity: c.expected_quantity,
        actual_quantity: c.actual_quantity,
        recorded_by: user.id,
      }));
      const { error } = await supabase
        .from("chip_snapshots")
        .insert(rows as any);
      if (error) throw error;
      await logAction(casinoId, "system", "CHIP_COUNT_RECORDED", {
        date: input.date,
        total_denominations: input.counts.length,
        total_miss: rows.reduce((s, r) => s + (r.actual_quantity - r.expected_quantity), 0),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip-snapshots"] });
      toast.success("Chip count recorded");
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ HELPERS ============

// Calculate expected chip quantities per denomination based on table config
export const getExpectedChips = (
  tables: Array<{ id: string; game: string; status: string; denominations: number[] }>,
): Record<number, number> => {
  const expected: Record<number, number> = {};
  CHIP_DENOMS.forEach(d => { expected[d] = 0; });

  // Tables
  tables.forEach(t => {
    const chipsPerDenom = t.game === "American Roulette"
      ? CHIP_DISTRIBUTION.roulette
      : CHIP_DISTRIBUTION.card;
    (t.denominations || []).forEach(d => {
      if (expected[d] !== undefined) expected[d] += chipsPerDenom;
    });
  });

  // Cashier float
  CHIP_DENOMS.forEach(d => { expected[d] += CHIP_DISTRIBUTION.cashier; });

  // Manager safe
  CHIP_DENOMS.forEach(d => { expected[d] += CHIP_DISTRIBUTION.safe; });

  return expected;
};

// Get initial total chips (what should never change)
export const getInitialTotal = (
  tables: Array<{ id: string; game: string; status: string; denominations: number[] }>,
): number => {
  const expected = getExpectedChips(tables);
  return Object.entries(expected).reduce((sum, [d, q]) => sum + Number(d) * q, 0);
};
