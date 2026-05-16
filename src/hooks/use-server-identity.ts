/**
 * use-server-identity — read/write CASINO_SLUG / CASINO_ID / NAME / DOMAIN / IP
 * stored in the local server's .env. Hot-restarts cms-frontend after save so
 * the new runtime-config takes effect (~30 s downtime).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedRuntimeConfig } from "@/lib/runtime-config";
import { toast } from "sonner";

export interface ServerIdentity {
  casino_id: string;
  casino_slug: string;
  casino_name: string;
  local_domain: string;
  local_ip: string;
  unconfigured: boolean;
}

export const isLocalServer = () => getCachedRuntimeConfig()?.localMode === true;

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not authenticated");
  const r = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export const useServerIdentity = () =>
  useQuery({
    queryKey: ["server-identity"],
    queryFn: (): Promise<ServerIdentity> => authedFetch("/api/node/server-identity"),
    enabled: isLocalServer(),
    staleTime: 30_000,
  });

export const useSaveServerIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<ServerIdentity>) =>
      authedFetch("/api/node/server-identity", {
        method: "POST",
        body: JSON.stringify(p),
      }),
    onSuccess: () => {
      toast.success("Saved — frontend restarting (~30 s)");
      qc.invalidateQueries({ queryKey: ["server-identity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
