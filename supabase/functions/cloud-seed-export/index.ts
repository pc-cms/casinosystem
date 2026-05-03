/**
 * cloud-seed-export — initial data seed для свежего локального сервера.
 * ─────────────────────────────────────────────────────────────────────
 * Используется install.sh при первой установке on-prem сервера, чтобы
 * перенести ВСЕ данные конкретного казино (config + последние 90 дней
 * операционных таблиц) из Cloud в пустую локальную БД.
 *
 * GET /cloud-seed-export?casino_id=<uuid>&days=90
 *   Headers:
 *     x-service-key: <service_role JWT>   ← обязательно (write-protected)
 *
 *   Response: NDJSON-stream (Content-Type: application/x-ndjson)
 *     {"_meta":{"casino_id":"...","exported_at":"...","tables":[...]}}
 *     {"table":"casinos","row":{...}}
 *     {"table":"currencies","row":{...}}
 *     ...
 *     {"_done":true,"counts":{"casinos":1,"players":1234,...}}
 *
 * Безопасность: явная сверка переданного x-service-key с
 *   SUPABASE_SERVICE_ROLE_KEY. Это НЕ публичный endpoint — он отдаёт
 *   полные данные казино, поэтому ключ обязателен.
 *
 * Идемпотентность не нужна (стрим только GET, импортёр сам делает
 *   ON CONFLICT DO NOTHING).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-service-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Порядок ВАЖЕН — соблюдаем FK-зависимости при импорте.
// "scope": full → выгрузить всё, что относится к этому casino_id;
//          single → выгрузить одну строку из casinos;
//          global → выгрузить всю таблицу (справочники, общие для сети).
const TABLES: Array<{ name: string; scope: "single" | "full" | "global"; sinceDays?: number }> = [
  // 1. Справочники (нужны раньше FK)
  { name: "casinos", scope: "single" },

  // 2. Конфиг этого казино (полностью)
  { name: "gaming_tables", scope: "full" },
  { name: "chip_color_settings", scope: "full" },
  { name: "chip_initial_baseline", scope: "full" },
  { name: "chip_baseline", scope: "full" },
  { name: "chip_inventory", scope: "full" },
  { name: "financial_wallets", scope: "full" },
  { name: "budget_categories", scope: "full" },
  { name: "budget_periods", scope: "full" },
  { name: "budget_items", scope: "full" },

  // 3. Сотрудники
  { name: "dealers", scope: "full" },
  { name: "staff_members", scope: "full" },

  // 4. Игроки и карты
  { name: "players", scope: "full" },
  { name: "player_cards", scope: "full" },
  { name: "player_groups", scope: "full" },
  { name: "group_members", scope: "full" },
  { name: "player_tags", scope: "full" },
  { name: "player_notes", scope: "full" },

  // 5. Пользователи системы (только привязки этого казино)
  { name: "user_casino_access", scope: "full" },
  { name: "user_module_permissions", scope: "full" },

  // 6. Операционные данные (последние N дней — задаётся ?days=90)
  { name: "shifts", scope: "full", sinceDays: 90 },
  { name: "transactions", scope: "full", sinceDays: 90 },
  { name: "casino_visits", scope: "full", sinceDays: 90 },
  { name: "breaklist", scope: "full", sinceDays: 90 },
  { name: "pit_rota", scope: "full", sinceDays: 90 },
  { name: "staff_rota", scope: "full", sinceDays: 90 },
  { name: "dealer_attendance", scope: "full", sinceDays: 90 },
  { name: "staff_attendance", scope: "full", sinceDays: 90 },
  { name: "cage_transfers", scope: "full", sinceDays: 90 },
  { name: "expenses", scope: "full", sinceDays: 90 },
  { name: "wallet_transactions", scope: "full", sinceDays: 90 },
  { name: "chip_emissions", scope: "full", sinceDays: 90 },
  { name: "chip_snapshots", scope: "full", sinceDays: 90 },
  { name: "miss_chips", scope: "full", sinceDays: 90 },
  { name: "table_tracker", scope: "full", sinceDays: 90 },
  { name: "table_daily_results", scope: "full", sinceDays: 90 },
  { name: "business_day_closures", scope: "full", sinceDays: 90 },
  { name: "cash_counts", scope: "full", sinceDays: 90 },
  { name: "cash_count_snapshots", scope: "full", sinceDays: 90 },
  { name: "cashless_transactions", scope: "full", sinceDays: 90 },
  { name: "bank_checks", scope: "full", sinceDays: 90 },
  { name: "cctv_observations", scope: "full", sinceDays: 90 },
  { name: "chip_transfers", scope: "full", sinceDays: 90 },
  { name: "player_position_history", scope: "full", sinceDays: 90 },
  { name: "daily_summaries", scope: "full", sinceDays: 90 },
  { name: "inter_casino_transfers", scope: "full", sinceDays: 90 },
];

const PAGE_SIZE = 1000;

// Поле даты, по которому фильтруем "последние N дней" для каждой таблицы.
const DATE_COLUMN: Record<string, string> = {
  shifts: "created_at",
  transactions: "created_at",
  casino_visits: "created_at",
  breaklist: "business_date",
  pit_rota: "rota_date",
  staff_rota: "rota_date",
  dealer_attendance: "business_date",
  staff_attendance: "business_date",
  cage_transfers: "created_at",
  expenses: "business_date",
  wallet_transactions: "created_at",
  chip_emissions: "created_at",
  chip_snapshots: "created_at",
  miss_chips: "business_date",
  table_tracker: "business_date",
  table_daily_results: "business_date",
  business_day_closures: "business_date",
  cash_counts: "business_date",
  cash_count_snapshots: "created_at",
  cashless_transactions: "created_at",
  bank_checks: "created_at",
  cctv_observations: "created_at",
  chip_transfers: "created_at",
  player_position_history: "changed_at",
  daily_summaries: "business_date",
  inter_casino_transfers: "created_at",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: corsHeaders });
  }

  // — auth —
  const providedKey = req.headers.get("x-service-key") ?? "";
  if (!providedKey || providedKey !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "invalid x-service-key" }), { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const casinoId = url.searchParams.get("casino_id") ?? "";
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "90", 10)));
  if (!/^[0-9a-f-]{36}$/i.test(casinoId)) {
    return new Response(JSON.stringify({ error: "casino_id required (uuid)" }), { status: 400, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
  const counts: Record<string, number> = {};

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const writeLine = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      writeLine({
        _meta: {
          casino_id: casinoId,
          exported_at: new Date().toISOString(),
          since_days: days,
          tables: TABLES.map((t) => t.name),
        },
      });

      try {
        for (const t of TABLES) {
          counts[t.name] = 0;
          let from = 0;

          // single — одна строка из casinos
          if (t.scope === "single") {
            const { data, error } = await admin.from(t.name).select("*").eq("id", casinoId).maybeSingle();
            if (error) { writeLine({ _error: { table: t.name, msg: error.message } }); continue; }
            if (data) { writeLine({ table: t.name, row: data }); counts[t.name] = 1; }
            continue;
          }

          // full / global — пагинация
          while (true) {
            let q = admin.from(t.name).select("*").range(from, from + PAGE_SIZE - 1);
            if (t.scope === "full") q = q.eq("casino_id", casinoId);
            if (t.sinceDays && DATE_COLUMN[t.name]) {
              q = q.gte(DATE_COLUMN[t.name], sinceIso);
            }
            const { data, error } = await q;
            if (error) {
              writeLine({ _error: { table: t.name, msg: error.message } });
              break;
            }
            if (!data || data.length === 0) break;
            for (const row of data) writeLine({ table: t.name, row });
            counts[t.name] += data.length;
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
        }
        writeLine({ _done: true, counts });
      } catch (e) {
        writeLine({ _fatal: String((e as Error)?.message ?? e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
});
