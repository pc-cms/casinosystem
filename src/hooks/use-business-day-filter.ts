import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";

/**
 * Operational role visibility rule:
 * - Pit, Cashier, Reception see ONLY current business day data
 *   (transactions, table/shift closings, visits, player reports).
 * - Manager Access override (session toggle) lifts the restriction.
 * - Manager / Finance Manager / Super Admin / Surveillance / HR are unrestricted.
 *
 * Returns:
 *   { restrictedToToday: true,  businessDate: "YYYY-MM-DD" } when filter must be applied
 *   { restrictedToToday: false, businessDate: null }         when no filter
 */
export function useBusinessDayFilter() {
  const { roles, managerOverride } = useAuth();

  const isOperational =
    roles.includes("pit") ||
    roles.includes("cashier") ||
    roles.includes("reception");

  const isPrivileged =
    roles.includes("manager") ||
    roles.includes("finance_manager") ||
    roles.includes("super_admin") ||
    roles.includes("surveillance") ||
    roles.includes("hr");

  const restrictedToToday =
    isOperational && !isPrivileged && !managerOverride.active;

  return {
    restrictedToToday,
    businessDate: restrictedToToday ? getBusinessDate() : null,
  };
}

/**
 * UI helper: should financial aggregates (IN/OUT/Result, Player Tracker totals)
 * be hidden in the Player Card for the current viewer?
 * Cashier and Reception must NOT see lifetime financial stats.
 * Manager Access override does NOT unlock this — it is a strict role rule.
 */
export function useHidePlayerFinancials(): boolean {
  const { roles } = useAuth();

  const isCashierOrReception =
    roles.includes("cashier") || roles.includes("reception");

  const isPrivileged =
    roles.includes("manager") ||
    roles.includes("finance_manager") ||
    roles.includes("super_admin") ||
    roles.includes("pit");

  return isCashierOrReception && !isPrivileged;
}
