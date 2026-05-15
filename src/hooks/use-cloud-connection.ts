/**
 * Cloud connection hooks for the LOCAL on-prem admin UI.
 * Talks to the local cms-sync HTTP API (proxied by nginx as /api/cloud/*).
 *
 * Only renders when runtime-config.localMode === true.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CloudConnection {
  id: number;
  cloud_url: string | null;
  status: "disconnected" | "pairing" | "connected";
  pairing_code: string | null;
  pairing_expires_at: string | null;
  casino_id: string | null;
  connected_at: string | null;
  last_polled_at: string | null;
  last_error: string | null;
}

async function authHeader(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/cloud${path}`, {
    ...init,
    headers: { ...(await authHeader()), ...(init?.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  return j as T;
}

export function useCloudConnection() {
  return useQuery({
    queryKey: ["cloud-connection"],
    queryFn: async () => {
      const { connection } = await call<{ connection: CloudConnection | null }>("/status");
      return connection;
    },
    refetchInterval: (q) => (q.state.data?.status === "pairing" ? 5_000 : 30_000),
  });
}

export function useStartPairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cloud_url: string) =>
      call<{ pairing_code: string; expires_at: string }>("/start-pairing", {
        method: "POST",
        body: JSON.stringify({ cloud_url }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cloud-connection"] }),
  });
}

export function usePollPairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => call<{ status: string }>("/poll-pairing", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cloud-connection"] }),
  });
}

export function useDisconnectCloud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => call<{ ok: true }>("/disconnect", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cloud-connection"] }),
  });
}

export function useTriggerInitialSync() {
  return useMutation({
    mutationFn: async () => call<{ ok: true; job: any }>("/initial-sync", { method: "POST" }),
  });
}
