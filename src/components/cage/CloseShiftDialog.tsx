import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import { CHIP_DENOMS, formatCurrency, formatChipLabel, formatNumberSpaces, CURRENCIES } from "@/lib/currency";
import { cashSum } from "@/components/cage/CashDenomInput";
import CashCountGrid from "@/components/cage/CashCountGrid";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import {
  emptyMobile, emptyBanks, chipSum, emptyCash, MOBILE_PROVIDERS,
  calcCashTotalTzs, bankTotalTzs, mobileTotal,
  computeMissByDenom, missTotalValue, cashDeskBalance,
  type MobileProviders, type Banks,
} from "@/components/cage/CageHelpers";
import { useBatchChipSnapshot } from "@/hooks/use-chips";
import { getBusinessDate } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { cn } from "@/lib/utils";
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
  externalCashMovement?: number;
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

/**
 * Two-step in-page Close Shift flow:
 *   1. Cashier entry  — counts/notes, no DB write.
 *   2. Manager review — read-only summary, manager password ALWAYS required
 *      (independent of Manager Access toggle). Cancel returns to step 1
 *      with all entered data preserved.
 */
const CloseShiftDialog = ({
  open, onClose, shift, expectedBalance, cashResult, totalBuyIns, totalCashouts,
  totalExpenses, externalCashMovement = 0, openingFloat, tables, onConfirm, loading,
}: CloseShiftDialogProps) => {
  // sessionStorage persistence — survives page refresh while shift is being closed.
  const storageKey = `cms.close-shift.${shift?.id || "none"}`;
  const persisted = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) as {
        step?: "entry" | "review"; notes?: string;
        chipCounts?: Record<number, number>;
        cashCounts?: Record<string, Record<number, number>>;
        bankBal?: Banks; mobileBal?: MobileProviders;
      } : null;
    } catch { return null; }
  }, [storageKey]);

  const [step, setStep] = useState<"entry" | "review">(persisted?.step || "entry");
  const [notes, setNotes] = useState(persisted?.notes || "");
  const [showManagerConfirm, setShowManagerConfirm] = useState(false);
  const batchSnapshot = useBatchChipSnapshot();

  const [chipCounts, setChipCounts] = useState<Record<number, number>>(persisted?.chipCounts || {});
  const [cashCounts, setCashCounts] = useState<Record<string, Record<number, number>>>(persisted?.cashCounts || emptyCash);
  const [bankBal, setBankBal] = useState<Banks>(persisted?.bankBal || emptyBanks);
  const [mobileBal, setMobileBal] = useState<MobileProviders>(persisted?.mobileBal || emptyMobile);

  // Persist on every change.
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        step, notes, chipCounts, cashCounts, bankBal, mobileBal,
      }));
    } catch { /* quota — ignore */ }
  }, [storageKey, step, notes, chipCounts, cashCounts, bankBal, mobileBal]);

  // ── Opening (carried from previous closing) ───────────────────────────────
  const openingChips = useMemo(() => {
    const opening = (shift?.opening_float as any)?.chips as Record<string, number> | undefined;
    const out: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { out[d] = Number(opening?.[d] ?? opening?.[String(d)] ?? 0); });
    return out;
  }, [shift]);
  const openingChipsTzs = useMemo(() => chipSum(openingChips), [openingChips]);
  const openingTotal = openingFloat || 0;
  const openingCashTzs = Math.max(0, openingTotal - openingChipsTzs);

  // ── Tables (must all be closed before cage close) ─────────────────────────
  const openTables = useMemo(() => tables.filter(t => t.status === "open" && !t.is_archived), [tables]);
  const closedTables = useMemo(
    () => tables.filter(t => t.status === "closed" && !t.is_archived),
    [tables],
  );
  const tablesAllClosed = openTables.length === 0;
  const resultTable = useMemo(
    () => closedTables.reduce((s, t) => s + Number(t.closing_result || 0), 0),
    [closedTables],
  );

  // ── Closing chips: per-denom miss ─────────────────────────────────────────
  const missPerDenom = useMemo(
    () => computeMissByDenom(openingChips, chipCounts, CHIP_DENOMS),
    [openingChips, chipCounts],
  );
  const missTotal = useMemo(() => missTotalValue(missPerDenom), [missPerDenom]);
  const closingChipsTzs = useMemo(() => chipSum(chipCounts), [chipCounts]);

  // ── Cash side (cash + mobile + bank, all in TZS) ──────────────────────────
  const rates = (shift?.exchange_rates || {}) as Record<string, number>;
  const closingCashOnlyTzs = useMemo(() => calcCashTotalTzs(cashCounts, rates), [cashCounts, rates]);
  const closingMobileTzs = useMemo(() => mobileTotal(mobileBal), [mobileBal]);
  const closingBankTzs = useMemo(() => bankTotalTzs(bankBal, rates), [bankBal, rates]);
  const closingCashTotalTzs = closingCashOnlyTzs + closingMobileTzs + closingBankTzs;
  const totalTzs = closingChipsTzs + closingCashTotalTzs;

  const balance = useMemo(
    () => cashDeskBalance({
      resultTable,
      openingChips: openingChipsTzs,
      openingCash: openingCashTzs,
      closingChips: closingChipsTzs,
      closingCash: closingCashTotalTzs,
      externalCashMovement,
      expenses: totalExpenses || 0,
    }),
    [resultTable, openingChipsTzs, openingCashTzs, closingChipsTzs, closingCashTotalTzs, externalCashMovement, totalExpenses],
  );
  const isBalanced = balance === 0;
  const requiresNote = !isBalanced;
  const noteValid = !requiresNote || notes.trim().length > 0;

  const diff = totalTzs - expectedBalance;
  const shiftResult = (cashResult || 0) + missTotal;

  const { data: serverBusinessDate } = useEffectiveBusinessDate();
  const businessDate = serverBusinessDate || getBusinessDate();

  const handleManagerConfirmed = (managerId: string) => {
    setShowManagerConfirm(false);

    const hasAnyChipCount = Object.values(chipCounts).some(v => v > 0);
    if (hasAnyChipCount) {
      const snapRows = CHIP_DENOMS.filter(d => openingChips[d] > 0 || chipCounts[d] > 0).map(d => ({
        location_type: "closing",
        location_id: null,
        denomination: d,
        expected_quantity: openingChips[d] || 0,
        actual_quantity: chipCounts[d] || 0,
      }));
      batchSnapshot.mutate({ date: businessDate, counts: snapRows });
    }

    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }

    onConfirm({
      closingCount: {
        chips: chipCounts,
        chip_miss: missPerDenom,
        chip_miss_by_denom: missPerDenom,
        chip_miss_total: missTotal,
        cash: cashCounts,
        bank: bankBal,
        mobile: mobileBal,
        result_table: resultTable,
        cash_desk_balance: balance,
        manager_confirmed_by: managerId,
        totals: {
          chips_tzs: closingChipsTzs,
          ...Object.fromEntries(CURRENCIES.map(c => [c, cashSum(cashCounts[c] || {})])),
          bank: bankBal,
          mobile: mobileBal,
          total_tzs: totalTzs,
        },
      },
      closingCash: {
        expected: expectedBalance,
        actual: totalTzs,
        difference: diff,
        cash_result: cashResult,
        shift_result: shiftResult,
        result_table: resultTable,
        cash_desk_balance: balance,
      },
      notes: `${notes} | TABLES: ${resultTable >= 0 ? "+" : ""}${formatNumberSpaces(resultTable)} | MISS: ${missTotal >= 0 ? "+" : ""}${formatNumberSpaces(missTotal)} | BALANCE: ${balance >= 0 ? "+" : ""}${formatNumberSpaces(balance)} TZS | mgr:${managerId}`.trim(),
      cashResult,
      missTotal,
      shiftResult,
    });
  };

  // Per-currency cash totals for the review (skip currencies with zero)
  const cashByCurrency = useMemo(
    () => CURRENCIES.map(c => ({ cur: c, total: cashSum(cashCounts[c] || {}) })).filter(x => x.total > 0),
    [cashCounts],
  );
  const mobileByProvider = useMemo(
    () => MOBILE_PROVIDERS.map(p => ({ p, v: mobileBal[p] || 0 })).filter(x => x.v > 0),
    [mobileBal],
  );
  const banksNonZero = useMemo(() => {
    const out: Array<{ k: string; v: number }> = [];
    if ((bankBal.tzs || 0) > 0) out.push({ k: "Bank TZS", v: bankBal.tzs });
    if ((bankBal.usd || 0) > 0) out.push({ k: "Bank USD", v: bankBal.usd });
    return out;
  }, [bankBal]);

  if (!open) return null;

  // ===================== STEP 2: MANAGER REVIEW ==========================
  if (step === "review") {
    return (
      <>
        <div className="space-y-4">
          <section className="cms-panel p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-medium">
                Manager Review — verify against the physical cash desk
              </p>
              <span className="text-[10px] text-muted-foreground">Shift entered by cashier · awaiting manager</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: liquidity breakdown */}
              <div className="space-y-1 text-xs font-mono">
                <RowKV label="Chips" value={`${formatNumberSpaces(closingChipsTzs)} TZS`} />
                {cashByCurrency.length === 0
                  ? <RowKV label="Cash" value="·" muted />
                  : cashByCurrency.map(r => (
                      <RowKV key={r.cur} label={`Cash · ${r.cur}`} value={formatNumberSpaces(r.total)} />
                    ))}
                {mobileByProvider.map(r => (
                  <RowKV key={r.p} label={`Mobile · ${r.p}`} value={`${formatNumberSpaces(r.v)} TZS`} />
                ))}
                {banksNonZero.map(r => (
                  <RowKV key={r.k} label={r.k} value={formatNumberSpaces(r.v)} />
                ))}
                <div className="flex justify-between pt-2 mt-1 border-t border-border text-sm font-bold">
                  <span className="text-card-foreground">Cash Desk Total</span>
                  <span className="text-card-foreground">{formatNumberSpaces(totalTzs)} TZS</span>
                </div>
              </div>

              {/* Right: balance formula recap */}
              <div className="space-y-1 text-xs font-mono">
                <RowKV label="Opening (Chips + Cash)" value={`−${formatNumberSpaces(openingTotal)}`} />
                <RowKV label="Result Table" value={`${resultTable >= 0 ? "+" : ""}${formatNumberSpaces(resultTable)}`} amountClass={resultTable >= 0 ? "cms-amount-positive" : "cms-amount-negative"} />
                <RowKV label="Miss Total" value={`${missTotal >= 0 ? "+" : ""}${formatNumberSpaces(missTotal)}`} amountClass={missTotal === 0 ? undefined : missTotal > 0 ? "cms-amount-positive" : "cms-amount-negative"} />
                <RowKV label="Expenses (cash)" value={`+${formatNumberSpaces(totalExpenses || 0)}`} />
                <RowKV label="External Cash Movement" value={`−${formatNumberSpaces(externalCashMovement)}`} />
                <div className={cn(
                  "flex justify-between pt-2 mt-1 border-t-2 text-sm font-bold",
                  isBalanced ? "border-success/60" : "border-destructive/60",
                )}>
                  <span className="text-card-foreground inline-flex items-center gap-1.5">
                    {isBalanced
                      ? <CheckCircle2 className="w-4 h-4 text-success" />
                      : <AlertTriangle className="w-4 h-4 text-destructive" />}
                    Cash Desk Balance
                  </span>
                  <span className={isBalanced ? "text-success" : balance > 0 ? "cms-amount-positive" : "cms-amount-negative"}>
                    {balance >= 0 ? "+" : ""}{formatNumberSpaces(balance)} TZS
                  </span>
                </div>
                {!isBalanced && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3 h-3" />
                    Discrepancy — manager password required to accept.
                  </p>
                )}
              </div>
            </div>

            {notes && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cashier Notes</p>
                <p className="text-xs whitespace-pre-wrap text-card-foreground">{notes}</p>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setStep("entry")} disabled={loading} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back to Edit
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant={isBalanced ? "default" : "destructive"}
                onClick={() => setShowManagerConfirm(true)}
                disabled={loading}
                className="gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                {loading ? "Closing…" : "Confirm & Enter Manager Password"}
              </Button>
            </div>
          </div>
        </div>

        <ManagerOverrideDialog
          open={showManagerConfirm}
          onClose={() => setShowManagerConfirm(false)}
          onConfirm={handleManagerConfirmed}
          title="Manager Confirmation — Close Shift"
          description={
            isBalanced
              ? "Confirm cash desk closing. Balance is zero."
              : `Balance is ${balance >= 0 ? "+" : ""}${formatNumberSpaces(balance)} TZS (${balance > 0 ? "surplus" : "shortage"}). Manager approval required.`
          }
          actionType="CAGE_SHIFT_CLOSE"
          actionDetails={{
            shift_id: shift.id,
            result_table: resultTable,
            cash_desk_total: totalTzs,
            opening_total: openingTotal,
            miss_total: missTotal,
            cash_desk_balance: balance,
          }}
        />
      </>
    );
  }

  // ===================== STEP 1: CASHIER ENTRY ==========================
  return (
    <div className="space-y-4">
      {!tablesAllClosed && (
        <div className="cms-panel p-3 flex items-center gap-2 text-xs text-destructive">
          <Lock className="w-3.5 h-3.5" />
          Waiting for Pit to close all tables ({openTables.length} open) — required before shift close.
        </div>
      )}

      {/* Tables */}
      <section className="cms-panel p-3">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-medium mb-2">Tables Result</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-2 py-1 text-muted-foreground font-medium">Table</th>
                <th className="text-left px-2 py-1 text-muted-foreground font-medium">Game</th>
                <th className="text-left px-2 py-1 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-2 py-1 text-muted-foreground font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {tables.filter(t => !t.is_archived).map(t => {
                const isOpen = t.status === "open";
                const r = Number(t.closing_result || 0);
                return (
                  <tr key={t.id} className="border-b border-border/40">
                    <td className="px-2 py-1 text-card-foreground">{t.name}</td>
                    <td className="px-2 py-1 text-muted-foreground">{t.game}</td>
                    <td className="px-2 py-1">
                      {isOpen
                        ? <span className="text-destructive">OPEN</span>
                        : <span className="text-success inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> CLOSED</span>}
                    </td>
                    <td className={cn(
                      "px-2 py-1 text-right",
                      isOpen ? "text-muted-foreground" :
                        r > 0 ? "cms-amount-positive" : r < 0 ? "cms-amount-negative" : "text-muted-foreground",
                    )}>
                      {isOpen ? "·" : `${r >= 0 ? "+" : ""}${formatNumberSpaces(r)}`}
                    </td>
                  </tr>
                );
              })}
              {tables.filter(t => !t.is_archived).length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-3">No tables</td></tr>
              )}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td colSpan={3} className="px-2 py-1.5 font-semibold text-card-foreground">Total Result Table</td>
                <td className={cn(
                  "px-2 py-1.5 text-right font-bold",
                  resultTable > 0 ? "cms-amount-positive" : resultTable < 0 ? "cms-amount-negative" : "text-card-foreground",
                )}>
                  {resultTable >= 0 ? "+" : ""}{formatNumberSpaces(resultTable)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Chips per denom */}
      <section className="cms-panel p-3">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-medium mb-2">
          Cash Desk · Chips (per denomination)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-2 py-1 text-muted-foreground font-medium">Denom</th>
                <th className="text-right px-2 py-1 text-muted-foreground font-medium">Open (qty)</th>
                <th className="text-right px-2 py-1 text-muted-foreground font-medium">Close (qty)</th>
                <th className="text-right px-2 py-1 text-muted-foreground font-medium">Miss (qty)</th>
                <th className="text-right px-2 py-1 text-muted-foreground font-medium">Miss (TZS)</th>
              </tr>
            </thead>
            <tbody>
              {CHIP_DENOMS.map(d => {
                const op = openingChips[d] || 0;
                const cl = chipCounts[d] || 0;
                const mq = missPerDenom[d] || 0;
                const mv = mq * d;
                const colorCls = mq > 0 ? "cms-amount-positive" : mq < 0 ? "cms-amount-negative" : "text-muted-foreground";
                return (
                  <tr key={d} className="border-b border-border/30">
                    <td className="px-2 py-1 text-card-foreground">{formatChipLabel(d)}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{op || "·"}</td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        value={cl || ""}
                        onChange={e => setChipCounts(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                        placeholder={op ? String(op) : "0"}
                        className="no-spin h-6 w-20 font-mono text-xs text-right px-1.5 bg-background border border-border rounded"
                      />
                    </td>
                    <td className={cn("px-2 py-1 text-right font-semibold", colorCls)}>
                      {mq === 0 ? "·" : `${mq > 0 ? "+" : ""}${mq}`}
                    </td>
                    <td className={cn("px-2 py-1 text-right", colorCls)}>
                      {mv === 0 ? "·" : `${mv > 0 ? "+" : ""}${formatNumberSpaces(mv)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td className="px-2 py-1.5 font-semibold text-card-foreground" colSpan={4}>MISS TOTAL</td>
                <td className={cn(
                  "px-2 py-1.5 text-right font-bold",
                  missTotal > 0 ? "cms-amount-positive" : missTotal < 0 ? "cms-amount-negative" : "text-card-foreground",
                )}>
                  {missTotal >= 0 ? "+" : ""}{formatNumberSpaces(missTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Cash + Mobile + Bank */}
      <section className="cms-panel p-3">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-medium mb-2">
          Cash Desk · Cash + Mobile + Bank
        </p>
        <CashCountGrid
          chips={chipCounts}
          onChipsChange={setChipCounts}
          cash={cashCounts}
          onCashChange={(cur, v) => setCashCounts(c => ({ ...c, [cur]: v }))}
          banks={bankBal}
          onBanksChange={setBankBal}
          mobile={mobileBal}
          onMobileChange={setMobileBal}
          chipPlaceholder={openingChips}
          rates={rates}
        />
        <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-border">
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Chips</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingChipsTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Cash</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingCashOnlyTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Mobile</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingMobileTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Bank</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingBankTzs)}</p></div>
        </div>
      </section>

      {/* Balance preview */}
      <section className={cn(
        "cms-panel p-4 border-2",
        isBalanced ? "border-success/50" : "border-destructive/50",
      )}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Cash Desk Balance</p>
          {isBalanced
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="w-4 h-4" /> Balanced</span>
            : <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="w-4 h-4" /> {balance > 0 ? "Surplus" : "Shortage"}</span>}
        </div>
        <div className="space-y-1 text-sm font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">  Closing (Chips + Cash + Mobile + Bank)</span><span className="text-card-foreground">+{formatNumberSpaces(totalTzs)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">− Opening (Chips + Cash)</span><span className="text-card-foreground">−{formatNumberSpaces(openingTotal)}</span></div>
          <div className="flex justify-between pt-2"><span className="text-muted-foreground">− Result Table</span><span className="text-card-foreground">−{formatNumberSpaces(resultTable)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">− External Cash Movement</span><span className="text-card-foreground">−{formatNumberSpaces(externalCashMovement)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">+ Expenses (paid from cash)</span><span className="text-card-foreground">+{formatNumberSpaces(totalExpenses || 0)}</span></div>
          <div className="flex justify-between border-t border-border pt-2 mt-2 text-base font-bold">
            <span className="text-card-foreground">= Cash Desk Balance</span>
            <span className={isBalanced ? "text-success" : balance > 0 ? "cms-amount-positive" : "cms-amount-negative"}>
              {balance >= 0 ? "+" : ""}{formatNumberSpaces(balance)} TZS
            </span>
          </div>
        </div>
      </section>

      {/* Notes */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
          Notes {requiresNote && <span className="text-destructive">*</span>}
        </p>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={requiresNote ? "Required: explain the discrepancy…" : "Optional shift notes…"}
          rows={2}
          className={requiresNote && !noteValid ? "border-destructive" : ""}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          variant={isBalanced ? "default" : "destructive"}
          onClick={() => { if (tablesAllClosed && noteValid) setStep("review"); }}
          disabled={loading || !tablesAllClosed || !noteValid}
          className="gap-1.5"
        >
          <ShieldAlert className="w-4 h-4" />
          Continue to Manager Review
        </Button>
      </div>
    </div>
  );
};

const RowKV = ({
  label, value, muted, amountClass,
}: { label: string; value: string; muted?: boolean; amountClass?: string }) => (
  <div className="flex justify-between border-b border-border/30 py-1">
    <span className={muted ? "text-muted-foreground/60" : "text-muted-foreground"}>{label}</span>
    <span className={amountClass ?? "text-card-foreground"}>{value}</span>
  </div>
);

export default CloseShiftDialog;
