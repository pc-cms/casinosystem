/**
 * push-data — receives realtime data from local servers.
 * Local server POSTs { table, operation, payload, sync_secret, casino_id }
 * and this function validates the secret then writes to central DB.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_TABLES = [
  "transactions", "expenses", "players", "casino_visits", "player_cards",
  "player_tags", "player_notes", "cash_counts", "chip_snapshots",
  "chip_inventory", "breaklist", "dealer_attendance", "pit_rota",
  "gaming_tables", "table_tracker", "client_sessions", "activity_logs",
  "daily_summaries", "wallet_transactions", "cash_count_snapshots",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { table, operation, payload, sync_secret, casino_id, batch } = body;

    if (!sync_secret || !casino_id) {
      return new Response(JSON.stringify({ error: "Missing sync_secret or casino_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate sync secret against local_servers table
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: server, error: serverErr } = await admin
      .from("local_servers")
      .select("id, casino_id")
      .eq("casino_id", casino_id)
      .eq("sync_secret", sync_secret)
      .single();

    if (serverErr || !server) {
      return new Response(JSON.stringify({ error: "Invalid sync credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_sync_at
    await admin
      .from("local_servers")
      .update({ last_sync_at: new Date().toISOString(), is_online: true })
      .eq("id", server.id);

    // Handle batch mode (array of actions)
    const actions = batch
      ? (batch as Array<{ table: string; operation: string; payload: any }>)
      : [{ table, operation, payload }];

    const results: Array<{ ok: boolean; error?: string }> = [];

    for (const action of actions) {
      if (!ALLOWED_TABLES.includes(action.table)) {
        results.push({ ok: false, error: `Table '${action.table}' not allowed` });
        continue;
      }

      if (!["insert", "upsert", "update"].includes(action.operation)) {
        results.push({ ok: false, error: `Operation '${action.operation}' not supported` });
        continue;
      }

      // Ensure casino_id matches the authenticated server
      const data = Array.isArray(action.payload)
        ? action.payload.map((p: any) => ({ ...p, casino_id: server.casino_id }))
        : { ...action.payload, casino_id: server.casino_id };

      let result;
      if (action.operation === "insert") {
        result = await admin.from(action.table).insert(data);
      } else if (action.operation === "upsert") {
        result = await admin.from(action.table).upsert(data);
      } else if (action.operation === "update") {
        const { _match, ...updateFields } = Array.isArray(data) ? data[0] : data;
        if (_match) {
          let q = admin.from(action.table).update(updateFields);
          for (const [k, v] of Object.entries(_match as Record<string, any>)) {
            q = q.eq(k, v);
          }
          result = await q;
        } else {
          results.push({ ok: false, error: "Update requires _match field" });
          continue;
        }
      }

      if (result?.error) {
        results.push({ ok: false, error: result.error.message });
      } else {
        results.push({ ok: true });
      }
    }

    const synced = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return new Response(
      JSON.stringify({ synced, failed, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
