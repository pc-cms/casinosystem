import { Receipt } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FinanceExpenses } from "@/components/finance/FinanceExpenses";

const FinanceExpensesPage = () => (
  <PageShell>
    <PageHeader
      icon={Receipt}
      title="Finance Expenses"
      subtitle="Office-level expenses by category"
      date
    />
    <FinanceExpenses />
  </PageShell>
);

export default FinanceExpensesPage;
