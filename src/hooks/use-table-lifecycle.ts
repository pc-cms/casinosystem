import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";

// ============ CHIP BASELINE ============
export const useChipBaseline = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip-baseline", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("chip_baseline")
        .select("*")
        .eq("casino_id", casinoId);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useUpsertBaseline = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (entries: Array<{
      location_type: string;
      location_id: string | null;
      denomination: number;
      expected_quantity: number;
    }>) => {
      if (!casinoId) throw new Error("No casino");
      for (const entry of entries) {
        const { data: existing } = await supabase
          .from("chip_baseline")
          .select("id")
          .eq("casino_id", casinoId)
          .eq("location_type", entry.location_type)
          .eq("denomination", entry.denomination)
          .is("location_id", entry.location_id === null ? null : undefined as any)
          .maybeSingle();

        // Try with location_id match if not null
        let found = existing;
        if (!found && entry.location_id) {
          const { data: existing2 } = await supabase
            .from("chip_baseline")
            .select("id")
            .eq("casino_id", casinoId)
            .eq("location_type", entry.location_type)
            .eq("location_id", entry.location_id)
            .eq("denomination", entry.denomination)
            .maybeSingle();
          found = existing2;
        }

        if (found) {
          const { error } = await supabase
            .from("chip_baseline")
            .update({ expected_quantity: entry.expected_quantity } as any)
            .eq("id", found.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("chip_baseline")
            .insert({
              casino_id: casinoId,
              location_type: entry.location_type,
              location_id: entry.location_id,
              denomination: entry.denomination,
              expected_quantity: entry.expected_quantity,
            } as any);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip-baseline"] });
      toast.success("Baseline updated");
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ CASINO INFO (float_locked) ============
export const useCasinoInfo = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["casino-info", casinoId],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("casinos")
        .select("*")
        .eq("id", casinoId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!casinoId,
  });
};

export const useLockFloat = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("casinos")
        .update({ float_locked: true } as any)
        .eq("id", casinoId);
      if (error) throw error;
      await logAction(casinoId, "system", "FLOAT_LOCKED", {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casino-info"] });
      toast.success("Casino float locked");
    },
    onError: (e) => toast.error(e.message),
  });
};

export const useUpdateCasinoSchedule = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (input: { shift_start: string; shift_end: string; tables_open: string; breaklist_lock: string; cage_float?: number }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("casinos")
        .update(input as any)
        .eq("id", casinoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casino-info"] });
      toast.success("Schedule updated");
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ TABLE LIFECYCLE ============

// Open a single table (Pit action) — clears closing data
export const useOpenTable = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (tableId: string) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("gaming_tables")
        .update({ status: "open" as any, closing_chips: null, closing_result: null })
        .eq("id", tableId);
      if (error) throw error;
      await logAction(casinoId, "system", "TABLE_OPENED", { table_id: tableId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gaming-tables"] });
    },
    onError: (e) => toast.error(e.message),
  });
};

// Open all closed tables at once
export const useOpenAllTables = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (tableIds: string[]) => {
      if (!casinoId) throw new Error("No casino");
      for (const id of tableIds) {
        const { error } = await supabase
          .from("gaming_tables")
          .update({ status: "open" as any, closing_chips: null, closing_result: null })
          .eq("id", id);
        if (error) throw error;
      }
      await logAction(casinoId, "system", "TABLES_OPENED", { table_ids: tableIds });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gaming-tables"] });
      toast.success("Tables opened");
    },
    onError: (e) => toast.error(e.message),
  });
};

// Set result on tables (Pit action) — stores closing_chips + closing_result
export const useSetTableResults = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (results: Array<{
      table_id: string;
      closing_chips: Record<string, number>; // denom → actual count
      closing_result: number; // total value deviation from baseline
    }>) => {
      if (!casinoId) throw new Error("No casino");
      for (const r of results) {
        const { error } = await supabase
          .from("gaming_tables")
          .update({
            closing_chips: r.closing_chips as any,
            closing_result: r.closing_result,
          })
          .eq("id", r.table_id);
        if (error) throw error;
      }
      await logAction(casinoId, "system", "TABLE_RESULTS_SET", {
        tables: results.length,
        total_result: results.reduce((s, r) => s + r.closing_result, 0),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gaming-tables"] });
      toast.success("Table results recorded");
    },
    onError: (e) => toast.error(e.message),
  });
};

// Close all tables (Cashier action) — sets status to 'closed'
export const useCloseAllTables = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async (tableIds: string[]) => {
      if (!casinoId) throw new Error("No casino");
      for (const id of tableIds) {
        const { error } = await supabase
          .from("gaming_tables")
          .update({ status: "closed" as any })
          .eq("id", id);
        if (error) throw error;
      }
      await logAction(casinoId, "system", "TABLES_CLOSED_BY_CASHIER", { table_ids: tableIds });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gaming-tables"] });
      toast.success("Tables closed");
    },
    onError: (e) => toast.error(e.message),
  });
};

// ============ HELPERS ============

// Get baseline as a convenient map: { [tableId]: { [denom]: qty } }
export const baselineToMap = (
  baseline: Array<{ location_type: string; location_id: string | null; denomination: number; expected_quantity: number }>
): Record<string, Record<number, number>> => {
  const map: Record<string, Record<number, number>> = {};
  baseline.forEach(b => {
    const key = b.location_id || b.location_type;
    if (!map[key]) map[key] = {};
    map[key][b.denomination] = b.expected_quantity;
  });
  return map;
};
