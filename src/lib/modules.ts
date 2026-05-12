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
  | "pit_dealers"
  | "cage"
  | "cage_view"
  | "tables"
  | "tables_analytics"
  | "table_tracker"
  | "table_results"
  | "players"
  | "blacklist"
  | "reception"
  | "in_casino"
  | "bank_checks"
  | "expenses"
  | "expenses_approvals"
  | "cashless"
  | "finance_dashboard"
  | "finance_wallets"
  | "finance_cash_count"
  | "finance_budget"
  | "finance_review"
  | "finance_transfers"
  | "finance_summary"
  | "finance_payments"
  | "reports"
  | "miss_chips"
  | "business_days"
  | "weekly_bonus"
  | "incidents"
  | "pitbook"
  | "groups"
  | "staff"
  | "staff_employees"
  | "staff_rota"
  | "staff_attendance"
  | "staff_master"
  | "payroll"
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
  { key: "cage", label: "Cage (Cashier)", group: "Operations" },
  { key: "cage_view", label: "Cage View (Read-only)", group: "Operations" },
  { key: "tables", label: "Tables", group: "Operations" },
  { key: "tables_analytics", label: "Table Analytics", group: "Operations" },
  { key: "table_tracker", label: "Table Check", group: "Operations" },
  { key: "table_results", label: "Table Results", group: "Reports" },
  { key: "incidents", label: "Incidents", group: "Operations" },
  { key: "pitbook", label: "Pitbook", group: "Operations" },
  { key: "weekly_bonus", label: "Weekly Bonus", group: "Operations" },
  { key: "business_days", label: "Business Days", group: "Reports" },
  { key: "cashless", label: "Cashless", group: "Operations" },
  { key: "expenses_approvals", label: "Expenses Approvals", group: "Finance" },
  { key: "finance_payments", label: "Finance Payments", group: "Finance" },
  { key: "reception", label: "Reception", group: "Players" },
  { key: "players", label: "Players", group: "Players" },
  { key: "in_casino", label: "Guests", group: "Players" },
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
  { key: "staff_master", label: "Staff Master (HR)", group: "System" },
  { key: "payroll", label: "Payroll", group: "Finance" },
  { key: "cctv", label: "CCTV", group: "System" },
  { key: "admin", label: "Admin Panel", group: "System" },
];

export const MODULE_GROUPS = ["Operations", "Players", "Finance", "Reports", "System"] as const;
