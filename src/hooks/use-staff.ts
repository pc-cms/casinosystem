import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { UNIFIED_SHIFT_COLORS } from "@/lib/shift-colors";

export type StaffDepartment = "security" | "cashier" | "bartender" | "hostess" | "waiter" | "cleaner" | "it" | "hr" | "driver" | "reception";

export interface StaffMember {
  id: string;
  casino_id: string;
  name: string;
  department: StaffDepartment;
  is_active: boolean;
  salary: number | null;
  contract_start: string | null;
  contract_end: string | null;
  onboarding_date: string | null;
  created_at: string;
}

export const DEPARTMENT_LABELS: Record<StaffDepartment, string> = {
  security: "Security",
  cashier: "Cashiers",
  bartender: "Bar",
  hostess: "Hostess",
  waiter: "Waiters",
  cleaner: "Housekeeping",
  it: "IT",
  hr: "HR",
  driver: "Driver",
  reception: "Reception",
};

export const DEPARTMENT_ORDER: StaffDepartment[] = [
  "security", "cashier", "bartender", "hostess", "waiter", "cleaner", "reception", "it", "hr", "driver",
];

// Rota group definitions
export const ROTA_GROUPS = {
  office: {
    label: "Office",
    departments: ["it", "hr", "driver"] as StaffDepartment[],
    shifts: ["D", "N", "L", "E", "O"] as const,
    shiftLabels: { D: "Day (12:30)", N: "Night (20:45)", L: "Leave", E: "Extra", O: "Off" } as Record<string, string>,
  },
  floor: {
    label: "Floor",
    departments: ["bartender", "cleaner", "waiter", "hostess", "reception"] as StaffDepartment[],
    shifts: ["D", "N", "L", "E", "O"] as const,
    shiftLabels: { D: "Day (12:30)", N: "Night (20:45)", L: "Leave", E: "Extra", O: "Off" } as Record<string, string>,
  },
  security: {
    label: "Security",
    departments: ["security"] as StaffDepartment[],
    shifts: ["D", "M", "N", "G", "L", "E", "O"] as const,
    shiftLabels: { D: "Day (06-14)", M: "Mid (13:45-22)", N: "Night (17:45-03)", G: "Guard (21:45-06)", L: "Leave", E: "Extra", O: "Off" } as Record<string, string>,
  },
} as const;

export type RotaGroupKey = keyof typeof ROTA_GROUPS;

const STAFF_SHIFTS = ["D", "N", "L", "E", "O"] as const;

export const STAFF_SHIFT_LABELS: Record<string, string> = {
  D: "Day (12:30)",
  N: "Night (20:45)",
  L: "Leave",
  E: "Extra",
  O: "Off",
};

export const STAFF_SHIFT_COLORS = UNIFIED_SHIFT_COLORS;

export const useStaffMembers = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["staff_members", casinoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("casino_id", casinoId!)
        .order("department")
        .order("name");
      if (error) throw error;
      return data as StaffMember[];
    },
    enabled: !!casinoId,
  });
};

export const useCreateStaffMember = () => {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, department }: { name: string; department: StaffDepartment }) => {
      const { error } = await supabase
        .from("staff_members")
        .insert({ casino_id: casinoId!, name, department });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff_members"] }),
  });
};

export const useUpdateStaffMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; salary?: number | null; contract_start?: string | null; contract_end?: string | null; onboarding_date?: string | null; is_active?: boolean }) => {
      const { error } = await supabase
        .from("staff_members")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff_members"] }),
  });
};

export const useStaffRotaRange = (startDate: string, endDate: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["staff_rota", casinoId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_rota")
        .select("*")
        .eq("casino_id", casinoId!)
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!casinoId,
  });
};

export const useSetStaffRota = () => {
  const { casinoId, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ staff_id, date, shift }: { staff_id: string; date: string; shift: string }) => {
      const { error } = await supabase
        .from("staff_rota")
        .upsert({
          casino_id: casinoId!,
          staff_id,
          date,
          shift,
          created_by: user!.id,
        }, { onConflict: "casino_id,staff_id,date" });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["staff_rota"] });
      const prev = qc.getQueryData(["staff_rota", casinoId]) as any[];
      qc.setQueriesData({ queryKey: ["staff_rota"] }, (old: any[] | undefined) => {
        if (!old) return old;
        const idx = old.findIndex((r: any) => r.staff_id === vars.staff_id && r.date === vars.date);
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = { ...copy[idx], shift: vars.shift };
          return copy;
        }
        return [...old, { staff_id: vars.staff_id, date: vars.date, shift: vars.shift, casino_id: casinoId }];
      });
      return { prev };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["staff_rota"] }),
  });
};

export const useDeleteStaffRota = () => {
  const { casinoId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ staff_id, date }: { staff_id: string; date: string }) => {
      const { error } = await supabase
        .from("staff_rota")
        .delete()
        .eq("casino_id", casinoId!)
        .eq("staff_id", staff_id)
        .eq("date", date);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["staff_rota"] });
      qc.setQueriesData({ queryKey: ["staff_rota"] }, (old: any[] | undefined) => {
        if (!old) return old;
        return old.filter((r: any) => !(r.staff_id === vars.staff_id && r.date === vars.date));
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["staff_rota"] }),
  });
};

export const useStaffAttendanceRange = (startDate: string, endDate: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["staff_attendance", casinoId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_attendance")
        .select("*")
        .eq("casino_id", casinoId!)
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!casinoId,
  });
};

export const useSetStaffAttendance = () => {
  const { casinoId, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ staff_id, date, value }: { staff_id: string; date: string; value: string }) => {
      const { error } = await supabase
        .from("staff_attendance")
        .upsert({
          casino_id: casinoId!,
          staff_id,
          date,
          value,
          recorded_by: user!.id,
        }, { onConflict: "casino_id,staff_id,date" });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["staff_attendance"] });
      qc.setQueriesData({ queryKey: ["staff_attendance"] }, (old: any[] | undefined) => {
        if (!old) return old;
        const idx = old.findIndex((a: any) => a.staff_id === vars.staff_id && a.date === vars.date);
        if (idx >= 0) {
          const copy = [...old];
          copy[idx] = { ...copy[idx], value: vars.value };
          return copy;
        }
        return [...old, { staff_id: vars.staff_id, date: vars.date, value: vars.value, casino_id: casinoId }];
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["staff_attendance"] }),
  });
};
