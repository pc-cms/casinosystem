/**
 * Warm cache for the Pit module so the installed PWA loads instantly
 * (and survives short network drops) with all data the pit boss needs.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBusinessDate } from "@/lib/business-day";

export async function prefetchPitData(qc: QueryClient, casinoId: string) {
  if (!casinoId) return;
  const today = getBusinessDate();

  // Build month range for rota / attendance
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Run sequentially — parallel auth-bearing requests can trigger
  // multiple simultaneous token refreshes when several tabs/PWA instances
  // share the same account, hitting Supabase's /token rate limit (429)
  // and forcing the user back to /login.
  const tasks: Array<() => Promise<unknown>> = [
    () => qc.prefetchQuery({
      queryKey: ["dealers", casinoId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("dealers").select("*").eq("casino_id", casinoId).order("name");
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["gaming-tables", casinoId, false],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("gaming_tables").select("*")
          .eq("casino_id", casinoId).eq("is_archived", false).order("name");
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["chip-baseline", casinoId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("chip_baseline").select("*").eq("casino_id", casinoId);
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["chip-snapshots", casinoId, today],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("chip_snapshots").select("*").eq("casino_id", casinoId).eq("date", today);
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["pit-rota-range", casinoId, monthStart, monthEnd],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("pit_rota").select("*, dealers(name)")
          .eq("casino_id", casinoId).gte("date", monthStart).lte("date", monthEnd);
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["dealer-attendance-range", casinoId, monthStart, monthEnd],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("dealer_attendance" as any).select("*")
          .eq("casino_id", casinoId).gte("date", monthStart).lte("date", monthEnd);
        if (error) throw error;
        return data as any[];
      },
    }),
    qc.prefetchQuery({
      queryKey: ["breaklist", casinoId, today],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("breaklist").select("*, dealers(name), gaming_tables(name)")
          .eq("casino_id", casinoId).eq("date", today);
        if (error) throw error;
        return data;
      },
    }),
    qc.prefetchQuery({
      queryKey: ["table-tracker", casinoId, today],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("table_tracker").select("*, gaming_tables(name)")
          .eq("casino_id", casinoId).eq("date", today);
        if (error) throw error;
        return data;
      },
    }),
  ]);
}
