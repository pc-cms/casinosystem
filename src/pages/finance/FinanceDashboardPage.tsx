import { Wallet } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";

const FinanceDashboardPage = () => (
  <PageShell>
    <PageHeader
      icon={Wallet}
      title="Finance Dashboard"
      subtitle="Office-level cash flow overview"
      date
    />
    <FinanceDashboard />
  </PageShell>
);

export default FinanceDashboardPage;
