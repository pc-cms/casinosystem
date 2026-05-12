/**
 * Map sidebar nav routes (and route paths) → ModuleKey for the Permission Matrix.
 *
 * Single source of truth for both:
 *   - Sidebar visibility (AppSidebar filters NAV_ITEMS through this map)
 *   - Route guard (App.tsx RoleGuard checks the matrix via this map)
 *
 * Conventions:
 *   - Returns null only for genuinely auxiliary routes that should NOT be
 *     gated (e.g. virtual placeholders without a real screen).
 *   - When in doubt, map to the closest ModuleKey — never leave a real
 *     screen ungated, otherwise floor_manager / custom roles will see it
 *     even if the matrix excludes it.
 */
import type { ModuleKey } from "@/lib/modules";

export const moduleKeyForRoute = (to: string, label?: string): ModuleKey | null => {
  // Virtual sidebar parents (group expanders) — gated by their primary module
  if (to === "__attendance__") return "pit_attendance";
  if (to === "__rota__") return "pit_rota";

  const [base, q = ""] = to.split("?");
  const tab = new URLSearchParams(q).get("tab");

  // ============= OVERVIEW =============
  if (base === "/") return "dashboard";

  // ============= PIT =============
  if (base === "/pit") {
    if (tab === "breaklist") return "pit_breaklist";
    if (tab === "attendance") return "pit_attendance";
    if (tab === "employee") return "staff";
    if (tab === "rota") return "pit_rota";
    return "pit_rota"; // default Pit landing
  }

  // ============= STAFF / FLOOR =============
  if (base === "/staff/master") return "staff_master";
  if (base === "/staff" || base === "/floor") {
    if (tab === "attendance") return "pit_attendance";
    if (tab === "employee") return "staff";
    // rota_floor / rota_security / rota_office and default
    return "staff";
  }

  // ============= PAYROLL =============
  if (base === "/payroll" || base.startsWith("/payroll/")) return "payroll";

  // ============= TABLES & TRACKERS =============
  if (base === "/tables") return "tables";
  if (base === "/tables/close") return "tables";
  if (base === "/tables/analytics") return "tables_analytics";
  if (base === "/table-tracker") return "table_tracker";
  if (base === "/table-results") return "table_results";

  // ============= PLAYERS =============
  if (base === "/active-players" || base === "/player-statistics") return "pit_active_players";
  if (base === "/player-tracker") return "pit_active_players";
  if (base === "/players" || base.startsWith("/players/")) return "players";
  if (base === "/blacklist") return "blacklist";
  if (base === "/reception") return "reception";
  if (base === "/guests") return "in_casino";
  if (base === "/groups") return "groups";

  // ============= CAGE =============
  // /cage = cashier transactional surface; /cage/view = read-only history.
  if (base === "/cage") return "cage";
  if (base === "/cage/view") return "cage_view";
  if (base === "/cage/closings") return "cage";
  if (base === "/cage/close-shift") return "cage";
  if (base.startsWith("/cage/shift/")) return "cage";

  // ============= EXPENSES / CASHLESS =============
  if (base === "/expenses") return "expenses";
  if (base === "/expenses/approvals") return "expenses_approvals";
  if (base === "/cashless") return "cashless";

  // (expenses/cashless mapped above)

  // ============= FINANCE =============
  if (base === "/bank-checks") return "bank_checks";
  if (base === "/finance/budget") return "finance_budget";
  if (base === "/finance/cash-count") return "finance_cash_count";
  if (base === "/finance/review") return "finance_review";
  if (base === "/finance/dashboard") return "finance_dashboard";
  if (base === "/finance/expenses" || base === "/finance/payments") return "finance_payments";
  if (base === "/finance/summary") return "finance_summary";
  if (base === "/finance/transfers") return "finance_transfers";
  if (base === "/finance/wallets") return "finance_wallets";

  // ============= REPORTS =============
  if (base === "/miss-chips") return "miss_chips";
  if (base === "/reports") return "reports";
  if (base === "/business-days") return "business_days";
  if (base === "/weekly-bonus") return "weekly_bonus";

  // ============= PIT EXTRAS =============
  if (base === "/pitbook") return "pitbook";
  if (base === "/incidents") return "incidents";

  // ============= SYSTEM =============
  if (base === "/import-reports") return "import_reports";
  if (base === "/logs") return "logs";
  if (base === "/admin" || base.startsWith("/admin/")) return "admin";

  // Label-based fallback (rare)
  if (label === "CCTV") return "cctv";

  // Unknown route — leave ungated. Add an entry above when introducing a new screen.
  return null;
};
