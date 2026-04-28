import { FileBarChart } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SummaryDashboard } from "@/components/finance/SummaryDashboard";

const FinanceSummaryPage = () => (
  <PageShell>
    <PageHeader
      icon={FileBarChart}
      title="Network Summary"
      subtitle="Cross-casino financial overview"
      date
    />
    <SummaryDashboard />
  </PageShell>
);

export default FinanceSummaryPage;
