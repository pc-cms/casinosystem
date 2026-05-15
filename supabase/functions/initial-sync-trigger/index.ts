/**
 * initial-sync-trigger — управление initial sync job для on-prem серверов.
 *
 * Endpoints:
 *   POST /            (super_admin JWT)
 *     body: { local_server_id }
 *     → создаёт `initial_sync_jobs` row со status='pending'
 *
 *   GET /             (x-sync-secret + x-casino-id)
 *     → возвращает текущий pending/running job для этого казино,
 *       либо { job: null }
 *
 *   PATCH /           (x-sync-secret + x-casino-id)
 *     body: { job_id, status?, tables_total?, tables_done?, rows_total?,
 *             rows_done?, current_table?, error? }
 *     → обновляет прогресс job. На status='running' впервые ставит started_at.
 *       На status='done'/'failed' ставит finished_at.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret, x-casino-id",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireSuperAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  return data ? userData.user : null;
}

async function authBySyncSecret(req: Request, admin: ReturnType<typeof createClient>) {
  const secret = req.headers.get("x-sync-secret") ?? "";
  const casinoId = req.headers.get("x-casino-id") ?? "";
  if (!secret || !casinoId) return null;
  const { data } = await admin
    .from("local_servers")
    .select("id, casino_id")
    .eq("casino_id", casinoId)
    .eq("sync_secret", secret)
    .maybeSingle();
  return data ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // ───── POST: super_admin создаёт job ─────
    if (req.method === "POST") {
      const user = await requireSuperAdmin(req);
      if (!user) return json(403, { error: "super_admin required" });

      const body = await req.json().catch(() => ({}));
      const local_server_id = body?.local_server_id;
      if (!local_server_id) return json(400, { error: "local_server_id required" });

      const { data: srv, error: srvErr } = await admin
        .from("local_servers")
        .select("id, casino_id, is_online")
        .eq("id", local_server_id)
        .maybeSingle();
      if (srvErr || !srv) return json(404, { error: "local server not found" });

      // Не плодим параллельные jobs: если уже есть pending/running — возвращаем его.
      const { data: existing } = await admin
        .from("initial_sync_jobs")
        .select("*")
        .eq("local_server_id", local_server_id)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) return json(200, { job: existing, reused: true });

      const { data: job, error } = await admin
        .from("initial_sync_jobs")
        .insert({
          casino_id: srv.casino_id,
          local_server_id: srv.id,
          status: "pending",
          requested_by: user.id,
        })
        .select("*")
        .single();
      if (error) return json(500, { error: error.message });
      return json(200, { job });
    }

    // ───── GET: локальный сервер опрашивает свой job ─────
    if (req.method === "GET") {
      const auth = await authBySyncSecret(req, admin);
      if (!auth) return json(401, { error: "invalid sync credentials" });
      const { data: job } = await admin
        .from("initial_sync_jobs")
        .select("*")
        .eq("local_server_id", auth.id)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json(200, { job: job ?? null });
    }

    // ───── PATCH: локальный сервер двигает прогресс ─────
    if (req.method === "PATCH") {
      const auth = await authBySyncSecret(req, admin);
      if (!auth) return json(401, { error: "invalid sync credentials" });

      const body = await req.json().catch(() => ({}));
      const { job_id } = body;
      if (!job_id) return json(400, { error: "job_id required" });

      const patch: Record<string, unknown> = {};
      const allowed = [
        "status",
        "tables_total",
        "tables_done",
        "rows_total",
        "rows_done",
        "current_table",
        "error",
      ];
      for (const k of allowed) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      if (patch.status === "running") patch.started_at = new Date().toISOString();
      if (patch.status === "done" || patch.status === "failed") {
        patch.finished_at = new Date().toISOString();
      }

      const { data, error } = await admin
        .from("initial_sync_jobs")
        .update(patch)
        .eq("id", job_id)
        .eq("local_server_id", auth.id)
        .select("*")
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!data) return json(404, { error: "job not found for this server" });
      return json(200, { job: data });
    }

    return json(405, { error: "method not allowed" });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
