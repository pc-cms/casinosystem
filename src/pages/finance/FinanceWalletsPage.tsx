import { Wallet } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { WalletsView } from "@/components/finance/WalletsView";

const FinanceWalletsPage = () => (
  <PageShell>
    <PageHeader
      icon={Wallet}
      title="Wallets"
      subtitle="Ledger balances across all wallets"
      date
    />
    <WalletsView />
  </PageShell>
);

export default FinanceWalletsPage;
