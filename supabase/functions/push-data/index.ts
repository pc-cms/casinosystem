/**
 * push-data — DEPRECATED (2026-04-30)
 * ─────────────────────────────────────
 * Replaced by `pull-changes` which is bidirectional, idempotent
 * (sync_inbox_log) and uses the sync.outbox model.
 *
 * Kept as a 410 Gone shim so any old self-hosted node still pointing
 * here gets a clear, machine-readable error and operators see it in
 * monitoring instead of silent data loss.
 *
 * Removal target: when all on-prem nodes report cms-sync ≥ v1.1.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret, x-casino-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "push-data is deprecated. Use POST /functions/v1/pull-changes (see deploy/sync/index.js).",
      replacement: "pull-changes",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
