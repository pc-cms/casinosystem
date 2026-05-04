import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CHIP_DENOMS, formatCurrency, formatNumberSpaces, CURRENCIES } from "@/lib/currency";
import { cashSum } from "@/components/cage/CashDenomInput";
import CashCountGrid from "@/components/cage/CashCountGrid";
import {
  emptyMobile, emptyBanks, chipSum, emptyCash, calcGrandTotal,
  type MobileProviders, type Banks,
} from "@/components/cage/CageHelpers";
import { useBatchChipSnapshot, getExpectedChips, getInitialTotal } from "@/hooks/use-chips";
import { getBusinessDate } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface CloseShiftDialogProps {
  open: boolean;
  onClose: () => void;
  shift: Tables<"shifts">;
  expectedBalance: number;
  cashResult: number;
  totalBuyIns: number;
  totalCashouts: number;
  totalExpenses: number;
  openingFloat: number;
  tables: Tables<"gaming_tables">[];
  onConfirm: (data: {
    closingCount: Record<string, unknown>;
    closingCash: Record<string, unknown>;
    notes: string;
    cashResult: number;
    missTotal: number;
    shiftResult: number;
  }) => void;
  loading: boolean;
}

const CloseShiftDialog = ({
  open, onClose, shift, expectedBalance, cashResult, totalBuyIns, totalCashouts,
  totalExpenses, openingFloat, tables, onConfirm, loading,
}: CloseShiftDialogProps) => {
  const [step, setStep] = useState(1);
  const [notes, setNotes] = useState("");
  const [tableReady, setTableReady] = useState<Record<string, boolean>>({});
  const allTablesReady = tables.length === 0 || tables.every(t => tableReady[t.id]);
  const batchSnapshot = useBatchChipSnapshot();

  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  const [cashCounts, setCashCounts] = useState<Record<string, Record<number, number>>>(emptyCash);
  const [bankBal, setBankBal] = useState<Banks>(emptyBanks);
  const [mobileBal, setMobileBal] = useState<MobileProviders>(emptyMobile);

  // Baseline = chips that were in the cage at shift OPEN (carried over from previous day's closing).
  // Tables are NOT included — they are reconciled separately via per-table chip counts.
  const expectedChips = useMemo(() => {
    const opening = (shift?.opening_float as any)?.chips as Record<string, number> | undefined;
    const out: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { out[d] = Number(opening?.[d] ?? opening?.[String(d)] ?? 0); });
    return out;
  }, [shift]);
  const initialTotal = useMemo(
    () => CHIP_DENOMS.reduce((s, d) => s + d * (expectedChips[d] || 0), 0),
    [expectedChips],
  );
  const missPerDenom = useMemo(() => {
    const miss: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { miss[d] = (chipCounts[d] || 0) - (expectedChips[d] || 0); });
    return miss;
  }, [chipCounts, expectedChips]);
  const chipTotal = useMemo(() => chipSum(chipCounts), [chipCounts]);
  const totalMissValue = chipTotal - initialTotal;
  const hasIncident = chipTotal > initialTotal;
  const hasAnyChipCount = Object.values(chipCounts).some(v => v > 0);

  const rates = (shift?.exchange_rates || {}) as Record<string, number>;
  const totalTzs = useMemo(() => calcGrandTotal(chipCounts, cashCounts, bankBal, mobileBal, rates), [chipCounts, cashCounts, bankBal, mobileBal, rates]);
  const diff = totalTzs - expectedBalance;
  const isPerfect = diff === 0;
  const shiftResult = (cashResult || 0) + totalMissValue;

  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const businessDate = serverBusinessDate || getBusinessDate();

  const handleClose = () => {
    if (hasAnyChipCount) {
      const snapRows = CHIP_DENOMS.filter(d => expectedChips[d] > 0 || chipCounts[d] > 0).map(d => ({
        location_type: "closing",
        location_id: null,
        denomination: d,
        expected_quantity: expectedChips[d] || 0,
        actual_quantity: chipCounts[d] || 0,
      }));
      batchSnapshot.mutate({ date: businessDate, counts: snapRows });
    }

    onConfirm({
      closingCount: {
        chips: chipCounts, chip_miss: missPerDenom, chip_miss_total: totalMissValue, chip_incident: hasIncident,
        cash: cashCounts, bank: bankBal, mobile: mobileBal,
        totals: {
          chips_tzs: chipTotal,
          ...Object.fromEntries(CURRENCIES.map(c => [c, cashSum(cashCounts[c] || {})])),
          bank: bankBal, mobile: mobileBal, total_tzs: totalTzs,
        },
      },
      closingCash: {
        expected: expectedBalance, actual: totalTzs, difference: diff,
        cash_result: cashResult, shift_result: shiftResult, table_readiness: tableReady,
      },
      notes: `${notes} | CASH: ${cashResult >= 0 ? "+" : ""}${formatNumberSpaces(cashResult)} | MISS: ${totalMissValue >= 0 ? "+" : ""}${formatNumberSpaces(totalMissValue)} | RESULT: ${shiftResult >= 0 ? "+" : ""}${formatNumberSpaces(shiftResult)} | DIFF: ${diff >= 0 ? "+" : ""}${formatNumberSpaces(diff)} TZS`.trim(),
      cashResult: cashResult,
      missTotal: totalMissValue,
      shiftResult: shiftResult,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setStep(1); onClose(); } }}>
      <DialogContent className="max-w-[1280px] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close Shift — Step {step}/3</DialogTitle></DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Confirm tables restored to base float.</p>
            {tables.map(t => (
              <div key={t.id} className="flex items-center gap-3 cms-panel p-2.5">
                <Checkbox checked={!!tableReady[t.id]} onCheckedChange={c => setTableReady(r => ({ ...r, [t.id]: !!c }))} id={`t-${t.id}`} />
                <label htmlFor={`t-${t.id}`} className="flex-1 cursor-pointer text-sm text-card-foreground">{t.name} <span className="text-xs text-muted-foreground">({t.game})</span></label>
                {tableReady[t.id] && <CheckCircle2 className="w-4 h-4 text-success" />}
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep(2)} disabled={!allTablesReady}>Next →</Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Count chips and cash across the entire casino.</p>
            <CashCountGrid chips={chipCounts} onChipsChange={setChipCounts} cash={cashCounts}
              onCashChange={(cur, v) => setCashCounts(c => ({ ...c, [cur]: v }))} banks={bankBal} onBanksChange={setBankBal}
              mobile={mobileBal} onMobileChange={setMobileBal} chipPlaceholder={expectedChips} rates={rates} />

            {hasAnyChipCount && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Chip Expected</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(initialTotal)}</p></div>
                <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Chip Counted</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(chipTotal)}</p></div>
                <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">MISS</p><p className={`font-mono text-xs font-bold ${totalMissValue === 0 ? "text-success" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</p></div>
              </div>
            )}

            {hasIncident && (
              <div className="p-2 rounded-md bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-bold">INCIDENT: Chips exceed initial total</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Review →</Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className={`cms-panel p-3 text-center ${isPerfect ? "border-success/30" : "border-destructive/30"}`}>
              {isPerfect ? <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1" /> : <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-1" />}
              <p className="text-sm font-medium text-card-foreground">{isPerfect ? "Balanced" : "Mismatch Detected"}</p>
            </div>

            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Cash Flow</p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-muted-foreground">Opening Float</span><span className="text-card-foreground">{formatCurrency(openingFloat || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ IN</span><span className="text-success">+{formatCurrency(totalBuyIns || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">− OUT</span><span className="text-destructive">−{formatCurrency(totalCashouts || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">− Expenses</span><span className="text-warning">−{formatCurrency(totalExpenses || 0)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-bold"><span className="text-card-foreground">= Expected</span><span className="text-card-foreground">{formatCurrency(expectedBalance)}</span></div>
                <div className="flex justify-between"><span className="text-card-foreground">Counted</span><span className="text-card-foreground">{formatCurrency(totalTzs)}</span></div>
                <div className="flex justify-between font-bold"><span className="text-card-foreground">Difference</span><span className={isPerfect ? "text-success" : "text-destructive"}>{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span></div>
              </div>
            </div>

            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Shift Result</p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-muted-foreground">Cash Result (IN − OUT)</span><span className={`${(cashResult || 0) >= 0 ? "text-success" : "text-destructive"}`}>{(cashResult || 0) >= 0 ? "+" : ""}{formatCurrency(cashResult || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Chip MISS</span><span className={`${totalMissValue === 0 ? "text-success" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-bold text-sm"><span className="text-card-foreground">= Shift Result</span><span className={`${shiftResult >= 0 ? "text-success" : "text-destructive"}`}>{shiftResult >= 0 ? "+" : ""}{formatCurrency(shiftResult)}</span></div>
              </div>
            </div>

            {hasIncident && (
              <div className="p-2 rounded-md bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-bold">INCIDENT: Chip total exceeds initial system total</p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Notes</p>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shift notes…" rows={2} />
            </div>
            {!isPerfect && (
              <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mismatch of {formatCurrency(Math.abs(diff))} will be logged.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button variant="destructive" onClick={handleClose} disabled={loading}>{loading ? "Closing…" : "Close Shift"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CloseShiftDialog;
