/**
 * report-health — receives lightweight health snapshot from cms-monitor on each
 * self-hosted server. POST { metrics } with x-sync-secret + x-casino-id auth.
 * Stores latest snapshot in local_servers.health_snapshot for Premier Dashboard.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-sync-secret, x-casino-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = req.headers.get("x-sync-secret") ?? "";
  const casino = req.headers.get("x-casino-id") ?? "";
  if (!secret || !casino) return json({ error: "missing headers" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: srv, error } = await admin
    .from("local_servers").select("id").eq("casino_id", casino).eq("sync_secret", secret).maybeSingle();
  if (error || !srv) return json({ error: "invalid creds" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  await admin.from("local_servers").update({
    health_snapshot: body?.metrics ?? body,
    health_updated_at: new Date().toISOString(),
    is_online: true,
    last_sync_at: new Date().toISOString(),
  }).eq("id", srv.id);

  return json({ ok: true });
});
