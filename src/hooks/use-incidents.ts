/**
 * Incidents — CCTV/Manager violation log.
 * - List incidents for the current casino (default last 30 days).
 * - Insert new incident (CCTV / Manager / Super admin).
 * - Immutable: no updates, no deletes (per core principles).
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Incident = {
  id: string;
  casino_id: string;
  incident_date: string;
  incident_time: string;
  cctv_observer: string | null;
  manager: string | null;
  department: string | null;
  employees: string | null;
  table_name: string | null;
  dealer_name: string | null;
  inspector_name: string | null;
  violation_type: string | null;
  incident: string;
  outcome: string | null;
  points: number;
  comments: string | null;
  photo_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type IncidentInput = Omit<Incident, "id" | "casino_id" | "created_by" | "created_at">;

export const useIncidents = (days = 30) => {
  const { casinoId } = useAuth();
  const qc = useQueryClient();

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: ["incidents", casinoId, days],
    queryFn: async () => {
      if (!casinoId) return [] as Incident[];
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("casino_id", casinoId)
        .gte("incident_date", sinceDate)
        .order("incident_date", { ascending: false })
        .order("incident_time", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as Incident[];
    },
    enabled: !!casinoId,
  });

  useEffect(() => {
    if (!casinoId) return;
    const channel = supabase
      .channel(`incidents-${casinoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `casino_id=eq.${casinoId}` },
        () => qc.invalidateQueries({ queryKey: ["incidents", casinoId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [casinoId, qc]);

  return query;
};

export const useCreateIncident = () => {
  const { casinoId, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IncidentInput) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const payload = {
        ...input,
        casino_id: casinoId,
        created_by: user.id,
      };
      const { data, error } = await supabase.from("incidents").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents", casinoId] }),
  });
};
