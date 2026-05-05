/**
 * CloseTablesPage — full-page route for the Pit "Close Tables" wizard.
 * Replaces the modal version on `/tables` for the primary flow.
 */
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { CloseTableWizard } from "@/components/tables/CloseTableWizard";
import { useGamingTables } from "@/hooks/use-casino-data";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { getBusinessDate } from "@/lib/business-day";
import { useReadOnlyMode } from "@/hooks/use-readonly-mode";

export default function CloseTablesPage() {
  const nav = useNavigate();
  const { data: tables = [] } = useGamingTables();
  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const date = serverBusinessDate || getBusinessDate();
  const isReadOnly = useReadOnlyMode();

  return (
    <PageShell>
      <PageHeader title={isReadOnly ? "Closing Check" : "Close Tables"} subtitle={`Business day · ${date}`}>
        <Button variant="ghost" size="sm" onClick={() => nav("/tables")} className="gap-1.5">
          <X className="w-4 h-4" /> Cancel
        </Button>
      </PageHeader>
      <CloseTableWizard
        asPage
        open
        onClose={() => nav("/tables")}
        tables={tables as any}
        date={date}
        readOnly={isReadOnly}
      />
    </PageShell>
  );
}
