import { Fragment, KeyboardEvent, useState } from "react";
import { ChevronDown, ChevronRight, Coins, Printer } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import { useCageSlotsHistory, useSlotsCashlessAggByShift, useSlotsClosingTotalsByShift } from "@/hooks/use-cage-slots";
import PrintSlotsShiftDialog from "./PrintSlotsShiftDialog";
import SlotsShiftReportBody from "./SlotsShiftReportBody";

const NORMALIZE_PROVIDER = (k: string): string | null => {
  const v = String(k || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (v.includes("mpesa")) return "MPESA";
  if (v.includes("tigo") || v.includes("tpesa")) return "TIGO";
  if (v.includes("halo") || v.includes("hpesa")) return "HALOTEL";
  if (v.includes("airtel")) return "AIRTEL";
  return null;
};

const CageSlotsHistoryView = () => {
  const { data: shifts = [], isLoading } = useCageSlotsHistory(60);
  const shiftIds = shifts.map(s => s.id);
  const { data: cashlessAgg = {} } = useSlotsCashlessAggByShift(shiftIds);
  const { data: closingTotals = {} } = useSlotsClosingTotalsByShift(shiftIds);
  const [printShiftId, setPrintShiftId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              const ct = closingTotals[s.id];
              const balance = Number(s.balance ?? ct?.shift_balance ?? 0);
              const cdr = Number(s.cash_desk_result ?? s.actual_cage_result ?? 0);
              const cMiss = Number(s.cards_miss || 0);
              const sysRes = Number(s.system_shift_result || 0);
              const slotsRes = Number(s.slots_result || 0);
              // Build per-provider fallback from shift columns (Mpesa/Tigo/Halo/AirTel)
              const providersFromShift: Record<string, { in: number; out: number }> = {};
              const addProv = (raw: Record<string, any> | null | undefined, dir: "in" | "out") => {
                if (!raw || typeof raw !== "object") return;
                Object.entries(raw).forEach(([k, v]) => {
                  const norm = NORMALIZE_PROVIDER(k);
                  if (!norm) return;
                  const pv = (providersFromShift[norm] ||= { in: 0, out: 0 });
                  pv[dir] += Number(v || 0);
                });
              };
              addProv((s as any).cashless_in_providers, "in");
              addProv((s as any).cashless_out_providers, "out");
              const shiftClIn = Object.values(providersFromShift).reduce((a, p) => a + p.in, 0);
              const shiftClOut = Object.values(providersFromShift).reduce((a, p) => a + p.out, 0);

              const txAgg = cashlessAgg[s.id];
              const txIn = txAgg?.in || 0;
              const txOut = txAgg?.out || 0;

              // Prefer live tx aggregation; fall back to shift columns; final fallback closing totals
              const clIn = txIn || shiftClIn || (ct?.cashless_in ?? 0);
              const clOut = txOut || shiftClOut || (ct?.cashless_out ?? 0);
              const clNet = clIn - clOut;
              const isExpanded = expandedId === s.id;
              const toggleExpanded = () => setExpandedId(isExpanded ? null : s.id);
              const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleExpanded();
                }
              };
              return (
                <Fragment key={s.id}>
                <tr
                  className={`border-b border-border/50 hover:bg-accent/30 cursor-pointer ${isExpanded ? "bg-accent/20" : ""}`}
                  onClick={toggleExpanded}
                  onKeyDown={onRowKeyDown}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1">
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      {fmtDate(s.business_date)}
                    </span>
                  </td>
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
                  <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setPrintShiftId(s.id)} className="gap-1 h-7">
                      <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-muted/10 border-b border-border">
                    <td colSpan={14} className="p-3">
                      <SlotsShiftReportBody id={s.id} showHeader={false} compact />
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
      {printShiftId && (
        <PrintSlotsShiftDialog
          open
          shiftId={printShiftId}
          onClose={() => setPrintShiftId(null)}
        />
      )}
    </PageShell>
  );
};

export default CageSlotsHistoryView;
