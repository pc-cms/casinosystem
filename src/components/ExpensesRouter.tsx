import { lazy, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";

const CashierExpenses = lazy(() => import("@/pages/Expenses"));
const FinanceExpenses = lazy(() => import("@/pages/finances/FinancesExpensesPage"));

/**
 * Cashiers / Reception / Pit see the legacy operational Expenses page
 * (current-business-day only, simple entry).
 * Finance Manager / Manager / Super Admin see the full per-casino ledger.
 */
export default function ExpensesRouter() {
  const { roles, managerOverride } = useAuth();
  const isFinance =
    roles.includes("finance_manager") ||
    roles.includes("super_admin") ||
    (roles.includes("manager") && managerOverride.active);
  const Cmp = isFinance ? FinanceExpenses : CashierExpenses;
  return (
    <Suspense fallback={null}>
      <Cmp />
    </Suspense>
  );
}
