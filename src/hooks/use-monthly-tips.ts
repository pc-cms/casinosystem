import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";

/**
 * Monthly Tips — mirror of Weekly Bonus, but period is always
 * the 16th of the previous month through the 15th of the current month.
 * period_start is the anchor 16th date.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;

/** Period start (the 16th) for the period that contains the given date. */
export const getPeriodStart16 = (d: Date): string => {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  if (day >= 16) return toIso(y, m, 16);
  // previous month's 16th
  const prev = new Date(y, m - 1, 16);
  return toIso(prev.getFullYear(), prev.getMonth(), 16);
};

/** Period end (15th of next month) for a given period_start (16th). */
export const getPeriodEnd15 = (periodStartIso: string): string => {
  const [y, m, d] = periodStartIso.split("-").map(Number);
  const end = new Date(y, m - 1 + 1, 15); // next month, 15th
  return toIso(end.getFullYear(), end.getMonth(), 15);
};

export const addMonthsPeriod = (periodStartIso: string, months: number): string => {
  const [y, m] = periodStartIso.split("-").map(Number);
  const next = new Date(y, m - 1 + months, 16);
  return toIso(next.getFullYear(), next.getMonth(), 16);
};

/** Iterate every ISO date day from start..end inclusive. */
export const enumerateDays = (startIso: string, endIso: string): string[] => {
  const out: string[] = [];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    out.push(toIso(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

export interface MonthlyTipsEntry {
  id?: string;
  employee_id: string;
  period_start: string;
  extra_override: number | null;
  bonus_points: number;
}

export interface MonthlyTipsPool {
  id?: string;
  period_start: string;
  pool_amount: number;
  currency: string;
  is_calculated: boolean;
  calculated_at: string | null;
}

export const useMonthlyTipsEntries = (periodStart: string) => {
  const { activeCasinoId: casinoId } = useCasino();
  return useQuery({
    queryKey: ["monthly-tips-entries", casinoId, periodStart],
    queryFn: async () => {
      if (!casinoId) return [] as MonthlyTipsEntry[];
      const { data, error } = await supabase
        .from("monthly_tips_entries" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .eq("period_start", periodStart);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ ...r, dealer_id: r.employee_id })) as unknown as MonthlyTipsEntry[];
    },
    enabled: !!casinoId,
  });
};

export const useMonthlyTipsPool = (periodStart: string) => {
  const { activeCasinoId: casinoId } = useCasino();
  return useQuery({
    queryKey: ["monthly-tips-pool", casinoId, periodStart],
    queryFn: async () => {
      if (!casinoId) return null;
      const { data, error } = await supabase
        .from("monthly_tips_pools" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as MonthlyTipsPool | null;
    },
    enabled: !!casinoId,
  });
};

export const useUpsertMonthlyTipsEntry = () => {
  const qc = useQueryClient();
  const { activeCasinoId: casinoId } = useCasino();
  return useMutation({
    mutationFn: async (input: { dealer_id: string; period_start: string; extra_override?: number | null; bonus_points?: number }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("monthly_tips_entries" as any)
        .upsert(
          {
            casino_id: casinoId,
            employee_id: input.dealer_id,
            period_start: input.period_start,
            extra_override: input.extra_override ?? null,
            bonus_points: input.bonus_points ?? 0,
          } as any,
          { onConflict: "casino_id,employee_id,period_start" },
        );
      if (error) throw error;
    },
    // Optimistic: PTS column updates instantly.
    onMutate: async (input) => {
      const key = ["monthly-tips-entries", casinoId, input.period_start];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<any[]>(key);
      const list = prev ? [...prev] : [];
      const idx = list.findIndex((e: any) => (e.dealer_id ?? e.employee_id) === input.dealer_id);
      const patched: any = {
        dealer_id: input.dealer_id,
        employee_id: input.dealer_id,
        period_start: input.period_start,
        extra_override: input.extra_override ?? null,
        bonus_points: input.bonus_points ?? 0,
      };
      if (idx >= 0) list[idx] = { ...list[idx], ...patched };
      else list.push(patched);
      qc.setQueryData(key, list);
      return { prev, key };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["monthly-tips-entries", casinoId, vars.period_start] });
    },
  });
};

export const useUpsertMonthlyTipsPool = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeCasinoId: casinoId } = useCasino();
  return useMutation({
    mutationFn: async (input: { period_start: string; pool_amount: number; currency?: string; calculate: boolean }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("monthly_tips_pools" as any)
        .upsert(
          {
            casino_id: casinoId,
            period_start: input.period_start,
            pool_amount: input.pool_amount,
            currency: input.currency ?? "TZS",
            is_calculated: input.calculate,
            calculated_at: input.calculate ? new Date().toISOString() : null,
            calculated_by: input.calculate ? user?.id ?? null : null,
          },
          { onConflict: "casino_id,period_start" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["monthly-tips-pool", casinoId, vars.period_start] });
    },
  });
};
