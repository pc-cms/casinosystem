/**
 * Map sidebar nav routes (and labels) → ModuleKey for the Permission Matrix.
 * If a route has no entry, it is NOT gated by per-user overrides.
 */
import type { ModuleKey } from "@/lib/modules";

/** Resolve module key from a NAV_ITEMS `to` (may include "?tab="). */
export const moduleKeyForRoute = (to: string, label?: string): ModuleKey | null => {
  // Virtual parents
  if (to === "__attendance__") return "pit_rota"; // attendance is part of pit ops; keep visible if rota allowed
  if (to === "__rota__") return "pit_rota";

  const [base, q = ""] = to.split("?");
  const tab = new URLSearchParams(q).get("tab");

  if (base === "/") return "dashboard";
  if (base === "/pit" && tab === "breaklist") return "pit_breaklist";
  if (base === "/pit") return "pit_rota";
  if (base === "/staff") return "pit_rota";
  if (base === "/tables") return "tables";
  if (base === "/active-players" || base === "/player-statistics") return "pit_active_players";
  if (base === "/player-tracker") return "pit_player_tracker";
  if (base === "/table-tracker") return "table_tracker";
  if (base === "/cage") return "cage";
  if (base === "/expenses") return "expenses";
  if (base === "/players") return "players";
  if (base === "/blacklist") return "blacklist";
  if (base === "/reception") return "reception";
  if (base === "/in-casino") return "in_casino";
  if (base === "/bank-checks") return "bank_checks";
  if (base === "/finance/budget") return "finance_budget";
  if (base === "/finance/cash-count") return "finance_cash_count";
  if (base === "/finance/review") return "finance_review";
  if (base === "/finance/dashboard") return "finance_dashboard";
  if (base === "/finance/expenses") return "expenses";
  if (base === "/finance/summary") return "finance_summary";
  if (base === "/finance/transfers") return "finance_transfers";
  if (base === "/finance/wallets") return "finance_wallets";
  if (base === "/miss-chips") return "miss_chips";
  if (base === "/groups") return "groups";
  if (base === "/reports") return "reports";
  if (base === "/table-results") return "reports";
  if (base === "/import-reports") return "import_reports";
  if (base === "/logs") return "logs";
  if (base === "/admin") return "admin";

  // Label-based fallback (rare)
  if (label === "CCTV") return "cctv";
  return null;
};
