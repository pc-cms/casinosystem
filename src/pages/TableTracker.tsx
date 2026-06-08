import { useState } from "react";
import { getBusinessDate, nowEAT } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { DateNavigator } from "@/components/ui/date-navigator";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Target, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ChipCountPanel } from "@/components/tables/ChipCountPanel";

interface TableTrackerProps { embedded?: boolean }

const TableTracker = ({ embedded = false }: TableTrackerProps) => {
  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const today = serverBusinessDate || getBusinessDate();
  const [date, setDate] = useState(today);
  const { isManager } = useAuth();

  const Wrapper: any = embedded ? "div" : PageShell;
  return (
    <Wrapper>
      {!embedded && (
        <PageHeader
          icon={Target}
          title="Table Check"
          subtitle="Count chips on tables · save snapshot"
          date={isManager ? false : date}
        >
          {isManager ? (
            <DateNavigator
              value={date}
              onChange={(iso) => setDate(iso || today)}
              maxDate={nowEAT()}
            />
          ) : date !== today ? (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-xs font-mono text-muted-foreground hover:bg-muted"
              title="Return to today"
            >
              <Lock className="h-3.5 w-3.5" />
              Today
            </button>
          ) : null}
        </PageHeader>
      )}

      <PageSection card={false}>
        <ChipCountPanel date={date} />
      </PageSection>
    </Wrapper>
  );
};

export default TableTracker;
