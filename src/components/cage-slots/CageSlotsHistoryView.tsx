import { useNavigate } from "react-router-dom";
import { Coins, Eye } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import { useCageSlotsHistory } from "@/hooks/use-cage-slots";

const CageSlotsHistoryView = () => {
  const navigate = useNavigate();
  const { data: shifts = [], isLoading } = useCageSlotsHistory(60);

  return (
    <PageShell>
      <PageHeader
        icon={Coins}
        title="Cage Slots · History"
        subtitle="Closed and reviewed slots shifts (read-only)"
        date
      />
      <PageSection title={`Recent shifts (${shifts.length})`}>
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-1.5">Business Day</th>
              <th>Type</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Closed</th>
              <th className="text-right">System</th>
              <th className="text-right">Actual</th>
              <th className="text-right">Difference</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && !isLoading && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-4">·</td></tr>
            )}
            {shifts.map(s => {
              const diff = Number(s.difference_amount || 0);
              return (
                <tr key={s.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-1.5">{fmtDate(s.business_date)}</td>
                  <td className="text-center uppercase">{s.shift_type}</td>
                  <td className="text-center"><Badge variant="outline" className="text-[10px] uppercase">{s.status.replace("_", " ")}</Badge></td>
                  <td className="text-center text-muted-foreground">{fmtDateTime(s.opened_at)}</td>
                  <td className="text-center text-muted-foreground">{s.closed_at ? fmtDateTime(s.closed_at) : "·"}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(s.system_shift_result || 0))}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(s.actual_cage_result || 0))}</td>
                  <td className={`text-right font-mono ${diff < 0 ? "cms-amount-negative" : diff > 0 ? "cms-amount-positive" : ""}`}>
                    {diff > 0 ? "+" : ""}{formatNumberSpaces(diff)}
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/cage-slots/report/${s.id}`)} className="gap-1 h-7">
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PageSection>
    </PageShell>
  );
};

export default CageSlotsHistoryView;
