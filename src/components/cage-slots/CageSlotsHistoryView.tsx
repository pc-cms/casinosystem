import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Eye } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import { useCageSlotsHistory, useSlotsCashlessAggByShift } from "@/hooks/use-cage-slots";

const PROVIDERS = ["MPESA", "TIGO", "HALOTEL", "AIRTEL"] as const;

const CageSlotsHistoryView = () => {
  const navigate = useNavigate();
  const { data: shifts = [], isLoading } = useCageSlotsHistory(60);
  const shiftIds = shifts.map(s => s.id);
  const { data: cashlessAgg = {} } = useSlotsCashlessAggByShift(shiftIds);

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
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-1.5">Business Day</th>
              <th>Type</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Closed</th>
              <th className="text-right">System</th>
              <th className="text-right">Slots Result</th>
              <th className="text-right">Cash Desk Result</th>
              <th className="text-right">Cards Miss</th>
              <th className="text-right">Cashless IN</th>
              <th className="text-right">Cashless OUT</th>
              <th className="text-right">Cashless NET</th>
              <th className="text-right">Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && !isLoading && (
              <tr><td colSpan={14} className="text-center text-muted-foreground py-4">·</td></tr>
            )}
            {shifts.map(s => {
              const balance = Number(s.balance || 0);
              const cdr = Number(s.cash_desk_result ?? s.actual_cage_result ?? 0);
              const cMiss = Number(s.cards_miss || 0);
              const sysRes = Number(s.system_shift_result || 0);
              const slotsRes = Number(s.slots_result || 0);
              const cl = cashlessAgg[s.id];
              const clIn = cl?.in || 0;
              const clOut = cl?.out || 0;
              const clNet = cl?.net || 0;
              return (
                <Fragment key={s.id}>
                <tr key={s.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-1.5">{fmtDate(s.business_date)}</td>
                  <td className="text-center uppercase">{s.shift_type}</td>
                  <td className="text-center"><Badge variant="outline" className="text-[10px] uppercase">{s.status.replace("_", " ")}</Badge></td>
                  <td className="text-center text-muted-foreground">{fmtDateTime(s.opened_at)}</td>
                  <td className="text-center text-muted-foreground">{s.closed_at ? fmtDateTime(s.closed_at) : "·"}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(sysRes)}</td>
                  <td className={`text-right font-mono ${slotsRes < 0 ? "cms-amount-negative" : slotsRes > 0 ? "cms-amount-positive" : ""}`}>
                    {slotsRes > 0 ? "+" : ""}{formatNumberSpaces(slotsRes)}
                  </td>
                  <td className={`text-right font-mono ${cdr < 0 ? "cms-amount-negative" : cdr > 0 ? "cms-amount-positive" : ""}`}>
                    {cdr > 0 ? "+" : ""}{formatNumberSpaces(cdr)}
                  </td>
                  <td className={`text-right font-mono ${cMiss < 0 ? "cms-amount-negative" : ""}`}>
                    {cMiss !== 0 ? (cMiss > 0 ? "+" : "") + formatNumberSpaces(cMiss) : "·"}
                  </td>
                  <td className={`text-right font-mono ${clIn ? "cms-amount-positive" : ""}`}>
                    {clIn ? "+" + formatNumberSpaces(clIn) : "·"}
                  </td>
                  <td className={`text-right font-mono ${clOut ? "cms-amount-negative" : ""}`}>
                    {clOut ? "−" + formatNumberSpaces(clOut) : "·"}
                  </td>
                  <td className={`text-right font-mono ${clNet < 0 ? "cms-amount-negative" : clNet > 0 ? "cms-amount-positive" : ""}`}>
                    {clNet !== 0 ? (clNet > 0 ? "+" : "") + formatNumberSpaces(clNet) : "·"}
                  </td>
                  <td className={`text-right font-mono ${balance < 0 ? "cms-amount-negative" : balance > 0 ? "cms-amount-positive" : ""}`}>
                    {balance > 0 ? "+" : ""}{formatNumberSpaces(balance)}
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/cage-slots/report/${s.id}`)} className="gap-1 h-7">
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </td>
                </tr>
                {cl && (clIn || clOut) && (
                  <tr key={s.id + "-prov"} className="border-b border-border/50 bg-muted/20">
                    <td colSpan={9} className="text-right text-[10px] uppercase tracking-wider text-muted-foreground py-1 pr-2">
                      By provider
                    </td>
                    <td colSpan={5} className="py-1">
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono justify-end">
                        {PROVIDERS.map(p => {
                          const pv = cl.providers[p];
                          if (!pv || (!pv.in && !pv.out)) return null;
                          const net = pv.in - pv.out;
                          return (
                            <span key={p} className="px-1.5 py-0.5 rounded bg-background border border-border">
                              <span className="text-muted-foreground mr-1">{p}</span>
                              {pv.in > 0 && <span className="cms-amount-positive mr-1">+{formatNumberSpaces(pv.in)}</span>}
                              {pv.out > 0 && <span className="cms-amount-negative mr-1">−{formatNumberSpaces(pv.out)}</span>}
                              <span className={net < 0 ? "cms-amount-negative" : net > 0 ? "cms-amount-positive" : ""}>
                                ({net > 0 ? "+" : ""}{formatNumberSpaces(net)})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </PageSection>
    </PageShell>
  );
};

export default CageSlotsHistoryView;
