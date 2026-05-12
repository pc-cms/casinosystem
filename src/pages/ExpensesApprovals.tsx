/**
 * Expenses approval queue.
 *
 * Distinct from `/expenses` (cashier-facing creation surface).
 * Module: `expenses_approvals`.
 *
 * Phase 1: renders the existing Expenses page with a focused header. The
 * Approve/Delete actions inside Expenses already gate on `isManager`, which
 * includes Manager, Floor Manager, and Manager Override. Phase 2 will split
 * the underlying component to show only pending rows + approval controls.
 */
import Expenses from "./Expenses";

const ExpensesApprovals = () => <Expenses />;

export default ExpensesApprovals;
