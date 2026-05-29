import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWallets, WALLET_LABELS, WalletType, useCreateWalletTransaction } from "@/hooks/use-finance";
import { useCashCountHistory, useLatestCashCounts, useCreateCashCount } from "@/hooks/use-cash-count";
import { CASH_DENOMS, CURRENCIES, DEFAULT_EXCHANGE_RATES, formatNumberSpaces } from "@/lib/currency";
import { AlertTriangle, CheckCircle, ClipboardCheck, History, Save } from "lucide-react";

import { CurrencySection, qKey, type QtyState } from "./cash-count/CurrencySection";
import { CageSafeSection, type CageSafeState, emptyCageSafe, getCageSlotTotal, getCageTableTotal } from "./cash-count/CageSafeSection";
import { MobileMoneySection, type MobileMoneyState, emptyMobileMoney, getMobileTotal, MOBILE_PROVIDERS } from "./cash-count/MobileMoneySection";
import { BankSection, type BankState, emptyBankState, getBankTotalTzs, BANK_FIELDS } from "./cash-count/BankSection";
import { HistoryView } from "./cash-count/HistoryView";

const COUNTABLE_WALLETS: WalletType[] = ["main_cash", "office_safe", "bar_cash"];

export const CashCount = () => {
  const { data: wallets = [], isLoading } = useWallets();
  const { data: history = [] } = useCashCountHistory();
  const { data: latestSnapshots = [] } = useLatestCashCounts();
  const createCount = useCreateCashCount();
  const createAdjustment = useCreateWalletTransaction();

  const [quantities, setQuantities] = useState<QtyState>({});
  const [rates, setRates] = useState<Record<string, number>>(() => ({ ...DEFAULT_EXCHANGE_RATES }));
  const [cageSafe, setCageSafe] = useState<CageSafeState>(emptyCageSafe());
  const [mobile, setMobile] = useState<MobileMoneyState>(emptyMobileMoney());
  const [banks, setBanks] = useState<BankState>(emptyBankState());
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const getRate = useCallback((cur: string) => cur === "TZS" ? 1 : (rates[cur] || DEFAULT_EXCHANGE_RATES[cur] || 1), [rates]);
  const handleRateChange = useCallback((cur: string, val: number) => {
    setRates(prev => ({ ...prev, [cur]: val }));
  }, []);

  // Pre-fill from latest snapshots (quantities + saved exchange rates from previous day)
  useEffect(() => {
    if (prefilled || latestSnapshots.length === 0) return;
    const q: QtyState = {};
    const cage = emptyCageSafe();
    const mob = emptyMobileMoney();
    const bnk = emptyBankState();
    const r: Record<string, number> = { ...DEFAULT_EXCHANGE_RATES };

    for (const snap of latestSnapshots) {
      const wt = snap.wallet_type as string;
      const denoms = snap.denominations as Record<string, number>;

      // Carry over saved exchange rate from previous day
      if (snap.currency && snap.currency !== "TZS" && Number(snap.exchange_rate) > 0) {
        r[snap.currency] = Number(snap.exchange_rate);
      }

      if (COUNTABLE_WALLETS.includes(wt as WalletType)) {
        for (const [denomStr, qty] of Object.entries(denoms)) {
          if (qty > 0) q[qKey(wt, snap.currency, Number(denomStr))] = qty;
        }
      } else if (wt === "cage_slot") {
        for (const [denomStr, qty] of Object.entries(denoms)) {
          if (qty > 0) cage.slot[Number(denomStr)] = qty;
        }
      } else if (wt === "cage_table") {
        for (const [denomStr, qty] of Object.entries(denoms)) {
          if (qty > 0) cage.table[Number(denomStr)] = qty;
        }
      } else if (wt === "mobile_money") {
        for (const [key, val] of Object.entries(denoms)) {
          if (key in mob) (mob as any)[key] = val;
        }
      } else if (wt === "bank_account") {
        for (const [key, val] of Object.entries(denoms)) {
          if (key in bnk) (bnk as any)[key] = val;
        }
      }
    }

    setQuantities(q);
    setCageSafe(cage);
    setMobile(mob);
    setBanks(bnk);
    setRates(r);
    setPrefilled(true);
  }, [latestSnapshots, prefilled]);

  const handleQuantityChange = useCallback((wallet: string, currency: string, denom: number, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setQuantities(prev => ({ ...prev, [qKey(wallet, currency, denom)]: val }));
  }, []);

  // Main cash totals per wallet
  const walletTotals = useMemo(() => {
    const result: Record<string, { totalTzs: number; byCurrency: Record<string, number> }> = {};
    for (const wt of COUNTABLE_WALLETS) {
      let totalTzs = 0;
      const byCurrency: Record<string, number> = {};
      for (const cur of CURRENCIES) {
        const denoms = CASH_DENOMS[cur] || [];
        const rate = getRate(cur);
        let curTotal = 0;
        for (const d of denoms) {
          curTotal += d * (quantities[qKey(wt, cur, d)] || 0);
        }
        byCurrency[cur] = curTotal;
        totalTzs += curTotal * rate;
      }
      result[wt] = { totalTzs, byCurrency };
    }
    return result;
  }, [quantities]);

  const mainCashTzs = useMemo(() =>
    (["main_cash", "office_safe"] as WalletType[]).reduce((sum, wt) => sum + (walletTotals[wt]?.totalTzs || 0), 0),
    [walletTotals]
  );
  const barCashTzs = walletTotals["bar_cash"]?.totalTzs || 0;

  const cageSlotTotal = getCageSlotTotal(cageSafe);
  const cageTableTotal = getCageTableTotal(cageSafe);
  const cageTotal = cageSlotTotal + cageTableTotal;
  const mobileTotal = getMobileTotal(mobile);
  const bankTotalTzs = getBankTotalTzs(banks);

  const totalRealMoney = mainCashTzs + barCashTzs + cageTotal + mobileTotal + bankTotalTzs;

  const grandExpected = useMemo(() => {
    const allWallets: WalletType[] = [...COUNTABLE_WALLETS, "cage_slot", "cage_table", "mobile_money", "bank_account"];
    return allWallets.reduce((sum, wt) => {
      const w = wallets.find(w => w.wallet_type === wt);
      return sum + Number(w?.current_balance || 0);
    }, 0);
  }, [wallets]);

  // Per-section expected balances
  const cageSlotExpected = Number(wallets.find(w => w.wallet_type === "cage_slot")?.current_balance || 0);
  const cageTableExpected = Number(wallets.find(w => w.wallet_type === "cage_table")?.current_balance || 0);
  const mobileExpected = Number(wallets.find(w => w.wallet_type === "mobile_money")?.current_balance || 0);
  const bankExpected = Number(wallets.find(w => w.wallet_type === "bank_account")?.current_balance || 0);

  const grandDiscrepancy = grandExpected - totalRealMoney;

  const handleSave = async () => {
    // Save one snapshot per wallet per currency that has data
    for (const wt of COUNTABLE_WALLETS) {
      for (const cur of CURRENCIES) {
        const denoms = CASH_DENOMS[cur] || [];
        const rate = getRate(cur);
        const denomMap: Record<string, number> = {};
        let hasData = false;
        let physTotal = 0;
        for (const d of denoms) {
          const qty = quantities[qKey(wt, cur, d)] || 0;
          if (qty > 0) { denomMap[String(d)] = qty; hasData = true; }
          physTotal += d * qty;
        }
        if (!hasData) continue;
        const expected = Number(wallets.find(w => w.wallet_type === wt)?.current_balance || 0);
        const physTotalTzs = physTotal * rate;
        await createCount.mutateAsync({
          wallet_type: wt,
          currency: cur,
          denominations: denomMap,
          physical_total: physTotal,
          expected_balance: expected,
          // discrepancy + physical_total_tzs computed by DB trigger
          // trg_cash_count_snapshot_compute (single source of truth)
          exchange_rate: rate,
          note,
        } as any);
      }
    }

    // Save cage slot
    if (cageSlotTotal > 0) {
      const denomMap: Record<string, number> = {};
      for (const [d, qty] of Object.entries(cageSafe.slot)) { if (qty > 0) denomMap[String(d)] = qty; }
      await createCount.mutateAsync({
        wallet_type: "cage_slot" as any,
        currency: "TZS",
        denominations: denomMap,
        physical_total: cageSlotTotal,
        expected_balance: cageSlotExpected,
        exchange_rate: 1,
        note,
      } as any);
    }

    // Save cage table
    if (cageTableTotal > 0) {
      const denomMap: Record<string, number> = {};
      for (const [d, qty] of Object.entries(cageSafe.table)) { if (qty > 0) denomMap[String(d)] = qty; }
      await createCount.mutateAsync({
        wallet_type: "cage_table" as any,
        currency: "TZS",
        denominations: denomMap,
        physical_total: cageTableTotal,
        expected_balance: cageTableExpected,
        exchange_rate: 1,
        note,
      } as any);
    }

    // Save mobile money
    if (mobileTotal > 0) {
      const mobileMap: Record<string, number> = {};
      for (const p of MOBILE_PROVIDERS) { if (mobile[p] > 0) mobileMap[p] = mobile[p]; }
      await createCount.mutateAsync({
        wallet_type: "mobile_money" as any,
        currency: "TZS",
        denominations: mobileMap,
        physical_total: mobileTotal,
        expected_balance: mobileExpected,
        exchange_rate: 1,
        note,
      } as any);
    }

    // Save bank
    if (bankTotalTzs > 0) {
      const bankMap: Record<string, number> = {};
      for (const f of BANK_FIELDS) { if (banks[f] > 0) bankMap[f] = banks[f]; }
      await createCount.mutateAsync({
        wallet_type: "bank_account" as any,
        currency: "TZS",
        denominations: bankMap,
        physical_total: bankTotalTzs,
        expected_balance: bankExpected,
        exchange_rate: 1,
        note,
      } as any);
    }

    setNote("");
  };

  const handleAdjustment = async (walletType: WalletType, discrepancy: number) => {
    if (discrepancy === 0) return;
    const abs = Math.abs(discrepancy);
    if (discrepancy > 0) {
      await createAdjustment.mutateAsync({
        tx_type: "adjustment" as any,
        from_wallet: walletType,
        amount: abs,
        description: `Cash count adjustment — system reduced by TZS ${formatNumberSpaces(abs)}`,
        business_date: new Date().toISOString().slice(0, 10),
      });
    } else {
      await createAdjustment.mutateAsync({
        tx_type: "adjustment" as any,
        to_wallet: walletType,
        amount: abs,
        description: `Cash count adjustment — system increased by TZS ${formatNumberSpaces(abs)}`,
        business_date: new Date().toISOString().slice(0, 10),
      });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" /> Physical Cash Count
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4 mr-1" /> {showHistory ? "Count" : "History"}
        </Button>
      </div>

      {showHistory ? (
        <HistoryView history={history} />
      ) : (
        <div className="space-y-4">
          {/* Wallet sections */}
          {COUNTABLE_WALLETS.map(wt => {
            const expected = Number(wallets.find(w => w.wallet_type === wt)?.current_balance || 0);
            const physical = walletTotals[wt]?.totalTzs || 0;
            const disc = expected - physical;
            return (
              <Card key={wt}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{WALLET_LABELS[wt]}</CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">System: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(expected)}</span></span>
                      <span className="text-muted-foreground">Physical: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(physical)}</span></span>
                      <span className={`font-mono font-bold ${disc === 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {disc === 0 ? <CheckCircle className="w-3.5 h-3.5 inline mr-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" />}
                        {disc > 0 ? "+" : ""}{formatNumberSpaces(disc)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {CURRENCIES.map(cur => {
                      const denoms = CASH_DENOMS[cur] || [];
                      const rate = getRate(cur);
                      const curTotal = walletTotals[wt]?.byCurrency[cur] || 0;
                      const curTotalTzs = curTotal * rate;
                      return (
                        <CurrencySection
                          key={cur}
                          wallet={wt}
                          currency={cur}
                          denoms={denoms}
                          rate={rate}
                          quantities={quantities}
                          total={curTotal}
                          totalTzs={curTotalTzs}
                          onChange={handleQuantityChange}
                          onRateChange={wt === COUNTABLE_WALLETS[0] ? handleRateChange : undefined}
                        />
                      );
                    })}
                  </div>
                  {disc !== 0 && (
                    <div className="flex items-center justify-between mt-3 p-2 rounded bg-destructive/10">
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {disc > 0 ? "System exceeds physical" : "Physical exceeds system"} by TZS {formatNumberSpaces(Math.abs(disc))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => handleAdjustment(wt, disc)}
                        disabled={createAdjustment.isPending}
                      >
                        Create Adjustment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* ── CAGE SAFE ── */}
          <CageSafeSection state={cageSafe} onChange={setCageSafe} />

          {/* ── MOBILE MONEY ── */}
          <MobileMoneySection state={mobile} onChange={setMobile} />

          {/* ── BANK ACCOUNTS ── */}
          <BankSection state={banks} onChange={setBanks} />

          {/* ── TOTAL REAL MONEY ── */}
          <Card className="border-2 border-primary/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs mb-3">
                <div className="text-center">
                  <span className="text-muted-foreground block">Main Cash</span>
                  <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(mainCashTzs)}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground block">Bar Cash</span>
                  <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(barCashTzs)}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground block">Cage Safe</span>
                  <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(cageTotal)}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground block">Mobile Money</span>
                  <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(mobileTotal)}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground block">Banks</span>
                  <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(bankTotalTzs)}</span>
                </div>
                <div className="text-center border-l border-border pl-3">
                  <span className="text-muted-foreground block font-semibold">Total Real Money</span>
                  <span className="font-mono font-bold text-foreground text-sm">TZS {formatNumberSpaces(totalRealMoney)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">Expected: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(grandExpected)}</span></span>
                  <span className="text-muted-foreground">Real: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(totalRealMoney)}</span></span>
                  <span className={`font-mono text-sm font-bold ${grandDiscrepancy === 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {grandDiscrepancy === 0 ? "✓ Match" : `Δ ${grandDiscrepancy > 0 ? "+" : ""}${formatNumberSpaces(grandDiscrepancy)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="text-xs h-8 min-h-8 w-48 resize-none"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={totalRealMoney === 0 || createCount.isPending}
                    size="sm"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {createCount.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
