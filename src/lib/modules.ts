/**
 * Module catalog — used by Permission Matrix in admin UI.
 * Each module = a logical area of the app that can be granted/denied per user.
 *
 * IMPORTANT: This is an ALLOW-LIST overlay on top of the user's role.
 * If no rows exist for a user → role defaults apply (no change).
 * If at least one row exists → only modules with can_view=true are visible.
 *
 * RLS still enforced server-side; this only controls UI navigation visibility.
 */
export type ModuleKey =
  | "dashboard"
  | "pit_rota"
  | "pit_breaklist"
  | "pit_attendance"
  | "pit_active_players"
  | "cage"
  | "tables"
  | "table_tracker"
  | "players"
  | "blacklist"
  | "reception"
  | "in_casino"
  | "bank_checks"
  | "expenses"
  | "finance_dashboard"
  | "finance_wallets"
  | "finance_cash_count"
  | "finance_budget"
  | "finance_review"
  | "finance_transfers"
  | "finance_summary"
  | "reports"
  | "miss_chips"
  | "groups"
  | "staff"
  | "logs"
  | "cctv"
  | "import_reports"
  | "admin";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  group: "Operations" | "Players" | "Finance" | "Reports" | "System";
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", group: "Operations" },
  { key: "pit_rota", label: "Rota", group: "Operations" },
  { key: "pit_breaklist", label: "Breaklist", group: "Operations" },
  { key: "pit_attendance", label: "Attendance", group: "Operations" },
  { key: "pit_active_players", label: "Player Statistics", group: "Operations" },
  { key: "cage", label: "Cage", group: "Operations" },
  { key: "tables", label: "Tables", group: "Operations" },
  { key: "table_tracker", label: "Table Check", group: "Operations" },
  { key: "reception", label: "Reception", group: "Players" },
  { key: "players", label: "Players", group: "Players" },
  { key: "in_casino", label: "In Casino", group: "Players" },
  { key: "blacklist", label: "Blacklist", group: "Players" },
  { key: "groups", label: "Groups", group: "Players" },
  { key: "bank_checks", label: "Bank Checks", group: "Finance" },
  { key: "expenses", label: "Expenses", group: "Finance" },
  { key: "finance_dashboard", label: "Finance Dashboard", group: "Finance" },
  { key: "finance_wallets", label: "Wallets", group: "Finance" },
  { key: "finance_cash_count", label: "Cash Count", group: "Finance" },
  { key: "finance_budget", label: "Budget", group: "Finance" },
  { key: "finance_review", label: "Daily Review", group: "Finance" },
  { key: "finance_transfers", label: "Inter-Casino Transfers", group: "Finance" },
  { key: "finance_summary", label: "Finance Summary", group: "Finance" },
  { key: "reports", label: "Reports", group: "Reports" },
  { key: "miss_chips", label: "Miss Chips Report", group: "Reports" },
  { key: "import_reports", label: "Import Reports", group: "Reports" },
  { key: "logs", label: "Activity Logs", group: "Reports" },
  { key: "staff", label: "Staff", group: "System" },
  { key: "cctv", label: "CCTV", group: "System" },
  { key: "admin", label: "Admin Panel", group: "System" },
];

export const MODULE_GROUPS = ["Operations", "Players", "Finance", "Reports", "System"] as const;
