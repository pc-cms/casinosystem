/**
 * use-local-updater — talks to cms-sync `/api/node/updater/*` endpoints on a
 * local on-prem server. Returns null/false in Cloud mode so the panel hides.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedRuntimeConfig } from "@/lib/runtime-config";
import { toast } from "sonner";

export interface LocalUpdaterStatus {
  current_version: string;
  previous_version: string | null;
  available_version: string | null;
  available_image: string | null;
  available_pushed: boolean;
  auto_apply: boolean;
  push_command: { id?: string; target_version?: string; auto_apply?: boolean; ts?: string } | null;
  push_ack: { command_id?: string; status?: string; message?: string | null; ts?: string } | null;
  log_tail: string[];
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

export const useLocalUpdaterStatus = () => useQuery({
  queryKey: ["local-updater-status"],
  queryFn: (): Promise<LocalUpdaterStatus> => authedFetch("/api/node/updater/status"),
  enabled: isLocalServer(),
  refetchInterval: 15_000,
});

export const useLocalUpdaterCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authedFetch("/api/node/updater/check", { method: "POST", body: "{}" }),
    onSuccess: () => {
      toast.success("Check queued — refreshing in ~10 s");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["local-updater-status"] }), 12_000);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useLocalUpdaterApply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { version?: string; auto_apply?: boolean }) =>
      authedFetch("/api/node/updater/apply", { method: "POST", body: JSON.stringify(p) }),
    onSuccess: () => {
      toast.success("Apply queued — frontend will restart shortly");
      qc.invalidateQueries({ queryKey: ["local-updater-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
