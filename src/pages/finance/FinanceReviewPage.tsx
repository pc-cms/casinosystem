import { ClipboardPen } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DailyReview } from "@/components/finance/DailyReview";

const FinanceReviewPage = () => (
  <PageShell>
    <PageHeader
      icon={ClipboardPen}
      title="Daily Review"
      subtitle="Lock the financial period for the business day"
      date
    />
    <DailyReview />
  </PageShell>
);

export default FinanceReviewPage;
