import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useOpenShift, useLastClosedShift } from "@/hooks/use-shift";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Play, Settings2, ChevronRight, ChevronLeft, Landmark } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CHIP_DENOMS, formatCurrency, formatNumberSpaces, CURRENCIES, FOREIGN_CURRENCIES,
  DEFAULT_EXCHANGE_RATES, CASH_DENOMS,
} from "@/lib/currency";
import ChipDenomInput from "@/components/ChipDenomInput";
import CashDenomInput, { cashSum } from "@/components/cage/CashDenomInput";
import LockableSection from "@/components/cage/LockableSection";
import {
  MOBILE_PROVIDERS, emptyMobile, emptyBanks, mobileTotal, bankTotalTzs,
  chipSum, emptyCash, calcCashTotalTzs,
  type MobileProviders, type Banks,
} from "@/components/cage/CageHelpers";
import type { Tables } from "@/integrations/supabase/types";

const OpenShiftScreen = ({ tables }: { tables: Tables<"gaming_tables">[] }) => {
  const openShift = useOpenShift();
  const { managerOverride } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [rates, setRates] = useState<Record<string, number>>({ ...DEFAULT_EXCHANGE_RATES });
  const [closingChips, setClosingChips] = useState<Record<number, number>>({});
  const [openingChips, setOpeningChips] = useState<Record<number, number>>({});
  const [openingCash, setOpeningCash] = useState<Record<string, Record<number, number>>>(emptyCash);
  const [bankBalance, setBankBalance] = useState<Banks>(emptyBanks);
  const [mobileBalance, setMobileBalance] = useState<MobileProviders>(emptyMobile);
  const [showRates, setShowRates] = useState(false);

  const [locks, setLocks] = useState({
    closingChips: false, openingChips: false, tzsCash: false, mobile: false,
    eurCash: false, gbpCash: false, usdCash: false, kesCash: false, bankTzs: false, bankUsd: false,
  });

  const toggleLock = useCallback((key: keyof typeof locks) => {
    setLocks(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const closingChipTotal = useMemo(() => chipSum(closingChips), [closingChips]);
  const openingChipTotal = useMemo(() => chipSum(openingChips), [openingChips]);
  const cashTotalTzs = useMemo(() => calcCashTotalTzs(openingCash, rates), [openingCash, rates]);
  const mobTotal = useMemo(() => mobileTotal(mobileBalance), [mobileBalance]);
  const bankTotal = useMemo(() => bankTotalTzs(bankBalance, rates), [bankBalance, rates]);
  const openingTotal = openingChipTotal + cashTotalTzs + mobTotal + bankTotal;

  const handleOpen = () => {
    openShift.mutate({
      exchange_rates: rates,
      opening_float: {
        closing_chips: closingChips,
        chips: openingChips,
        cash: openingCash,
        bank: bankBalance,
        mobile: mobileBalance,
        totals: {
          closing_chips_tzs: closingChipTotal,
          chips_tzs: openingChipTotal,
          ...Object.fromEntries(CURRENCIES.map(c => [c, cashSum(openingCash[c] || {})])),
          bank: bankBalance,
          mobile: mobileBalance,
          total_tzs: openingTotal,
        },
      },
    });
  };

  return (
    <PageShell>
      <PageHeader
        icon={Landmark}
        title="Cage"
        subtitle={`Open shift · Step ${step} of 2`}
        centerSlot={
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {FOREIGN_CURRENCIES.map(c => (
              <span key={c} className="text-base font-semibold font-mono tabular-nums text-foreground">
                <span className="text-muted-foreground text-xs font-medium uppercase mr-1">{c}</span>
                {formatNumberSpaces(rates[c] || 0)}
              </span>
            ))}
          </div>
        }
      >
        <Button variant="outline" size="sm" onClick={() => setShowRates(true)} className="gap-1.5">
          <Settings2 className="w-3.5 h-3.5" /> Rates
        </Button>
      </PageHeader>

      <div className="flex items-center gap-1.5 mb-3">
        <button type="button" onClick={() => setStep(1)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <span className="w-4 h-4 rounded-full bg-background/20 flex items-center justify-center text-[9px] font-bold">1</span>
          Chips · TZS · Mobile
        </button>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <button type="button" onClick={() => setStep(2)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
          <span className="w-4 h-4 rounded-full bg-background/20 flex items-center justify-center text-[9px] font-bold">2</span>
          Foreign · Banks
        </button>
      </div>

      {step === 1 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <LockableSection title="Chips from Closing" locked={locks.closingChips} onToggleLock={() => toggleLock("closingChips")}>
              <div className={!managerOverride.active ? "opacity-50 pointer-events-none" : ""}>
                <ChipDenomInput values={closingChips} onChange={setClosingChips} showValue={false} />
              </div>
              {!managerOverride.active && (
                <p className="text-[9px] text-destructive font-medium">Manager access required</p>
              )}
            </LockableSection>
            <LockableSection title="Opening Chips" locked={locks.openingChips} onToggleLock={() => toggleLock("openingChips")}>
              <ChipDenomInput values={openingChips} onChange={setOpeningChips} showValue={false} />
            </LockableSection>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <LockableSection title="TZS Cash" locked={locks.tzsCash} onToggleLock={() => toggleLock("tzsCash")}>
              <CashDenomInput values={openingCash["TZS"] || {}} onChange={v => setOpeningCash(c => ({ ...c, TZS: v }))} denoms={CASH_DENOMS["TZS"] || []} currency="TZS" />
            </LockableSection>
            <LockableSection title="Mobile Money" locked={locks.mobile} onToggleLock={() => toggleLock("mobile")}>
              <div className="grid grid-cols-2 gap-2">
                {MOBILE_PROVIDERS.map(provider => (
                  <div key={provider} className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">{provider}</p>
                    <NumberInput
                      value={mobileBalance[provider] || ""}
                      onChange={v => setMobileBalance(m => ({ ...m, [provider]: Number(v) || 0 }))}
                      className="no-spin h-7 w-full min-w-0 font-mono text-xs text-right"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-[10px] font-medium text-muted-foreground">Mobile Total</span>
                <span className="font-mono text-xs font-bold text-card-foreground">TZS {formatNumberSpaces(mobTotal)}</span>
              </div>
            </LockableSection>
          </div>

          <div className="cms-panel px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Step 1 Subtotal (TZS)</p>
              <p className="text-lg font-mono font-bold text-card-foreground">
                {formatCurrency(openingChipTotal + cashSum(openingCash["TZS"] || {}) + mobTotal)}
              </p>
            </div>
            <Button onClick={() => setStep(2)} size="sm" className="gap-1 h-8 px-4">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <LockableSection title="EUR Cash" locked={locks.eurCash} onToggleLock={() => toggleLock("eurCash")}>
              <CashDenomInput values={openingCash["EUR"] || {}} onChange={v => setOpeningCash(c => ({ ...c, EUR: v }))} denoms={CASH_DENOMS["EUR"] || []} currency="EUR" />
            </LockableSection>
            <LockableSection title="USD Cash" locked={locks.usdCash} onToggleLock={() => toggleLock("usdCash")}>
              <CashDenomInput values={openingCash["USD"] || {}} onChange={v => setOpeningCash(c => ({ ...c, USD: v }))} denoms={CASH_DENOMS["USD"] || []} currency="USD" />
            </LockableSection>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <LockableSection title="GBP Cash" locked={locks.gbpCash} onToggleLock={() => toggleLock("gbpCash")}>
              <CashDenomInput values={openingCash["GBP"] || {}} onChange={v => setOpeningCash(c => ({ ...c, GBP: v }))} denoms={CASH_DENOMS["GBP"] || []} currency="GBP" />
            </LockableSection>
            <LockableSection title="KES Cash" locked={locks.kesCash} onToggleLock={() => toggleLock("kesCash")}>
              <CashDenomInput values={openingCash["KES"] || {}} onChange={v => setOpeningCash(c => ({ ...c, KES: v }))} denoms={CASH_DENOMS["KES"] || []} currency="KES" />
            </LockableSection>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <LockableSection title="Bank TZS" locked={locks.bankTzs} onToggleLock={() => toggleLock("bankTzs")}>
              <NumberInput value={bankBalance.tzs || ""} onChange={v => setBankBalance(b => ({ ...b, tzs: Number(v) || 0 }))} className="no-spin h-7 w-full text-right text-xs" placeholder="0" />
            </LockableSection>
            <LockableSection title="Bank USD" locked={locks.bankUsd} onToggleLock={() => toggleLock("bankUsd")}>
              <NumberInput value={bankBalance.usd || ""} onChange={v => setBankBalance(b => ({ ...b, usd: Number(v) || 0 }))} className="no-spin h-7 w-full text-right text-xs" placeholder="0" />
              {bankBalance.usd > 0 && rates?.["USD"] ? (
                <p className="text-[9px] font-mono text-muted-foreground">= TZS {formatNumberSpaces(bankBalance.usd * (rates["USD"] || 0))}</p>
              ) : null}
            </LockableSection>
          </div>

          <div className="cms-panel px-3 py-2 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Total Opening Chips</p>
                <p className="text-base font-mono font-bold text-card-foreground">TZS {formatNumberSpaces(openingChipTotal)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Total Cash (all → TZS)</p>
                <p className="text-base font-mono font-bold text-card-foreground">TZS {formatNumberSpaces(cashTotalTzs + mobTotal + bankTotal)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1 h-8">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <div>
                  <p className="text-[9px] uppercase text-muted-foreground tracking-wider">Grand Total (TZS)</p>
                  <p className="text-xl font-mono font-bold text-card-foreground">{formatCurrency(openingTotal)}</p>
                </div>
              </div>
              <Button onClick={handleOpen} disabled={openShift.isPending} className="gap-1 h-9 px-6" size="sm">
                <Play className="w-3.5 h-3.5" /> {openShift.isPending ? "Opening…" : "Open Shift"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showRates} onOpenChange={setShowRates}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Exchange Rates</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">Set how many TZS per 1 unit of foreign currency</p>
          <div className="space-y-3">
            {FOREIGN_CURRENCIES.map(c => (
              <div key={c} className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-card-foreground w-10">{c}</span>
                <NumberInput value={rates[c] || ""} onChange={v => setRates(r => ({ ...r, [c]: Number(v) || 0 }))} placeholder="0" className="flex-1" />
                <span className="text-xs text-muted-foreground font-mono">TZS</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRates(false)} className="w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default OpenShiftScreen;
