/**
 * use-pending-servers — realtime список заявок на pairing.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PendingServer = {
  id: string;
  pairing_code: string;
  server_name: string;
  server_slug: string | null;
  server_ip: string | null;
  hostname: string | null;
  system_info: Record<string, unknown> | null;
  status: "pending" | "approved" | "rejected" | "expired" | "consumed";
  approved_casino_id: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  expires_at: string;
};

export const usePendingServers = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("pending-server-registrations")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pending_server_registrations" },
        () => qc.invalidateQueries({ queryKey: ["pending-servers"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["pending-servers"],
    queryFn: async (): Promise<PendingServer[]> => {
      const { data, error } = await supabase
        .from("pending_server_registrations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PendingServer[];
    },
    refetchInterval: 15_000,
  });
};

export const usePendingCount = () => {
  const { data = [] } = usePendingServers();
  return data.filter(d => d.status === "pending").length;
};

export const approveServer = async (id: string, casino_id: string) => {
  const { data, error } = await supabase.functions.invoke("register-local-server/approve", {
    body: { id, casino_id },
  });
  if (error) throw error;
  return data;
};

export const rejectServer = async (id: string, reason?: string) => {
  const { data, error } = await supabase.functions.invoke("register-local-server/reject", {
    body: { id, reason },
  });
  if (error) throw error;
  return data;
};
