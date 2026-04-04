import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { offlineMutation } from "@/lib/offline-mutation";
import { toast } from "sonner";

export const useDealers = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["dealers", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("dealers")
        .select("*")
        .eq("casino_id", casinoId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useCreateDealer = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async ({ name, category, is_pit_boss }: { name: string; category: string; is_pit_boss: boolean }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase.from("dealers").insert({ casino_id: casinoId, name, category: category as any, is_pit_boss });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dealers"] }); toast.success("Staff added"); },
  });
};

export const useUpdateDealer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; salary?: number | null; contract_start?: string | null; contract_end?: string | null; onboarding_date?: string | null; is_active?: boolean; category?: string; is_pit_boss?: boolean }) => {
      const { error } = await supabase.from("dealers").update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dealers"] }),
  });
};

// ============ PIT ROTA ============
export const usePitRota = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["pit-rota", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("pit_rota")
        .select("*, dealers(name)")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const usePitRotaRange = (startDate: string, endDate: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["pit-rota-range", casinoId, startDate, endDate],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("pit_rota")
        .select("*, dealers(name)")
        .eq("casino_id", casinoId)
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useSetPitRota = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { dealer_id: string; date: string; shift: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("pit_rota").upsert({
        casino_id: casinoId,
        dealer_id: input.dealer_id,
        date: input.date,
        shift: input.shift as any,
        created_by: user.id,
      }, { onConflict: "dealer_id,date" });
      if (error) throw error;
      await logAction(casinoId, "pit", "ROTA_SET", input);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["pit-rota-range"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["pit-rota-range"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((r: any) => r.dealer_id === input.dealer_id && r.date === input.date);
        const newEntry = { dealer_id: input.dealer_id, date: input.date, shift: input.shift, casino_id: casinoId, id: `temp-${Date.now()}`, created_by: user?.id };
        const updated = [...data];
        if (idx >= 0) { updated[idx] = { ...updated[idx], shift: input.shift }; } else { updated.push(newEntry); }
        qc.setQueryData(key, updated);
      });
      return { queries };
    },
    onError: (_err) => { toast.error("Sync error (rota) — will retry", { duration: 2000 }); },
    onSettled: () => {},
  });
};

export const useDeletePitRota = () => {
  const qc = useQueryClient();
  const { casinoId } = useAuth();
  return useMutation({
    mutationFn: async ({ dealer_id, date }: { dealer_id: string; date: string }) => {
      if (!casinoId) throw new Error("No casino");
      const { error } = await supabase
        .from("pit_rota")
        .delete()
        .eq("casino_id", casinoId)
        .eq("dealer_id", dealer_id)
        .eq("date", date);
      if (error) throw error;
    },
    onMutate: async ({ dealer_id, date }) => {
      await qc.cancelQueries({ queryKey: ["pit-rota-range"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["pit-rota-range"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, data.filter((r: any) => !(r.dealer_id === dealer_id && r.date === date)));
      });
      return { queries };
    },
    onError: (_err) => { toast.error("Sync error (rota delete) — will retry", { duration: 2000 }); },
    onSettled: () => {},
  });
};

// ============ DEALER ATTENDANCE ============
export const useDealerAttendance = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["dealer-attendance", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("dealer_attendance" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!casinoId,
  });
};

export const useSetDealerAttendance = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { dealer_id: string; date: string; value: string }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("dealer_attendance" as any).upsert({
        casino_id: casinoId,
        dealer_id: input.dealer_id,
        date: input.date,
        value: input.value,
        recorded_by: user.id,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "casino_id,dealer_id,date" });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["dealer-attendance-range"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["dealer-attendance-range"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((a: any) => a.dealer_id === input.dealer_id && a.date === input.date);
        const updated = [...data];
        const entry = { dealer_id: input.dealer_id, date: input.date, value: input.value, casino_id: casinoId };
        if (idx >= 0) { updated[idx] = { ...updated[idx], value: input.value }; } else { updated.push(entry); }
        qc.setQueryData(key, updated);
      });
      return { queries };
    },
    onError: (_err) => { toast.error("Sync error (attendance) — will retry", { duration: 2000 }); },
    onSettled: () => {},
  });
};

export const useDealerAttendanceRange = (startDate: string, endDate: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["dealer-attendance-range", casinoId, startDate, endDate],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("dealer_attendance" as any)
        .select("*")
        .eq("casino_id", casinoId)
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!casinoId,
  });
};

// ============ BREAKLIST ============
export const useBreaklistData = (date: string) => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["breaklist", casinoId, date],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("breaklist")
        .select("*, dealers(name), gaming_tables(name)")
        .eq("casino_id", casinoId)
        .eq("date", date);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

export const useSetBreaklistCell = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      dealer_id: string;
      time_slot: string;
      role: string;
      table_id: string | null;
    }) => {
      if (!casinoId || !user) throw new Error("Not authenticated");

      const payload = {
        casino_id: casinoId,
        date: input.date,
        dealer_id: input.dealer_id,
        time_slot: input.time_slot,
        role: input.role as any,
        table_id: input.table_id,
        created_by: user.id,
        updated_by: user.id,
      };

      const result = await offlineMutation({
        table: "breaklist",
        operation: "upsert",
        payload,
        upsertConflict: "casino_id,date,dealer_id,time_slot",
        meta: { role: input.role, dealer_id: input.dealer_id, time_slot: input.time_slot },
      });

      if (result.error) throw new Error(result.error);

      if (!result.offline) {
        const { data: existing } = await supabase
          .from("breaklist")
          .select("id, role, table_id")
          .eq("casino_id", casinoId)
          .eq("date", input.date)
          .eq("dealer_id", input.dealer_id)
          .eq("time_slot", input.time_slot)
          .maybeSingle();

        if (existing) {
          await supabase.from("breaklist_logs").insert({
            casino_id: casinoId,
            breaklist_id: existing.id,
            dealer_id: input.dealer_id,
            date: input.date,
            time_slot: input.time_slot,
            action: "CELL_UPDATED",
            old_role: null,
            new_role: input.role,
            old_table_id: null,
            new_table_id: input.table_id,
            operator_id: user.id,
          });
        }

        await logAction(casinoId, "breaklist", "CELL_SET", input);
      }

      return { offline: result.offline };
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["breaklist"] });
      const queries = qc.getQueriesData<any[]>({ queryKey: ["breaklist"] });
      queries.forEach(([key, data]) => {
        if (!data) return;
        const idx = data.findIndex((b: any) => b.dealer_id === input.dealer_id && b.time_slot === input.time_slot);
        const updated = [...data];
        const entry = { dealer_id: input.dealer_id, time_slot: input.time_slot, role: input.role, table_id: input.table_id, date: input.date, casino_id: casinoId, id: `temp-${Date.now()}`, is_locked: false };
        if (idx >= 0) { updated[idx] = { ...updated[idx], role: input.role, table_id: input.table_id }; } else { updated.push(entry); }
        qc.setQueryData(key, updated);
      });
      return { queries };
    },
    onError: (_err) => { toast.error("Sync error (breaklist) — will retry", { duration: 2000 }); },
    onSettled: () => {},
  });
};

export const useLockBreaklistCell = () => {
  const qc = useQueryClient();
  const { casinoId, user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, lock }: { id: string; lock: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("breaklist").update({
        is_locked: lock,
        locked_by: lock ? user.id : null,
        updated_by: user.id,
      }).eq("id", id);
      if (error) throw error;
      await logAction(casinoId!, "lock", lock ? "CELL_LOCKED" : "CELL_UNLOCKED", { breaklist_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["breaklist"] }); },
  });
};
