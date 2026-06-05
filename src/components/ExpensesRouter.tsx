import { lazy, Suspense } from "react";

const CashierExpenses = lazy(() => import("@/pages/Expenses"));

/**
 * /expenses is the legacy operational Expenses page for every role.
 * The finance ledger lives separately at /finances/expenses as Monthly Expenses.
 */
export default function ExpensesRouter() {
  return (
    <Suspense fallback={null}>
      <CashierExpenses />
    </Suspense>
  );
}
