import { Upload } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFinExcelImports } from "@/hooks/use-fin";
import { fmtDateTime } from "@/lib/format-date";

export default function FinancesExcelImportPage() {
  const { data: imports = [] } = useFinExcelImports();

  return (
    <PageShell>
      <PageHeader icon={Upload} title="Excel Import" subtitle="Upload historical budgets and expenses" />
      <PageSection title="Workflow">
        <ol className="list-decimal pl-5 text-sm space-y-1 text-muted-foreground">
          <li>Upload your old Excel file (.xlsx / .csv)</li>
          <li>System extracts rows into raw_data; AI suggests column mapping</li>
          <li>Review the proposed mapping; confirm or override</li>
          <li>Apply → rows imported into <code>fin_budget</code> or <code>expenses</code></li>
        </ol>
        <div className="mt-3 text-xs text-muted-foreground italic">Upload UI is connected to <code>fin-excel-import</code> edge function (coming online). For now, you can ping me with the file and I'll review + map.</div>
      </PageSection>
      <PageSection title="Recent imports">
        {!imports.length && <div className="text-sm text-muted-foreground text-center py-4">No imports yet</div>}
        {imports.map((i: any) => (
          <div key={i.id} className="flex justify-between border-b border-border py-1.5 text-sm">
            <span>{i.filename}</span>
            <span className="text-xs text-muted-foreground">{i.target_kind} · {i.status} · {fmtDateTime(i.created_at)}</span>
          </div>
        ))}
      </PageSection>
    </PageShell>
  );
}
