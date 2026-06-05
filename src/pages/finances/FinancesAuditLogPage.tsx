import { ClipboardList } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFinAuditLog } from "@/hooks/use-fin";
import { fmtDateTime } from "@/lib/format-date";

export default function FinancesAuditLogPage() {
  const { data: rows = [] } = useFinAuditLog();
  return (
    <PageShell>
      <PageHeader icon={ClipboardList} title="Audit Log" subtitle="365-day retention · auto-purged daily" />
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-auto max-h-[75vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="text-left">Action</th>
                <th className="text-left">Entity</th>
                <th className="text-left">Entity ID</th>
                <th className="text-left">Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-1.5 font-mono">{fmtDateTime(r.created_at)}</td>
                  <td>{r.action}</td>
                  <td>{r.entity_table}</td>
                  <td className="font-mono text-[10px] text-muted-foreground">{r.entity_id?.slice(0, 8)}</td>
                  <td className="font-mono text-[10px] text-muted-foreground">{r.actor?.slice(0, 8)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No audit entries yet</td></tr>}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
