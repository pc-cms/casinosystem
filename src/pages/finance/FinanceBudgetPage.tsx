import { Target } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { BudgetPlanning } from "@/components/finance/BudgetPlanning";

const FinanceBudgetPage = () => (
  <PageShell>
    <PageHeader
      icon={Target}
      title="Budget Planning"
      subtitle="Monthly budget items and break-even point"
      date
    />
    <BudgetPlanning />
  </PageShell>
);

export default FinanceBudgetPage;
