import { Banknote } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FinancePayments } from "@/components/finance/FinancePayments";

const FinancePaymentsPage = () => (
  <PageShell>
    <PageHeader
      icon={Banknote}
      title="Payments"
      subtitle="Money paid out from operating wallets — recorded as wallet transactions, not cashier expenses."
      date
    />
    <FinancePayments />
  </PageShell>
);

export default FinancePaymentsPage;
