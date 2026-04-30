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

      // Idempotency: skip if already applied
      const { data: dup } = await admin
        .from("sync_inbox_log")
        .select("id")
        .eq("casino_id", server.casino_id)
        .eq("local_id", local_id)
        .maybeSingle();
      if (dup) { accepted.push(local_id); continue; }

      try {
        if (op === "DELETE") {
          await admin.from(table).delete().eq("id", pk.id);
        } else {
          // Force casino_id to авторизованного, защита от подделки
          const safe = { ...payload, casino_id: server.casino_id };
          const { error } = await admin.from(table).upsert(safe, { onConflict: "id" });
          if (error) throw error;
        }
        await admin.from("sync_inbox_log").insert({
          casino_id: server.casino_id,
          local_id,
          table_name: table,
          op,
        });
        accepted.push(local_id);
      } catch (e: any) {
        rejected.push({ local_id, error: e?.message ?? String(e) });
      }
    }
    return json({ accepted, rejected });
  }

  // ───────────── PULL (cloud → local) ─────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const since = url.searchParams.get("since") ?? "1970-01-01T00:00:00Z";
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 500);

    // Отдаём изменения, которые касаются этого казино ИЛИ глобальные (casino_id IS NULL)
    const { data, error } = await admin
      .from("sync_outbox")
      .select("table_name, op, pk, payload, changed_at, casino_id")
      .or(`casino_id.eq.${server.casino_id},casino_id.is.null`)
      .gt("changed_at", since)
      .order("changed_at", { ascending: true })
      .limit(limit);

    if (error) return json({ error: error.message }, 500);

    const changes = (data ?? []).map((r) => ({
      table: r.table_name,
      op: r.op,
      pk: r.pk,
      payload: r.payload,
      changed_at: r.changed_at,
    }));
    const next_since = changes.length > 0 ? changes[changes.length - 1].changed_at : since;
    return json({ changes, next_since });
  }

  return json({ error: "method not allowed" }, 405);
});
