import { Upload } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import InterCasinoTransfers from "@/components/finance/InterCasinoTransfers";

const FinanceTransfersPage = () => (
  <PageShell>
    <PageHeader
      icon={Upload}
      title="Inter-Casino Transfers"
      subtitle="Dual-confirmation transfers between locations"
      date
    />
    <InterCasinoTransfers />
  </PageShell>
);

export default FinanceTransfersPage;
