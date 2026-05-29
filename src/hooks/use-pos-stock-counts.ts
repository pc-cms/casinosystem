/**
 * POS Stock Counts — bartender shelf counts done at handover/open/close.
 * Variance is recorded for manager report. Saving aligns stock_qty to counted_qty
 * via an auto-issued adjustment movement (server-side, atomic).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";

export type StockCountType = "open" | "handover" | "close" | "adhoc";

export interface StockCountRow {
  id: string;
  casino_id: string;
  shift_id: string | null;
  count_type: StockCountType;
  counted_by: string;
  counted_by_name: string | null;
  notes: string | null;
  total_variance_value_tzs: number;
  items_count: number;
  created_at: string;
}

export interface StockCountItemRow {
  id: string;
  count_id: string;
  item_id: string;
  expected_qty: number;
  counted_qty: number;
  variance_qty: number;
  unit_cost_tzs: number;
  variance_value_tzs: number;
}

export interface SaveStockCountInput {
  shift_id: string | null;
  count_type: StockCountType;
  notes?: string | null;
  items: Array<{ item_id: string; counted_qty: number }>;
}

export function usePosStockCounts(limit = 50) {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["pos-stock-counts", activeCasinoId, limit],
    enabled: !!activeCasinoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_stock_counts")
        .select("*")
        .eq("casino_id", activeCasinoId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as StockCountRow[];
    },
  });
}

export function usePosStockCountItems(countId: string | null) {
  return useQuery({
    queryKey: ["pos-stock-count-items", countId],
    enabled: !!countId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_stock_count_items")
        .select("*")
        .eq("count_id", countId!);
      if (error) throw error;
      return (data ?? []) as StockCountItemRow[];
    },
  });
}

export function useSavePosStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveStockCountInput) => {
      const { data, error } = await supabase.rpc("pos_save_stock_count", {
        _shift_id: input.shift_id,
        _count_type: input.count_type,
        _items: input.items as any,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-stock-counts"] });
      qc.invalidateQueries({ queryKey: ["pos-menu"] });
      qc.invalidateQueries({ queryKey: ["pos-inventory"] });
    },
  });
}
