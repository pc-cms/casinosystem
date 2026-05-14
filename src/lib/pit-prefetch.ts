/**
 * Warm cache for the Pit module so the installed PWA loads instantly
 * (and survives short network drops) with all data the pit boss needs.
 *
 * Requests run SEQUENTIALLY on purpose: when the same account is open in
 * several tabs / on several devices (PWA + browser), 8 parallel auth-bearing
 * requests can each kick off their own /token refresh. Supabase's auth server
 * rate-limits /token at a low ceiling — once we hit 429, the SDK drops the
 * session and the user is bounced back to /login. Sequential prefetch keeps
 * us under that ceiling at the cost of a slightly slower warm-up.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBusinessDate } from "@/lib/business-day";
import { fetchChipSnapshots } from "@/lib/chip-snapshots";

// In-flight guard so a remount of <PitShell> can't fire a second wave.
const inFlight = new Map<string, Promise<void>>();

export async function prefetchPitData(qc: QueryClient, casinoId: string) {
  if (!casinoId) return;
  const today = getBusinessDate();

  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const key = `${casinoId}|${today}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const tasks: Array<() => Promise<unknown>> = [
    () => qc.prefetchQuery({
      queryKey: ["dealers", casinoId],
      queryFn: async () => {
        // Phase 3: dealers = employees WHERE department='Live Game'
        const { data, error } = await supabase
          .from("employees").select("*")
          .eq("casino_id", casinoId).eq("department", "Live Game").order("full_name");
        if (error) throw error;
        return data;
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["gaming-tables", casinoId, false],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("gaming_tables").select("*")
          .eq("casino_id", casinoId).eq("is_archived", false).order("name");
        if (error) throw error;
        return data;
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["chip-baseline", casinoId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("chip_baseline").select("*").eq("casino_id", casinoId);
        if (error) throw error;
        return data;
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["chip-snapshots", casinoId, today],
      queryFn: async () => {
        return fetchChipSnapshots(casinoId, today);
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["pit-rota-range", casinoId, monthStart, monthEnd],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("pit_rota").select("*")
          .eq("casino_id", casinoId).gte("date", monthStart).lte("date", monthEnd);
        if (error) throw error;
        return data;
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["dealer-attendance-range", casinoId, monthStart, monthEnd],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("dealer_attendance" as any).select("*")
          .eq("casino_id", casinoId).gte("date", monthStart).lte("date", monthEnd);
        if (error) throw error;
        return data as any[];
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["breaklist", casinoId, today],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("breaklist").select("*, gaming_tables(name)")
          .eq("casino_id", casinoId).eq("date", today);
        if (error) throw error;
        return data;
      },
    }),
    () => qc.prefetchQuery({
      queryKey: ["table-tracker", casinoId, today],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("table_tracker").select("*, gaming_tables(name)")
          .eq("casino_id", casinoId).eq("date", today);
        if (error) throw error;
        return data;
      },
    }),
  ];

  const run = (async () => {
    try {
      for (const task of tasks) {
        try { await task(); } catch { /* keep warming the rest */ }
      }
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, run);
  return run;
}
