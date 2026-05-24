/**
 * use-tips — aggregations for cashier-collected tips.
 *
 * Tips are stored in `transactions` with type IN ('tips_live','tips_poker','tips_floor').
 * They are immutable like all other cash transactions. They DO NOT affect
 * tables_result / shift_result and DO NOT create player visits.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type TipsKind = "tips_live" | "tips_poker" | "tips_floor";

export interface TipsRow {
  id: string;
  type: TipsKind;
  amount: number;
  business_date: string;
  created_at: string;
  shift_id: string | null;
  table_id: string | null;
  tips_recipient_employee_id: string | null;
  cancelled_at: string | null;
  gaming_tables?: { name: string } | null;
  employees?: { full_name: string } | null;
}

/** All tips of a given kind in date range. */
export const useTipsByRange = (
  kind: TipsKind | TipsKind[],
  startIso: string,
  endIso: string,
  enabled = true,
) => {
  const { casinoId } = useAuth();
  const kinds = Array.isArray(kind) ? kind : [kind];
  return useQuery({
    queryKey: ["tips", casinoId, kinds.join(","), startIso, endIso],
    enabled: enabled && !!casinoId,
    queryFn: async () => {
      if (!casinoId) return [] as TipsRow[];
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, business_date, created_at, shift_id, table_id, tips_recipient_employee_id, cancelled_at, gaming_tables(name), employees:tips_recipient_employee_id(full_name)")
        .eq("casino_id", casinoId)
        .in("type", kinds as any)
        .gte("business_date", startIso)
        .lte("business_date", endIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).filter(r => !r.cancelled_at) as TipsRow[];
    },
    staleTime: 30_000,
  });
};

/** Sum of dealer-pool tips (live + poker) per day within a period. */
export const useTipsCollectedForPeriod = (startIso: string, endIso: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["tips", "dealer-pool", casinoId, startIso, endIso],
    enabled: !!casinoId,
    queryFn: async () => {
      if (!casinoId) return { byDay: {} as Record<string, number>, total: 0 };
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, business_date, cancelled_at")
        .eq("casino_id", casinoId)
        .in("type", ["tips_live", "tips_poker"] as any)
        .gte("business_date", startIso)
        .lte("business_date", endIso);
      if (error) throw error;
      const byDay: Record<string, number> = {};
      let total = 0;
      ((data || []) as any[]).forEach(r => {
        if (r.cancelled_at) return;
        const d = r.business_date as string;
        const amt = Number(r.amount) || 0;
        byDay[d] = (byDay[d] || 0) + amt;
        total += amt;
      });
      return { byDay, total };
    },
    staleTime: 30_000,
  });
};
