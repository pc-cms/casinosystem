// Role-based data visibility configuration
// Controls what financial/sensitive data each role can see

type AppRole = "cashier" | "pit" | "manager" | "reception" | "finance_manager" | "security" | "super_admin";

export type FinancialScope = "all" | "shift" | "none";

/**
 * Determines the financial data visibility scope for a user based on their roles.
 * - "all": Can see all historical financial data (manager, finance_manager, security)
 * - "shift": Can see only current shift/day data (cashier, pit)  
 * - "none": Cannot see any financial data (reception)
 */
export const getFinancialScope = (roles: string[]): FinancialScope => {
  if (roles.includes("manager") || roles.includes("finance_manager") || roles.includes("security") || roles.includes("super_admin")) {
    return "all";
  }
  if (roles.includes("cashier") || roles.includes("pit")) {
    return "shift";
  }
  return "none";
};

/**
 * Whether the user can see player financial details (drop, cashout, result).
 */
export const canSeePlayerFinancials = (roles: string[]): boolean => {
  return getFinancialScope(roles) !== "none";
};

/**
 * Whether the user can see all-time historical data vs only current shift.
 */
export const canSeeAllTimeData = (roles: string[]): boolean => {
  return getFinancialScope(roles) === "all";
};
