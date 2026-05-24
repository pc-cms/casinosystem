/**
 * Monthly attendance + holidays + payroll refresh.
 * Source: RPC get_monthly_attendance returns one row per (employee × day) for a month.
 * Manual edits go through attendance_hours; holidays via attendance_holidays.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface MonthlyAttendanceRow {
  employee_id: string;
  full_name: string;
  department: string;
  job_position: string | null;
  is_pit_boss: boolean;
  dealer_category: string | null;
  photo_url: string | null;
  d: string;
  auto_hours: number;
  manual_hours: number | null;
  effective_hours: number;
  raw_value: string | null;
  is_holiday: boolean;
  holiday_multiplier: number;
}

export interface AttendanceHoliday {
  id: string;
  casino_id: string;
  date: string;
  name: string;
  multiplier: number;
}

export const useMonthlyAttendance = (monthFirstDay: string) => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["monthly_attendance", activeCasinoId, monthFirstDay],
    queryFn: async (): Promise<MonthlyAttendanceRow[]> => {
      const { data, error } = await supabase.rpc("get_monthly_attendance", {
        p_casino_id: activeCasinoId!,
        p_month: monthFirstDay,
      });
      if (error) throw error;
      return (data || []) as MonthlyAttendanceRow[];
    },
    enabled: !!activeCasinoId,
  });
};

export const useHolidays = (monthFirstDay: string) => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["attendance_holidays", activeCasinoId, monthFirstDay],
    queryFn: async (): Promise<AttendanceHoliday[]> => {
      const start = monthFirstDay;
      const end = new Date(new Date(monthFirstDay).getFullYear(), new Date(monthFirstDay).getMonth() + 1, 0)
        .toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("attendance_holidays")
        .select("*")
        .eq("casino_id", activeCasinoId!)
        .gte("date", start)
        .lte("date", end)
        .order("date");
      if (error) throw error;
      return (data || []) as AttendanceHoliday[];
    },
    enabled: !!activeCasinoId,
  });
};

export const useUpsertHoliday = () => {
  const qc = useQueryClient();
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { date: string; name: string; multiplier: number }) => {
      const { error } = await supabase
        .from("attendance_holidays")
        .upsert(
          { casino_id: activeCasinoId!, date: input.date, name: input.name, multiplier: input.multiplier, created_by: user?.id },
          { onConflict: "casino_id,date" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance_holidays"] });
      qc.invalidateQueries({ queryKey: ["monthly_attendance"] });
      toast.success("Holiday saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteHoliday = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance_holidays"] });
      qc.invalidateQueries({ queryKey: ["monthly_attendance"] });
      toast.success("Holiday removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useSetAttendanceHours = () => {
  const qc = useQueryClient();
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { employee_id: string; date: string; hours: number }) => {
      const { error } = await supabase
        .from("attendance_hours")
        .upsert(
          {
            casino_id: activeCasinoId!,
            employee_id: input.employee_id,
            date: input.date,
            hours: input.hours,
            recorded_by: user?.id,
          },
          { onConflict: "casino_id,employee_id,date" }
        );
      if (error) throw error;
    },
    // Optimistic update — flip the cell instantly so the user does not wait
    // for the refetch round-trip. The background invalidation in onSettled
    // reconciles with server-computed effective_hours / holiday flags.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["monthly_attendance"] });
      const snapshots: Array<[unknown, unknown]> = [];
      const matches = qc.getQueriesData<any[]>({ queryKey: ["monthly_attendance"] });
      for (const [key, data] of matches) {
        snapshots.push([key, data]);
        if (!Array.isArray(data)) continue;
        const next = data.map((r: any) => {
          if (r.employee_id !== input.employee_id || r.d !== input.date) return r;
          return {
            ...r,
            manual_hours: input.hours,
            // Best-effort: treat manual hours as effective until server returns.
            effective_hours: input.hours,
            raw_value: input.hours > 0 ? String(input.hours) : "",
          };
        });
        qc.setQueryData(key, next);
      }
      return { snapshots };
    },
    onError: (err: Error, _input, ctx) => {
      // Rollback on failure so the cell does not stay in a wrong state.
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) qc.setQueryData(key as any, data);
      }
      toast.error(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["monthly_attendance"] }),
  });
};


export const useRefreshPayrollPeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase.rpc("payroll_refresh_period", { _period_id: periodId });
      if (error) throw error;
      return data as { added: number; updated: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["payroll_entries"] });
      qc.invalidateQueries({ queryKey: ["payroll_audit"] });
      toast.success(`Refreshed: +${r.added} new · ${r.updated} updated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
