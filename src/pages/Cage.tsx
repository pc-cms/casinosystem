import { useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { CardSkeleton, TableSkeleton } from "@/components/LoadingSkeletons";
import { usePlayers, useGamingTables, useTransactions, useCreateTransaction, useExpenses } from "@/hooks/use-casino-data";
import { useActiveShift, useOpenShift, useCloseShift, useCreateCashCount, useCashCounts } from "@/hooks/use-shift";
import { useBatchChipSnapshot, getExpectedChips, getInitialTotal } from "@/hooks/use-chips";
import { useChipBaseline, useCloseAllTables, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Play, Square, AlertTriangle, CheckCircle2, Package, Settings2, ChevronRight, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency, formatNumberSpaces, CURRENCIES, FOREIGN_CURRENCIES,
  DEFAULT_EXCHANGE_RATES, CASH_DENOMS,
} from "@/lib/currency";
import PlayerSearch from "@/components/cage/PlayerSearch";
import ChipDenomInput from "@/components/ChipDenomInput";
import CashDenomInput, { cashSum } from "@/components/cage/CashDenomInput";
import CashCountGrid from "@/components/cage/CashCountGrid";
import LockableSection from "@/components/cage/LockableSection";
import {
  MOBILE_PROVIDERS, emptyMobile, emptyBanks, mobileTotal, bankTotalTzs,
  chipSum, emptyCash, calcCashTotalTzs, calcGrandTotal,
  type MobileProviders, type Banks,
} from "@/components/cage/CageHelpers";

const Cage = () => {
  const { data: shift } = useActiveShift();
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  if (!shift) return <OpenShiftScreen tables={tables} />;
  return <ActiveShiftView shift={shift as any} players={players} tables={tables} />;
};

// =================== OPEN SHIFT (2-STEP WIZARD) ===================
const OpenShiftScreen = ({ tables }: { tables: any[] }) => {
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cage</h1>
          <p className="text-xs text-muted-foreground">Step {step} of 2</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowRates(true)} className="gap-1 font-mono text-[10px] h-7 px-2">
          <Settings2 className="w-3 h-3" /> Rates
        </Button>
      </div>

      <div className="flex items-center gap-3 px-2 py-1 rounded bg-muted/50 border border-border mb-2 text-[10px]">
        <span className="font-medium text-muted-foreground uppercase tracking-wider">Rates</span>
        {FOREIGN_CURRENCIES.map(c => (
          <span key={c} className="font-mono text-card-foreground">
            <span className="text-muted-foreground">{c}</span> {formatNumberSpaces(rates[c] || 0)}
          </span>
        ))}
      </div>

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
    </div>
  );
};

// =================== ACTIVE SHIFT VIEW ===================
const ActiveShiftView = ({ shift, players, tables }: { shift: any; players: any[]; tables: any[] }) => {
  const businessDate = getBusinessDate();
  const { data: transactions = [] } = useTransactions(businessDate);
  const { data: expenses = [] } = useExpenses(businessDate);
  const { data: cashChecks = [] } = useCashCounts(shift.id);
  const createTx = useCreateTransaction();
  const closeShift = useCloseShift();
  const [showClose, setShowClose] = useState(false);

  const activePlayers = useMemo(() => players.filter(p => p.status === "active"), [players]);
  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);
  const exchangeRates = (shift.exchange_rates || {}) as Record<string, number>;

  const shiftTransactions = useMemo(() => transactions.filter(t => t.shift_id === shift.id), [transactions, shift.id]);
  const shiftExpenses = useMemo(() => expenses.filter((e: any) => e.shift_id === shift.id), [expenses, shift.id]);

  const totalBuyIns = useMemo(() => shiftTransactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0), [shiftTransactions]);
  const totalCashouts = useMemo(() => shiftTransactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0), [shiftTransactions]);
  const totalExpenses = useMemo(() => shiftExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0), [shiftExpenses]);

  const openingFloat = useMemo(() => {
    const of = shift.opening_float as any;
    return of?.totals?.total_tzs || 0;
  }, [shift]);

  const expectedCash = openingFloat + totalBuyIns - totalCashouts - totalExpenses;
  const cashResult = totalBuyIns - totalCashouts;

  const shiftDuration = useMemo(() => {
    const start = new Date(shift.opened_at);
    const diff = Math.floor((Date.now() - start.getTime()) / 60000);
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  }, [shift.opened_at]);

  // Pre-build table lookup map instead of .find() in render
  const tableMap = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cage</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted-foreground">{shiftDuration}</span>
            </span>
            {FOREIGN_CURRENCIES.map(c => (
              <span key={c} className="text-[10px] font-mono text-muted-foreground">{c}: {formatNumberSpaces(exchangeRates[c] || 0)}</span>
            ))}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowClose(true)} className="gap-1.5">
          <Square className="w-3.5 h-3.5" /> Close Shift
        </Button>
      </div>

      <div className="cms-panel p-3 mb-4">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Cash Flow</p>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          <div><p className="text-[9px] uppercase text-muted-foreground">Opening</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(openingFloat)}</p></div>
          <div><p className="text-[9px] uppercase text-muted-foreground">+ Buy-Ins</p><p className="font-mono text-sm font-bold text-green-500">+{formatCurrency(totalBuyIns)}</p></div>
          <div><p className="text-[9px] uppercase text-muted-foreground">− Cashouts</p><p className="font-mono text-sm font-bold text-destructive">−{formatCurrency(totalCashouts)}</p></div>
          <div><p className="text-[9px] uppercase text-muted-foreground">− Expenses</p><p className="font-mono text-sm font-bold text-orange-500">−{formatCurrency(totalExpenses)}</p></div>
          <div><p className="text-[9px] uppercase text-muted-foreground">= Expected</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(expectedCash)}</p></div>
          <div><p className="text-[9px] uppercase text-muted-foreground">Cash Result</p><p className={`font-mono text-sm font-bold ${cashResult >= 0 ? "text-green-500" : "text-destructive"}`}>{cashResult >= 0 ? "+" : ""}{formatCurrency(cashResult)}</p></div>
          <div><p className="text-[9px] uppercase text-muted-foreground">Txns</p><p className="font-mono text-sm font-bold text-card-foreground">{shiftTransactions.length}</p></div>
        </div>
      </div>

      <Tabs defaultValue="buy" className="space-y-3">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1"><ArrowDownToLine className="w-3.5 h-3.5" /> Buy</TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1"><ArrowUpFromLine className="w-3.5 h-3.5" /> Cash</TabsTrigger>
          <TabsTrigger value="check" className="gap-1"><Calculator className="w-3.5 h-3.5" /> Check</TabsTrigger>
          <TabsTrigger value="close-tables" className="gap-1"><Package className="w-3.5 h-3.5" /> Close Tables</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuyInForm players={activePlayers} tables={openTables} exchangeRates={exchangeRates} shiftId={shift.id} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="cashout">
          <CashoutForm players={activePlayers} shiftId={shift.id} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="check">
          <CashCheckForm expectedBalance={expectedCash} shiftId={shift.id} exchangeRates={exchangeRates} cashChecks={cashChecks} />
        </TabsContent>
        <TabsContent value="close-tables">
          <CloseTablesForm tables={tables} />
        </TabsContent>
      </Tabs>

      <div className="mt-6 cms-panel">
        <div className="cms-header">Transactions ({shiftTransactions.length})</div>
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {["Type", "Player", "Table", "Amount", "Time"].map(h => (
                  <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-1.5 ${h === "Amount" || h === "Time" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shiftTransactions.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-6">No transactions yet</td></tr>
              ) : shiftTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {tx.type === "buy" ? "BUY" : "CASH"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-card-foreground">{(tx as any).players?.first_name} {(tx as any).players?.last_name}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground font-mono">
                    {tx.table_id ? tableMap.get(tx.table_id)?.name || "—" : "—"}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono text-xs font-medium ${tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}`}>
                    {tx.type === "buy" ? "-" : "+"}{formatCurrency(Number(tx.amount))}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CloseShiftDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        shift={shift}
        expectedBalance={expectedCash}
        cashResult={cashResult}
        totalBuyIns={totalBuyIns}
        totalCashouts={totalCashouts}
        totalExpenses={totalExpenses}
        openingFloat={openingFloat}
        tables={tables}
        onConfirm={(data: any) => {
          closeShift.mutate({
            shift_id: shift.id,
            closing_count: data.closingCount,
            closing_cash: data.closingCash,
            notes: data.notes,
            cash_result: data.cashResult,
            miss_total: data.missTotal,
            shift_result: data.shiftResult,
          }, { onSuccess: () => setShowClose(false) });
        }}
        loading={closeShift.isPending}
      />
    </div>
  );
};

// =================== BUY-IN FORM ===================
const BuyInForm = ({ players, tables, exchangeRates, shiftId, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [tableId, setTableId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const amountRef = useRef<HTMLInputElement>(null);

  const tzsAmount = useMemo(() => {
    const raw = Number(amount) || 0;
    if (currency === "TZS") return raw;
    return raw * (exchangeRates[currency] || 0);
  }, [amount, currency, exchangeRates]);

  const handleSubmit = () => {
    if (!playerId || !tableId || !amount || tzsAmount <= 0) return;
    if (Number(amount) <= 0) { toast.error("Amount must be greater than zero"); return; }
    const player = players.find((p: any) => p.id === playerId);
    if (player?.status === "blacklist") { toast.error("BLOCKED — Player is blacklisted"); return; }
    onSubmit({
      player_id: playerId, table_id: tableId, type: "buy" as const, amount: tzsAmount, shift_id: shiftId,
      chips: currency !== "TZS" ? { original_currency: currency, original_amount: Number(amount), rate: exchangeRates[currency] } : undefined,
    }, { onSuccess: () => { setAmount(""); amountRef.current?.focus(); } });
  };

  return (
    <div className="cms-panel p-4 max-w-md">
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">1. Player</label>
          <PlayerSearch players={players} value={playerId} onChange={setPlayerId} autoFocus />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">2. Table</label>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t: any) => (
              <button key={t.id} onClick={() => setTableId(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${tableId === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20"}`}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">3. Amount</label>
            <NumberInput value={amount} onChange={setAmount} className="text-lg h-11" placeholder="0" onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div className="w-20">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="font-mono h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {currency !== "TZS" && tzsAmount > 0 && (
          <p className="text-xs font-mono text-muted-foreground text-right">= {formatCurrency(tzsAmount)} (1 {currency} = {formatNumberSpaces(exchangeRates[currency] || 0)} TZS)</p>
        )}
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || !tableId || tzsAmount <= 0 || loading} className="w-full mt-4 gap-1.5">
        <ArrowDownToLine className="w-4 h-4" /> {loading ? "Recording…" : "Buy-In"} {tzsAmount > 0 && `· ${formatCurrency(tzsAmount)}`}
      </Button>
    </div>
  );
};

// =================== CASHOUT FORM ===================
const CashoutForm = ({ players, shiftId, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const total = chipSum(chips);

  const handleSubmit = () => {
    if (!playerId || total <= 0) return;
    const player = players.find((p: any) => p.id === playerId);
    if (player?.status === "blacklist") { toast.error("BLOCKED — Player is blacklisted"); return; }
    onSubmit({ player_id: playerId, table_id: null, type: "cashout" as const, amount: total, chips, shift_id: shiftId },
      { onSuccess: () => setChips({}) });
  };

  return (
    <div className="cms-panel p-4 max-w-md">
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">1. Player</label>
          <PlayerSearch players={players} value={playerId} onChange={setPlayerId} autoFocus />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">2. Chips</label>
          <ChipDenomInput values={chips} onChange={setChips} onSubmit={handleSubmit} />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || total <= 0 || loading} className="w-full mt-3 gap-1.5">
        <ArrowUpFromLine className="w-4 h-4" /> {loading ? "Recording…" : "Cashout"} {total > 0 && `· ${formatCurrency(total)}`}
      </Button>
    </div>
  );
};

// =================== CASH CHECK ===================
const CashCheckForm = ({ expectedBalance, shiftId, exchangeRates, cashChecks }: {
  expectedBalance: number; shiftId: string; exchangeRates: Record<string, number>; cashChecks: any[];
}) => {
  const createCount = useCreateCashCount();
  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  const [cash, setCash] = useState<Record<string, Record<number, number>>>(emptyCash);
  const [bankBal, setBankBal] = useState<Banks>(emptyBanks);
  const [mobileBal, setMobileBal] = useState<MobileProviders>(emptyMobile);

  const totalTzs = useMemo(() => calcGrandTotal(chipCounts, cash, bankBal, mobileBal, exchangeRates), [chipCounts, cash, bankBal, mobileBal, exchangeRates]);
  const difference = totalTzs - expectedBalance;

  const handleRecord = () => {
    createCount.mutate({
      shift_id: shiftId, count_type: "check", currency: "ALL",
      denominations: {
        chips: chipCounts, cash,
        bank: bankBal, mobile: mobileBal,
        totals: {
          chips_tzs: chipSum(chipCounts),
          ...Object.fromEntries(CURRENCIES.map(c => [c, cashSum(cash[c] || {})])),
          bank: bankBal, mobile: mobileBal,
        },
      },
      total: totalTzs,
    }, {
      onSuccess: () => { setChipCounts({}); setCash(emptyCash()); setBankBal(emptyBanks()); setMobileBal(emptyMobile()); },
    });
  };

  return (
    <div className="space-y-3">
      <div className="cms-panel p-4">
        <CashCountGrid chips={chipCounts} onChipsChange={setChipCounts} cash={cash}
          onCashChange={(cur, v) => setCash(c => ({ ...c, [cur]: v }))} banks={bankBal} onBanksChange={setBankBal}
          mobile={mobileBal} onMobileChange={setMobileBal} rates={exchangeRates} />

        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-border">
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Expected</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Counted</p><p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(totalTzs)}</p></div>
          <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">Diff</p><p className={`font-mono text-xs font-bold ${difference === 0 ? "text-green-500" : "text-destructive"}`}>{difference >= 0 ? "+" : ""}{formatCurrency(difference)}</p></div>
        </div>

        <Button variant="outline" onClick={handleRecord} disabled={createCount.isPending} className="w-full mt-3">
          <Calculator className="w-4 h-4 mr-1.5" /> Record Check
        </Button>
      </div>

      {cashChecks.length > 0 && (
        <div className="cms-panel">
          <div className="cms-header text-xs">Previous ({cashChecks.length})</div>
          <div className="divide-y divide-border">
            {cashChecks.slice(0, 5).map((cc: any) => (
              <div key={cc.id} className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">{new Date(cc.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="font-mono text-xs font-medium text-card-foreground">{formatCurrency(Number(cc.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =================== CLOSE TABLES FORM ===================
const CloseTablesForm = ({ tables }: { tables: any[] }) => {
  const { data: baseline = [] } = useChipBaseline();
  const closeAllTables = useCloseAllTables();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const baselineMap = useMemo(() => baselineToMap(baseline), [baseline]);
  const tablesWithResults = useMemo(() => tables.filter(t => t.closing_result !== null && t.status === "open"), [tables]);
  const allConfirmed = tablesWithResults.length > 0 && tablesWithResults.every(t => confirmed[t.id]);

  const handleClose = () => {
    closeAllTables.mutate(tablesWithResults.map(t => t.id), { onSuccess: () => setConfirmed({}) });
  };

  if (tablesWithResults.length === 0) {
    return (
      <div className="cms-panel p-6 text-center">
        <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-card-foreground">No tables ready to close</p>
        <p className="text-xs text-muted-foreground mt-1">Pit Boss must record Result before tables can be closed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Distribute chips to restore baseline float, then confirm each table.</p>
      {tablesWithResults.map(table => {
        const closingChips = (table.closing_chips || {}) as Record<string, number>;
        const tableBaseline = baselineMap[table.id] || {};
        const result = Number(table.closing_result) || 0;
        const distribution = (table.denominations || []).map((d: number) => {
          const actual = Number(closingChips[String(d)]) || 0;
          const expected = tableBaseline[d] || 0;
          return { denom: d, diff: actual - expected };
        }).filter(r => r.diff !== 0);

        return (
          <div key={table.id} className="cms-panel p-3">
            <div className="flex items-center gap-3 mb-2">
              <Checkbox checked={!!confirmed[table.id]} onCheckedChange={c => setConfirmed(r => ({ ...r, [table.id]: !!c }))} id={`close-${table.id}`} />
              <label htmlFor={`close-${table.id}`} className="flex-1 cursor-pointer">
                <span className="text-sm font-semibold text-card-foreground">{table.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({table.game})</span>
              </label>
              <span className={`font-mono text-sm font-bold ${result >= 0 ? "text-green-500" : "text-destructive"}`}>
                {result >= 0 ? "+" : ""}{formatCurrency(result)}
              </span>
            </div>
            {distribution.length > 0 ? (
              <div className="ml-8 space-y-0.5">
                {distribution.map(r => (
                  <div key={r.denom} className="flex items-center gap-2 text-xs">
                    <span className={`cms-chip text-[8px] ${(CHIP_COLORS as any)[r.denom] || "bg-muted text-foreground"}`}>{formatChipLabel(r.denom)}</span>
                    {r.diff > 0
                      ? <span className="text-orange-500 font-mono">← Take {r.diff} from table</span>
                      : <span className="text-blue-500 font-mono">→ Give {Math.abs(r.diff)} to table</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ml-8 text-[10px] text-green-500 font-mono">✓ At baseline</p>
            )}
          </div>
        );
      })}
      <Button onClick={handleClose} disabled={!allConfirmed || closeAllTables.isPending} className="w-full gap-1.5" variant="destructive">
        <Package className="w-4 h-4" /> {closeAllTables.isPending ? "Closing…" : `Close ${tablesWithResults.length} Table(s)`}
      </Button>
    </div>
  );
};

// =================== CLOSE SHIFT DIALOG ===================
const CloseShiftDialog = ({ open, onClose, shift, expectedBalance, cashResult, totalBuyIns, totalCashouts, totalExpenses, openingFloat, tables, onConfirm, loading }: any) => {
  const [step, setStep] = useState(1);
  const [notes, setNotes] = useState("");
  const [tableReady, setTableReady] = useState<Record<string, boolean>>({});
  const allTablesReady = tables.length === 0 || tables.every((t: any) => tableReady[t.id]);
  const batchSnapshot = useBatchChipSnapshot();

  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  const [cashCounts, setCashCounts] = useState<Record<string, Record<number, number>>>(emptyCash);
  const [bankBal, setBankBal] = useState<Banks>(emptyBanks);
  const [mobileBal, setMobileBal] = useState<MobileProviders>(emptyMobile);

  const expectedChips = useMemo(() => getExpectedChips(tables), [tables]);
  const initialTotal = useMemo(() => getInitialTotal(tables), [tables]);
  const missPerDenom = useMemo(() => {
    const miss: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { miss[d] = (chipCounts[d] || 0) - (expectedChips[d] || 0); });
    return miss;
  }, [chipCounts, expectedChips]);
  const chipTotal = chipSum(chipCounts);
  const totalMissValue = chipTotal - initialTotal;
  const hasIncident = chipTotal > initialTotal;
  const hasAnyChipCount = Object.values(chipCounts).some(v => v > 0);

  const rates = (shift?.exchange_rates || {}) as Record<string, number>;
  const totalTzs = useMemo(() => calcGrandTotal(chipCounts, cashCounts, bankBal, mobileBal, rates), [chipCounts, cashCounts, bankBal, mobileBal, rates]);
  const diff = totalTzs - expectedBalance;
  const isPerfect = diff === 0;
  const shiftResult = (cashResult || 0) + totalMissValue;

  const businessDate = getBusinessDate();

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
            {tables.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 cms-panel p-2.5">
                <Checkbox checked={!!tableReady[t.id]} onCheckedChange={c => setTableReady(r => ({ ...r, [t.id]: !!c }))} id={`t-${t.id}`} />
                <label htmlFor={`t-${t.id}`} className="flex-1 cursor-pointer text-sm text-card-foreground">{t.name} <span className="text-xs text-muted-foreground">({t.game})</span></label>
                {tableReady[t.id] && <CheckCircle2 className="w-4 h-4 text-green-500" />}
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
                <div className="text-center"><p className="text-[9px] uppercase text-muted-foreground">MISS</p><p className={`font-mono text-xs font-bold ${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</p></div>
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
            <div className={`cms-panel p-3 text-center ${isPerfect ? "border-green-500/30" : "border-destructive/30"}`}>
              {isPerfect ? <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" /> : <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-1" />}
              <p className="text-sm font-medium text-card-foreground">{isPerfect ? "Balanced" : "Mismatch Detected"}</p>
            </div>

            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Cash Flow</p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-muted-foreground">Opening Float</span><span className="text-card-foreground">{formatCurrency(openingFloat || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">+ Buy-Ins</span><span className="text-green-500">+{formatCurrency(totalBuyIns || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">− Cashouts</span><span className="text-destructive">−{formatCurrency(totalCashouts || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">− Expenses</span><span className="text-orange-500">−{formatCurrency(totalExpenses || 0)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-bold"><span className="text-card-foreground">= Expected</span><span className="text-card-foreground">{formatCurrency(expectedBalance)}</span></div>
                <div className="flex justify-between"><span className="text-card-foreground">Counted</span><span className="text-card-foreground">{formatCurrency(totalTzs)}</span></div>
                <div className="flex justify-between font-bold"><span className="text-card-foreground">Difference</span><span className={isPerfect ? "text-green-500" : "text-destructive"}>{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span></div>
              </div>
            </div>

            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Shift Result</p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-muted-foreground">Cash Result (Buy − Cash)</span><span className={`${(cashResult || 0) >= 0 ? "text-green-500" : "text-destructive"}`}>{(cashResult || 0) >= 0 ? "+" : ""}{formatCurrency(cashResult || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Chip MISS</span><span className={`${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-bold text-sm"><span className="text-card-foreground">= Shift Result</span><span className={`${shiftResult >= 0 ? "text-green-500" : "text-destructive"}`}>{shiftResult >= 0 ? "+" : ""}{formatCurrency(shiftResult)}</span></div>
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

export default Cage;
