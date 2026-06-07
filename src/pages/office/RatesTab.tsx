import { TrendingUp } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function RatesTab() {
  return (
    <PageShell>
      <PageHeader icon={TrendingUp} title="Rates" subtitle="Per-casino daily FX (Office-owned)" />
      <PageSection>
        <div className="text-sm text-muted-foreground text-center py-10">
          Coming soon — daily FX rates per currency, owned by Office. Cage will read from this table.
        </div>
      </PageSection>
    </PageShell>
  );
}
