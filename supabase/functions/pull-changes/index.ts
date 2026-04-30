/**
 * pull-changes — bidirectional sync endpoint for self-hosted casino servers.
 *
 * POST  → local cms-sync пушит batch изменений из своей outbox.
 *         Body: { casino_id, changes: [{local_id, table, op, pk, payload}] }
 *         Auth: header `x-sync-secret` сверяется с local_servers.sync_secret.
 *         Response: { accepted: [local_id, ...], rejected: [{local_id, error}] }
 *
 * GET   → local cms-sync поллит изменения из Cloud → Local.
 *         Query: ?since=ISO8601&limit=N
 *         Response: { changes: [{table, op, pk, payload, changed_at}], next_since }
 *
 * Идемпотентность: каждое входящее изменение логируется в sync_inbox_log
 * по (casino_id, local_id) UNIQUE — повтор не вызовет двойную запись.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret, x-casino-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Whitelist таблиц, которые сервер примет от локали (анти-injection)
const ALLOWED_TABLES = new Set([
  "transactions","shifts","cage_transfers","expenses",
  "wallet_transactions","chip_emissions","chip_baseline","chip_inventory",
  "chip_initial_baseline","chip_snapshots","miss_chips",
  "casino_visits","players","player_cards","player_tags","player_notes",
  "breaklist","rota","employee_attendance",
  "activity_logs","daily_review","budget_items","budget_periods",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function authenticate(req: Request, admin: ReturnType<typeof createClient>) {
  const secret = req.headers.get("x-sync-secret") ?? "";
  const casinoHeader = req.headers.get("x-casino-id") ?? "";
  if (!secret || !casinoHeader) {
    return { error: json({ error: "missing x-sync-secret or x-casino-id" }, 401) };
  }
  const { data, error } = await admin
    .from("local_servers")
    .select("id, casino_id")
    .eq("casino_id", casinoHeader)
    .eq("sync_secret", secret)
    .maybeSingle();
  if (error || !data) {
    return { error: json({ error: "invalid sync credentials" }, 401) };
  }
  // touch heartbeat
  await admin
    .from("local_servers")
    .update({ last_sync_at: new Date().toISOString(), is_online: true })
    .eq("id", data.id);
  return { server: data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const auth = await authenticate(req, admin);
  if ("error" in auth) return auth.error;
  const { server } = auth;

  // ───────────── PUSH (local → cloud) ─────────────
  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    if (changes.length === 0) return json({ accepted: [], rejected: [] });

    const accepted: number[] = [];
    const rejected: Array<{ local_id: number; error: string }> = [];

    for (const ch of changes) {
      const { local_id, table, op, pk, payload } = ch ?? {};
      if (typeof local_id !== "number" || !table || !op || !pk) {
        rejected.push({ local_id, error: "malformed change" });
        continue;
      }
      if (!ALLOWED_TABLES.has(table)) {
        rejected.push({ local_id, error: `table not allowed: ${table}` });
        continue;
      }

      // Atomic: dedup + apply + loop-guard via sync.applying GUC happen
      // inside one DB call. Bounce-back into outbox is prevented.
      const { data: result, error } = await admin.rpc("sync_apply_remote", {
        p_casino_id: server.casino_id,
        p_local_id:  local_id,
        p_table:     table,
        p_op:        op,
        p_pk:        pk,
        p_payload:   payload ?? {},
      });
      if (error) {
        rejected.push({ local_id, error: error.message });
      } else if ((result as any)?.status === "error") {
        rejected.push({ local_id, error: (result as any).error });
      } else {
        accepted.push(local_id); // includes "duplicate" — already applied
      }
    }
    return json({ accepted, rejected });
  }

  // ───────────── PULL (cloud → local) ─────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const since = url.searchParams.get("since") ?? "1970-01-01T00:00:00Z";
    const sinceId = parseInt(url.searchParams.get("since_id") ?? "0", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 500);

    // Stable pagination: (changed_at, id) — no row loss on duplicate timestamps.
    // Accepts since + since_id from previous page; falls back to since-only.
    let q = admin
      .from("sync_outbox")
      .select("id, table_name, op, pk, payload, changed_at, casino_id")
      .or(`casino_id.eq.${server.casino_id},casino_id.is.null`)
      .order("changed_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);

    if (sinceId > 0) {
      // (changed_at > since) OR (changed_at = since AND id > since_id)
      q = q.or(`changed_at.gt.${since},and(changed_at.eq.${since},id.gt.${sinceId})`);
    } else {
      q = q.gte("changed_at", since);
    }

    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const rows = data ?? [];
    const changes = rows.map((r) => ({
      table: r.table_name,
      op: r.op,
      pk: r.pk,
      payload: r.payload,
      changed_at: r.changed_at,
      id: r.id,
    }));
    const last = rows[rows.length - 1];
    return json({
      changes,
      next_since:    last ? last.changed_at : since,
      next_since_id: last ? last.id        : sinceId,
    });
  }

  return json({ error: "method not allowed" }, 405);
});
