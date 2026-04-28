import { Coins } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CashCount } from "@/components/finance/CashCount";

const FinanceCashCountPage = () => (
  <PageShell>
    <PageHeader
      icon={Coins}
      title="Cash Count"
      subtitle="Physical money reconciliation across all sources"
      date
    />
    <CashCount />
  </PageShell>
);

export default FinanceCashCountPage;
