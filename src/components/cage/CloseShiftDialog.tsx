import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import { CHIP_DENOMS, formatCurrency, formatChipLabel, formatNumberSpaces, formatCashDenomLabel, CURRENCIES, CASH_DENOMS, CURRENCY_SYMBOLS } from "@/lib/currency";
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

  // Shift Balance — pure asset accounting:
  //   Tables Result = ΔCash + ΔChips + Expenses
  //   ⇒ Balance = Tables Result − CashDelta − MissChips − Expenses  (must be 0)
  // CashDelta = counted closing money (cash + mobile + bank, TZS) − opening cash.
  // MissChips is signed (negative = chips lost). Expenses are physically out of the till.
  const cashDelta = useMemo(
    () => closingCashTotalTzs - openingCashTzs,
    [closingCashTotalTzs, openingCashTzs],
  );
  const balance = useMemo(
    () => resultTable - cashDelta - missTotal - totalExpenses,
    [resultTable, cashDelta, missTotal, totalExpenses],
  );
  const isBalanced = balance === 0;
  const requiresNote = !isBalanced;
  const noteValid = !requiresNote || notes.trim().length > 0;

  // Money Result — net cash from player transactions (buy/in − cashout).
  const moneyResult = cashResult;
  // Shift Result = Tables Result (real chip-based P&L of the shift).
  const shiftResult = resultTable;

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
        difference: balance,
        cash_delta: cashDelta,
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

  // ── Per-denomination breakdowns for the manager review ───────────────────
  const chipsNonZero = useMemo(
    () => CHIP_DENOMS.filter(d => (chipCounts[d] || 0) > 0 || (openingChips[d] || 0) > 0),
    [chipCounts, openingChips],
  );
  const cashByCurrencyDenoms = useMemo(
    () => CURRENCIES.map(cur => {
      const denoms = (CASH_DENOMS[cur] || []).filter(d => (cashCounts[cur]?.[d] || 0) > 0);
      const total = cashSum(cashCounts[cur] || {});
      return { cur, denoms, total };
    }).filter(x => x.total > 0),
    [cashCounts],
  );
  const mobileByProvider = useMemo(
    () => MOBILE_PROVIDERS.map(p => ({ p, v: mobileBal[p] || 0 })).filter(x => x.v > 0),
    [mobileBal],
  );
  const banksNonZero = useMemo(() => {
    const out: Array<{ k: string; v: number; tzs: number }> = [];
    if ((bankBal.tzs || 0) > 0) out.push({ k: "TZS", v: bankBal.tzs, tzs: bankBal.tzs });
    if ((bankBal.usd || 0) > 0) out.push({ k: "USD", v: bankBal.usd, tzs: (bankBal.usd || 0) * (rates["USD"] || 0) });
    return out;
  }, [bankBal, rates]);

  if (!open) return null;

  // ===================== STEP 2: MANAGER REVIEW ==========================
  if (step === "review") {
    return (
      <>
        <div className="space-y-4">
          <section className="cms-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wider font-semibold">
                  Manager Review — verify against the physical cash desk
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Shift entered by cashier · awaiting manager confirmation</p>
              </div>
              <span className="cms-chip text-[10px] bg-muted text-foreground">Read-only</span>
            </div>

            {/* CHIPS per denomination */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Chips · per denomination</p>
                <span className="font-mono text-base font-bold text-card-foreground">{formatNumberSpaces(closingChipsTzs)} TZS</span>
              </div>
              {chipsNonZero.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No chips counted.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 font-mono text-sm">
                  {chipsNonZero.map(d => {
                    const qty = chipCounts[d] || 0;
                    const op = openingChips[d] || 0;
                    const miss = qty - op;
                    const val = qty * d;
                    return (
                      <div key={d} className="flex items-center justify-between border-b border-border/40 py-1.5">
                        <span className="cms-chip text-[10px] bg-muted text-foreground w-14 justify-center shrink-0">{formatChipLabel(d)}</span>
                        <div className="text-right">
                          <div className="text-card-foreground font-semibold">× {qty}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatNumberSpaces(val)}
                            {miss !== 0 && (
                              <span className={cn("ml-1.5", miss > 0 ? "cms-amount-positive" : "cms-amount-negative")}>
                                ({miss > 0 ? "+" : ""}{miss})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CASH per currency, per denomination */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Cash · per currency &amp; denomination</p>
                <span className="font-mono text-base font-bold text-card-foreground">{formatNumberSpaces(closingCashOnlyTzs)} TZS</span>
              </div>
              {cashByCurrencyDenoms.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No cash counted.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cashByCurrencyDenoms.map(({ cur, denoms, total }) => (
                    <div key={cur} className="rounded-lg border border-border bg-background/40 p-3">
                      <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-border">
                        <span className="cms-chip text-[10px] bg-primary/10 text-primary font-semibold">{cur}</span>
                        <span className="font-mono text-sm font-bold text-card-foreground">
                          {CURRENCY_SYMBOLS[cur] || cur} {formatNumberSpaces(total)}
                        </span>
                      </div>
                      <div className="space-y-0.5 font-mono text-xs">
                        {denoms.map(d => {
                          const qty = cashCounts[cur]?.[d] || 0;
                          return (
                            <div key={d} className="flex items-center justify-between">
                              <span className="text-muted-foreground">{formatCashDenomLabel(d, cur)}</span>
                              <span className="text-card-foreground">
                                × {qty} <span className="text-muted-foreground">= {formatNumberSpaces(qty * d)}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {cur !== "TZS" && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/50 flex justify-between text-[10px] text-muted-foreground font-mono">
                          <span>≈ TZS</span>
                          <span>{formatNumberSpaces(total * (rates[cur] || 0))}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MOBILE + BANKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Mobile Money</p>
                  <span className="font-mono text-sm font-bold text-card-foreground">{formatNumberSpaces(closingMobileTzs)} TZS</span>
                </div>
                {mobileByProvider.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No mobile money.</p>
                ) : (
                  <div className="space-y-0.5 font-mono text-xs">
                    {mobileByProvider.map(({ p, v }) => (
                      <div key={p} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{p}</span>
                        <span className="text-card-foreground">{formatNumberSpaces(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Banks</p>
                  <span className="font-mono text-sm font-bold text-card-foreground">{formatNumberSpaces(closingBankTzs)} TZS</span>
                </div>
                {banksNonZero.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No bank balances.</p>
                ) : (
                  <div className="space-y-0.5 font-mono text-xs">
                    {banksNonZero.map(b => (
                      <div key={b.k} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{b.k}</span>
                        <span className="text-card-foreground">
                          {formatNumberSpaces(b.v)}
                          {b.k !== "TZS" && <span className="text-muted-foreground/60"> ≈ {formatNumberSpaces(b.tzs)} TZS</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TOTAL — large block summary */}
            <div className="rounded-lg border-2 border-border bg-muted/30 p-4 mb-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <BlockTotal label="Chips" value={closingChipsTzs} />
                <BlockTotal label="Cash" value={closingCashOnlyTzs} />
                <BlockTotal label="Mobile" value={closingMobileTzs} />
                <BlockTotal label="Bank" value={closingBankTzs} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t-2 border-border">
                <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Cash Desk Total</span>
                <span className="font-mono text-2xl font-bold text-card-foreground">
                  {formatNumberSpaces(totalTzs)} <span className="text-base text-muted-foreground">TZS</span>
                </span>
              </div>
            </div>

            {/* BALANCE FORMULA — cash-only reconciliation */}
            <div className={cn(
              "rounded-lg border-2 p-4",
              isBalanced ? "border-success/60 bg-success/5" : "border-destructive/60 bg-destructive/5",
            )}>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
                Cash Desk Balance — cash only (chips tracked as Miss)
              </p>
              <div className="space-y-1.5 font-mono text-sm">
                <FormulaRow label="Closing Cash (Cash + Mobile + Bank)" value={`+${formatNumberSpaces(closingCashTotalTzs)}`} />
                <FormulaRow label="− Expected Cash" value={`−${formatNumberSpaces(expectedBalance)}`} />
                <div className={cn(
                  "flex justify-between pt-3 mt-2 border-t-2 text-lg font-bold",
                  isBalanced ? "border-success/60" : "border-destructive/60",
                )}>
                  <span className="text-card-foreground inline-flex items-center gap-2">
                    {isBalanced
                      ? <CheckCircle2 className="w-5 h-5 text-success" />
                      : <AlertTriangle className="w-5 h-5 text-destructive" />}
                    = Cash Desk Balance
                  </span>
                  <span className={isBalanced ? "text-success" : balance > 0 ? "cms-amount-positive" : "cms-amount-negative"}>
                    {balance >= 0 ? "+" : ""}{formatNumberSpaces(balance)} <span className="text-sm text-muted-foreground">TZS</span>
                  </span>
                </div>
              </div>
              {!isBalanced && (
                <p className="text-xs text-destructive flex items-center gap-1.5 pt-2 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Discrepancy — manager password required to accept.
                </p>
              )}
            </div>

            {/* THREE KEY RESULTS */}
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">Shift Results</p>
              <div className="grid grid-cols-3 gap-3">
                <KpiTile label="Tables Result" value={resultTable} tone={resultTable >= 0 ? "pos" : "neg"} />
                <KpiTile label="Cash Desk Balance" value={balance} tone={isBalanced ? "ok" : balance > 0 ? "pos" : "neg"} />
                <KpiTile label="Money Result" value={moneyResult} tone={moneyResult >= 0 ? "pos" : "neg"} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                Money Result = Buy/In − Cashout. Tables Result = sum of table P&L. Balance must be zero.
              </p>
            </div>

            {notes && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Cashier Notes</p>
                <p className="text-sm whitespace-pre-wrap text-card-foreground">{notes}</p>
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
        <p className="text-xs uppercase text-foreground tracking-wider font-bold mb-2">Tables Result</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-2 py-1.5 text-foreground font-semibold">Table</th>
                <th className="text-left px-2 py-1.5 text-foreground font-semibold">Game</th>
                <th className="text-left px-2 py-1.5 text-foreground font-semibold">Status</th>
                <th className="text-right px-2 py-1.5 text-foreground font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {tables.filter(t => !t.is_archived).map(t => {
                const isOpen = t.status === "open";
                const r = Number(t.closing_result || 0);
                return (
                  <tr key={t.id} className="border-b border-border/40">
                    <td className="px-2 py-1.5 text-foreground font-semibold">{t.name}</td>
                    <td className="px-2 py-1.5 text-foreground">{t.game}</td>
                    <td className="px-2 py-1.5">
                      {isOpen
                        ? <span className="text-destructive font-semibold">OPEN</span>
                        : <span className="text-success inline-flex items-center gap-1 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> CLOSED</span>}
                    </td>
                    <td className={cn(
                      "px-2 py-1.5 text-right font-semibold",
                      isOpen ? "text-foreground" :
                        r > 0 ? "cms-amount-positive" : r < 0 ? "cms-amount-negative" : "text-foreground",
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
                <td colSpan={3} className="px-2 py-2 font-bold text-foreground text-sm">Total Result Table</td>
                <td className={cn(
                  "px-2 py-2 text-right font-bold text-sm",
                  resultTable > 0 ? "cms-amount-positive" : resultTable < 0 ? "cms-amount-negative" : "text-foreground",
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
        <p className="text-xs uppercase text-foreground tracking-wider font-bold mb-2">
          Cash Desk · Chips (per denomination)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-2 py-1.5 text-foreground font-semibold">Denom</th>
                <th className="text-right px-2 py-1.5 text-foreground font-semibold">Open (qty)</th>
                <th className="text-right px-2 py-1.5 text-foreground font-semibold">Close (qty)</th>
                <th className="text-right px-2 py-1.5 text-foreground font-semibold">Miss (qty)</th>
                <th className="text-right px-2 py-1.5 text-foreground font-semibold">Miss (TZS)</th>
              </tr>
            </thead>
            <tbody>
              {CHIP_DENOMS.map(d => {
                const op = openingChips[d] || 0;
                const cl = chipCounts[d] || 0;
                const mq = missPerDenom[d] || 0;
                const mv = mq * d;
                const colorCls = mq > 0 ? "cms-amount-positive" : mq < 0 ? "cms-amount-negative" : "text-foreground";
                return (
                  <tr key={d} className="border-b border-border/30">
                    <td className="px-2 py-1.5 text-foreground font-semibold">{formatChipLabel(d)}</td>
                    <td className="px-2 py-1.5 text-right text-foreground">{op || "·"}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        value={cl || ""}
                        onChange={e => setChipCounts(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                        placeholder={op ? String(op) : "0"}
                        className="no-spin h-8 w-24 font-mono text-sm text-right px-2 bg-background border border-border rounded text-foreground"
                      />
                    </td>
                    <td className={cn("px-2 py-1.5 text-right font-bold", colorCls)}>
                      {mq === 0 ? "·" : `${mq > 0 ? "+" : ""}${mq}`}
                    </td>
                    <td className={cn("px-2 py-1.5 text-right font-semibold", colorCls)}>
                      {mv === 0 ? "·" : `${mv > 0 ? "+" : ""}${formatNumberSpaces(mv)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td className="px-2 py-2 font-bold text-foreground text-sm" colSpan={4}>MISS TOTAL</td>
                <td className={cn(
                  "px-2 py-2 text-right font-bold text-sm",
                  missTotal > 0 ? "cms-amount-positive" : missTotal < 0 ? "cms-amount-negative" : "text-foreground",
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
          hideChips
        />
        <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-border">
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Chips</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingChipsTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Cash</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingCashOnlyTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Mobile</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingMobileTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Bank</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(closingBankTzs)}</p></div>
        </div>
      </section>

      {/* Balance preview — cash only */}
      <section className={cn(
        "cms-panel p-4 border-2",
        isBalanced ? "border-success/50" : "border-destructive/50",
      )}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Cash Desk Balance — cash only</p>
          {isBalanced
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="w-4 h-4" /> Balanced</span>
            : <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="w-4 h-4" /> {balance > 0 ? "Surplus" : "Shortage"}</span>}
        </div>
        <div className="space-y-1 text-sm font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">  Closing Cash (Cash + Mobile + Bank)</span><span className="text-card-foreground">+{formatNumberSpaces(closingCashTotalTzs)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">− Expected Cash</span><span className="text-card-foreground">−{formatNumberSpaces(expectedBalance)}</span></div>
          <div className="flex justify-between border-t border-border pt-2 mt-2 text-base font-bold">
            <span className="text-card-foreground">= Cash Desk Balance</span>
            <span className={isBalanced ? "text-success" : balance > 0 ? "cms-amount-positive" : "cms-amount-negative"}>
              {balance >= 0 ? "+" : ""}{formatNumberSpaces(balance)} TZS
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-border">
          <KpiTile label="Tables Result" value={resultTable} tone={resultTable >= 0 ? "pos" : "neg"} compact />
          <KpiTile label="Cash Desk Balance" value={balance} tone={isBalanced ? "ok" : balance > 0 ? "pos" : "neg"} compact />
          <KpiTile label="Money Result" value={moneyResult} tone={moneyResult >= 0 ? "pos" : "neg"} compact />
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
          onClick={() => { if (tablesAllClosed) setStep("review"); }}
          disabled={loading || !tablesAllClosed}
          className="gap-1.5"
        >
          <ShieldAlert className="w-4 h-4" />
          Continue to Manager Review
        </Button>
      </div>
    </div>
  );
};

const BlockTotal = ({ label, value }: { label: string; value: number }) => (
  <div className="text-center rounded-md border border-border bg-background/40 p-2">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    <p className="font-mono text-sm font-bold text-card-foreground mt-0.5">{formatNumberSpaces(value)}</p>
    <p className="text-[9px] text-muted-foreground">TZS</p>
  </div>
);

const FormulaRow = ({
  label, value, amountClass,
}: { label: string; value: string; amountClass?: string }) => (
  <div className="flex justify-between border-b border-border/30 py-1">
    <span className="text-muted-foreground">{label}</span>
    <span className={amountClass ?? "text-card-foreground"}>{value}</span>
  </div>
);

const KpiTile = ({
  label, value, tone, compact,
}: { label: string; value: number; tone: "pos" | "neg" | "ok"; compact?: boolean }) => {
  const toneCls =
    tone === "ok" ? "text-success"
    : tone === "pos" ? "cms-amount-positive"
    : "cms-amount-negative";
  return (
    <div className="text-center rounded-md border border-border bg-background/60 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={cn("font-mono font-bold mt-0.5", compact ? "text-sm" : "text-lg", toneCls)}>
        {value >= 0 ? "+" : ""}{formatNumberSpaces(value)}
      </p>
      <p className="text-[9px] text-muted-foreground">TZS</p>
    </div>
  );
};

export default CloseShiftDialog;
