import { Coins } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function OtherIncomesTab() {
  return (
    <PageShell>
      <PageHeader icon={Coins} title="Other Incomes" subtitle="Non-operational income lines" />
      <PageSection>
        <div className="text-sm text-muted-foreground text-center py-10">
          Coming soon — non-operational income entries will live here.
        </div>
      </PageSection>
    </PageShell>
  );
}
