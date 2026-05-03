/**
 * use-chip-colors — Per-casino chip color settings.
 * Falls back to defaults from CHIP_COLORS in lib/currency.ts when no override exists.
 *
 * Three-color model (matches real poker chips):
 *   bg    — main body color
 *   edge  — color of the 6 inserts around the rim
 *   text  — denomination label color
 */
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CHIP_DENOMS } from "@/lib/currency";
import { toast } from "sonner";

export interface ChipColorRow {
  denomination: number;
  bg_color: string;
  edge_color: string;
  text_color: string;
}

export interface ChipColors {
  bg: string;
  edge: string;
  text: string;
}

// Default HEX values (mirror tailwind classes from CHIP_COLORS, approximate)
export const DEFAULT_CHIP_HEX: Record<number, ChipColors> = {
  500:        { bg: "#DC2626", edge: "#FFFFFF", text: "#FFFFFF" }, // red-600
  1_000:      { bg: "#2563EB", edge: "#FFFFFF", text: "#FFFFFF" }, // blue-600
  2_000:      { bg: "#16A34A", edge: "#FFFFFF", text: "#FFFFFF" }, // green-600
  5_000:      { bg: "#9333EA", edge: "#FFFFFF", text: "#FFFFFF" }, // purple-600
  10_000:     { bg: "#EAB308", edge: "#000000", text: "#000000" }, // yellow-500 → black inserts
  25_000:     { bg: "#F97316", edge: "#FFFFFF", text: "#FFFFFF" }, // orange-500
  50_000:     { bg: "#DB2777", edge: "#FFFFFF", text: "#FFFFFF" }, // pink-600
  100_000:    { bg: "#000000", edge: "#FFFFFF", text: "#FFFFFF" },
  500_000:    { bg: "#0D9488", edge: "#FFFFFF", text: "#FFFFFF" }, // teal-600
  1_000_000:  { bg: "#FBBF24", edge: "#000000", text: "#000000" }, // amber-400
  5_000_000:  { bg: "#BE123C", edge: "#FFFFFF", text: "#FFFFFF" }, // rose-700
};

export const useChipColors = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["chip_color_settings", casinoId],
    queryFn: async (): Promise<Record<number, ChipColors>> => {
      if (!casinoId) return {};
      const { data, error } = await supabase
        .from("chip_color_settings")
        .select("denomination, bg_color, edge_color, text_color")
        .eq("casino_id", casinoId);
      if (error) throw error;
      const map: Record<number, ChipColors> = {};
      (data || []).forEach((r: any) => {
        map[Number(r.denomination)] = {
          bg: r.bg_color,
          edge: r.edge_color || "#FFFFFF",
          text: r.text_color,
        };
      });
      return map;
    },
    enabled: !!casinoId,
    staleTime: 1000 * 60 * 5,
  });
};

/** Resolve color for a denomination, with override → default fallback. */
export const resolveChipColor = (
  denom: number,
  overrides?: Record<number, ChipColors>,
): ChipColors => {
  if (overrides?.[denom]) return overrides[denom];
  return DEFAULT_CHIP_HEX[denom] || { bg: "#6B7280", edge: "#FFFFFF", text: "#FFFFFF" };
};

export const useUpsertChipColor = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { denomination: number; bg_color: string; edge_color: string; text_color: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chip_color_settings")
        .upsert(
          {
            casino_id: casinoId,
            denomination: input.denomination,
            bg_color: input.bg_color,
            edge_color: input.edge_color,
            text_color: input.text_color,
            updated_by: user.id,
          },
          { onConflict: "casino_id,denomination" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chip_color_settings", casinoId] });
      toast.success("Chip color updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Greedy chip breakdown: largest → smallest. */
export const greedyChipBreakdown = (
  amount: number,
  denoms: readonly number[] = CHIP_DENOMS,
): Record<number, number> => {
  const result: Record<number, number> = {};
  let remaining = Math.max(0, Math.floor(amount));
  // Ensure descending order
  const sorted = [...denoms].sort((a, b) => b - a);
  for (const d of sorted) {
    if (remaining >= d) {
      const count = Math.floor(remaining / d);
      result[d] = count;
      remaining -= count * d;
    }
  }
  return result;
};

/** Sum chip values: { 100000: 2, 50000: 1 } => 250000 */
export const sumChips = (chips: Record<number, number>): number =>
  Object.entries(chips).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

export const ALL_DENOMS = CHIP_DENOMS;
