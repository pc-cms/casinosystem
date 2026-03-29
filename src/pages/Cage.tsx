import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { usePlayers, useGamingTables, useTransactions, useCreateTransaction, useExpenses } from "@/hooks/use-casino-data";
import { useActiveShift, useOpenShift, useCloseShift, useCreateCashCount, useCashCounts } from "@/hooks/use-shift";
import { useBatchChipSnapshot, getExpectedChips, getInitialTotal } from "@/hooks/use-chips";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Play, Square, AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency, CURRENCIES, DEFAULT_EXCHANGE_RATES, CASH_DENOMS } from "@/lib/currency";
import PlayerSearch from "@/components/cage/PlayerSearch";
import ChipDenomInput from "@/components/ChipDenomInput";

// Helper: sum chip values
const chipSum = (chips: Record<number, number>) =>
  Object.entries(chips).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

// Helper: sum cash values
const cashSum = (cash: Record<number, number>) =>
  Object.entries(cash).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

// Cash denomination input (single column, no spinners, keyboard-friendly)
const CashDenomInput = ({ values, onChange, denoms, prefix, onSubmit }: {
  values: Record<number, number>;
  onChange: (v: Record<number, number>) => void;
  denoms: number[];
  prefix: string;
  onSubmit?: () => void;
}) => {
  const refs = useRef<Record<number, HTMLInputElement | null>>({});
  return (
    <div className="space-y-1">
      {denoms.map((d, idx) => (
        <div key={d} className="flex items-center gap-2">
          <span className="cms-chip text-[9px] bg-muted text-foreground shrink-0 w-[40px] text-center">{prefix}{d.toLocaleString()}</span>
          <input
            ref={el => { refs.current[d] = el; }}
            type="number"
            className="no-spin font-mono text-sm h-8 w-20 rounded border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={values[d] || ""}
            onChange={e => onChange({ ...values, [d]: Number(e.target.value) || 0 })}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                const next = denoms[idx + 1];
                if (next !== undefined) refs.current[next]?.focus();
                else onSubmit?.();
              }
            }}
            placeholder="0"
            inputMode="numeric"
          />
          {(values[d] || 0) > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">= {prefix}{((values[d] || 0) * d).toLocaleString()}</span>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="text-xs font-medium text-muted-foreground w-[40px] text-center">Total</span>
        <span className="font-mono text-sm font-bold text-card-foreground">{prefix}{cashSum(values).toLocaleString()}</span>
      </div>
    </div>
  );
;

// =================== OPEN SHIFT ===================
const OpenShiftScreen = ({ tables }: { tables: any[] }) => {
  const openShift = useOpenShift();
  const [rates, setRates] = useState<Record<string, number>>({ ...DEFAULT_EXCHANGE_RATES });
  const [openingChips, setOpeningChips] = useState<Record<number, number>>({});
  const [openingUsd, setOpeningUsd] = useState<Record<number, number>>({});
  const [openingEur, setOpeningEur] = useState<Record<number, number>>({});
  const [bankBalance, setBankBalance] = useState(0);
  const [mobileBalance, setMobileBalance] = useState(0);

  const chipTotal = chipSum(openingChips);
  const usdTotal = cashSum(openingUsd);
  const eurTotal = cashSum(openingEur);
  const openingTotal = chipTotal + (usdTotal * (rates.USD || 0)) + (eurTotal * (rates.EUR || 0)) + bankBalance + mobileBalance;

  const handleOpen = () => {
    openShift.mutate({
      exchange_rates: rates,
      opening_float: {
        chips: openingChips,
        cash: { USD: openingUsd, EUR: openingEur },
        bank: bankBalance,
        mobile: mobileBalance,
        totals: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, bank: bankBalance, mobile: mobileBalance, total_tzs: openingTotal },
      },
    });
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="cms-panel p-6">
        <div className="text-center mb-6">
          <Play className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-1">No Active Shift</h2>
          <p className="text-sm text-muted-foreground">Open a new shift to start operations.</p>
        </div>

        {/* Exchange Rates */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">Exchange Rates (per 1 unit → TZS)</label>
          {CURRENCIES.filter(c => c !== "TZS").map(c => (
            <div key={c} className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-card-foreground w-12">{c}</span>
              <Input type="number" min={0} value={rates[c] || ""} onChange={e => setRates(r => ({ ...r, [c]: Number(e.target.value) || 0 }))} className="font-mono" placeholder="0" />
              <span className="text-xs text-muted-foreground">TZS</span>
            </div>
          ))}
        </div>

        {/* Opening Cash Count */}
        <div className="space-y-4 mb-6">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">Opening Cash Count</label>
          
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">TZS Chips</p>
            <ChipDenomInput values={openingChips} onChange={setOpeningChips} />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">USD Cash</p>
            <CashDenomInput values={openingUsd} onChange={setOpeningUsd} denoms={CASH_DENOMS.USD || []} prefix="$" />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">EUR Cash</p>
            <CashDenomInput values={openingEur} onChange={setOpeningEur} denoms={CASH_DENOMS.EUR || []} prefix="€" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Bank Balance (TZS)</p>
              <Input type="number" min={0} value={bankBalance || ""} onChange={e => setBankBalance(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Mobile Money (TZS)</p>
              <Input type="number" min={0} value={mobileBalance || ""} onChange={e => setMobileBalance(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
            </div>
          </div>
        </div>

        {/* Opening Total */}
        <div className="cms-panel p-3 text-center mb-6">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Opening Total (TZS)</p>
          <p className="text-2xl font-mono font-bold text-card-foreground">{formatCurrency(openingTotal)}</p>
        </div>

        <Button onClick={handleOpen} disabled={openShift.isPending} className="w-full gap-1.5" size="lg">
          <Play className="w-4 h-4" /> {openShift.isPending ? "Opening…" : "Open Shift"}
        </Button>
      </div>
    </div>
  );
};

// =================== ACTIVE SHIFT VIEW ===================
const ActiveShiftView = ({ shift, players, tables }: { shift: any; players: any[]; tables: any[] }) => {
  const today = new Date().toISOString().split("T")[0];
  const { data: transactions = [] } = useTransactions(today);
  const { data: expenses = [] } = useExpenses();
  const { data: cashChecks = [] } = useCashCounts(shift.id);
  const createTx = useCreateTransaction();
  const closeShift = useCloseShift();
  const [showClose, setShowClose] = useState(false);

  const activePlayers = players.filter(p => p.status === "active");
  const openTables = tables.filter(t => t.status === "open");
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

  return (
    <div>
      {/* Shift Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cage</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted-foreground">{shiftDuration}</span>
            </span>
            {CURRENCIES.filter(c => c !== "TZS").map(c => (
              <span key={c} className="text-[10px] font-mono text-muted-foreground">{c}: {(exchangeRates[c] || 0).toLocaleString()}</span>
            ))}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowClose(true)} className="gap-1.5">
          <Square className="w-3.5 h-3.5" /> Close Shift
        </Button>
      </div>

      {/* Cash Flow Summary */}
      <div className="cms-panel p-3 mb-4">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Cash Flow</p>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">Opening</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(openingFloat)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">+ Buy-Ins</p>
            <p className="font-mono text-sm font-bold text-green-500">+{formatCurrency(totalBuyIns)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">− Cashouts</p>
            <p className="font-mono text-sm font-bold text-destructive">−{formatCurrency(totalCashouts)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">− Expenses</p>
            <p className="font-mono text-sm font-bold text-orange-500">−{formatCurrency(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">= Expected</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(expectedCash)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">Cash Result</p>
            <p className={`font-mono text-sm font-bold ${cashResult >= 0 ? "text-green-500" : "text-destructive"}`}>
              {cashResult >= 0 ? "+" : ""}{formatCurrency(cashResult)}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">Txns</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{shiftTransactions.length}</p>
          </div>
        </div>
      </div>

      {/* Operation Tabs */}
      <Tabs defaultValue="buy" className="space-y-3">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1"><ArrowDownToLine className="w-3.5 h-3.5" /> Buy</TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1"><ArrowUpFromLine className="w-3.5 h-3.5" /> Cash</TabsTrigger>
          <TabsTrigger value="check" className="gap-1"><Calculator className="w-3.5 h-3.5" /> Check</TabsTrigger>
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
      </Tabs>

      {/* Transaction Log */}
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
              ) : [...shiftTransactions].reverse().map(tx => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {tx.type === "buy" ? "BUY" : "CASH"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-card-foreground">{(tx as any).players?.first_name} {(tx as any).players?.last_name}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground font-mono">
                    {tx.table_id ? tables.find(t => t.id === tx.table_id)?.name || "—" : "—"}
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
              <button
                key={t.id}
                onClick={() => setTableId(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  tableId === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">3. Amount</label>
            <Input ref={amountRef} type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)}
              className="font-mono text-lg h-11" placeholder="0"
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div className="w-20">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="font-mono h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {currency !== "TZS" && tzsAmount > 0 && (
          <p className="text-xs font-mono text-muted-foreground text-right">= {formatCurrency(tzsAmount)} (1 {currency} = {(exchangeRates[currency] || 0).toLocaleString()} TZS)</p>
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
  const [usdCash, setUsdCash] = useState<Record<number, number>>({});
  const [eurCash, setEurCash] = useState<Record<number, number>>({});
  const [bankBal, setBankBal] = useState(0);
  const [mobileBal, setMobileBal] = useState(0);

  const chipTotal = chipSum(chipCounts);
  const usdTotal = cashSum(usdCash);
  const eurTotal = cashSum(eurCash);
  const totalTzs = chipTotal + (usdTotal * (exchangeRates.USD || 0)) + (eurTotal * (exchangeRates.EUR || 0)) + bankBal + mobileBal;
  const difference = totalTzs - expectedBalance;

  const handleRecord = () => {
    createCount.mutate({
      shift_id: shiftId, count_type: "check", currency: "ALL",
      denominations: { chips: chipCounts, cash: { USD: usdCash, EUR: eurCash }, bank: bankBal, mobile: mobileBal,
        totals: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, bank: bankBal, mobile: mobileBal } },
      total: totalTzs,
    }, { onSuccess: () => { setChipCounts({}); setUsdCash({}); setEurCash({}); setBankBal(0); setMobileBal(0); } });
  };

  return (
    <div className="space-y-3 max-w-md">
      <div className="cms-panel p-4 space-y-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">TZS Chips</p>
          <ChipDenomInput values={chipCounts} onChange={setChipCounts} />
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">USD Cash</p>
          <CashDenomInput values={usdCash} onChange={setUsdCash} denoms={CASH_DENOMS.USD || []} prefix="$" />
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">EUR Cash</p>
          <CashDenomInput values={eurCash} onChange={setEurCash} denoms={CASH_DENOMS.EUR || []} prefix="€" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Bank (TZS)</p>
            <Input type="number" min={0} value={bankBal || ""} onChange={e => setBankBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Mobile (TZS)</p>
            <Input type="number" min={0} value={mobileBal || ""} onChange={e => setMobileBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
          </div>
        </div>

        {/* Inline result */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Expected</p>
            <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Counted</p>
            <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(totalTzs)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Diff</p>
            <p className={`font-mono text-xs font-bold ${difference === 0 ? "text-green-500" : "text-destructive"}`}>
              {difference >= 0 ? "+" : ""}{formatCurrency(difference)}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={handleRecord} disabled={createCount.isPending} className="w-full">
          <Calculator className="w-4 h-4 mr-1.5" /> Record Check
        </Button>
      </div>

      {cashChecks.length > 0 && (
        <div className="cms-panel">
          <div className="cms-header text-xs">Previous ({cashChecks.length})</div>
          <div className="divide-y divide-border">
            {cashChecks.slice(0, 5).map((cc: any) => (
              <div key={cc.id} className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(cc.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-mono text-xs font-medium text-card-foreground">{formatCurrency(Number(cc.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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

  // Step 2: Chip counts
  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  // Step 3: Cash counts
  const [cashCounts, setCashCounts] = useState<{ USD: Record<number, number>; EUR: Record<number, number> }>({ USD: {}, EUR: {} });
  const [bankBal, setBankBal] = useState(0);
  const [mobileBal, setMobileBal] = useState(0);

  // MISS calculation
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

  // Cash totals
  const usdTotal = cashSum(cashCounts.USD || {});
  const eurTotal = cashSum(cashCounts.EUR || {});
  const rates = (shift?.exchange_rates || {}) as Record<string, number>;
  const cashTzs = (usdTotal * (rates.USD || 0)) + (eurTotal * (rates.EUR || 0)) + bankBal + mobileBal;
  const totalTzs = chipTotal + cashTzs;
  const diff = totalTzs - expectedBalance;
  const isPerfect = diff === 0;
  const shiftResult = (cashResult || 0) + totalMissValue;

  const today = new Date().toISOString().split("T")[0];

  const handleClose = () => {
    if (hasAnyChipCount) {
      const snapRows = CHIP_DENOMS.filter(d => expectedChips[d] > 0 || chipCounts[d] > 0).map(d => ({
        location_type: "closing",
        location_id: null,
        denomination: d,
        expected_quantity: expectedChips[d] || 0,
        actual_quantity: chipCounts[d] || 0,
      }));
      batchSnapshot.mutate({ date: today, counts: snapRows });
    }

    onConfirm({
      closingCount: {
        chips: chipCounts,
        chip_miss: missPerDenom,
        chip_miss_total: totalMissValue,
        chip_incident: hasIncident,
        cash: { USD: cashCounts.USD, EUR: cashCounts.EUR },
        bank: bankBal, mobile: mobileBal,
        totals: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, bank: bankBal, mobile: mobileBal, total_tzs: totalTzs },
      },
      closingCash: {
        expected: expectedBalance,
        actual: totalTzs,
        difference: diff,
        cash_result: cashResult,
        shift_result: shiftResult,
        table_readiness: tableReady,
      },
      notes: `${notes} | CASH: ${cashResult >= 0 ? "+" : ""}${cashResult?.toLocaleString()} | MISS: ${totalMissValue >= 0 ? "+" : ""}${totalMissValue.toLocaleString()} | RESULT: ${shiftResult >= 0 ? "+" : ""}${shiftResult.toLocaleString()} | DIFF: ${diff >= 0 ? "+" : ""}${diff.toLocaleString()} TZS`.trim(),
      cashResult: cashResult,
      missTotal: totalMissValue,
      shiftResult: shiftResult,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setStep(1); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close Shift — Step {step}/4</DialogTitle></DialogHeader>

        {/* Step 1: Table readiness */}
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

        {/* Step 2: Chip Count (MISS) */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Count total chips per denomination across entire casino.</p>
            <ChipDenomInput
              values={chipCounts}
              onChange={setChipCounts}
              placeholder={expectedChips}
            />

            {hasAnyChipCount && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Expected</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(initialTotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">Counted</p>
                  <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(chipTotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase text-muted-foreground">MISS</p>
                  <p className={`font-mono text-xs font-bold ${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>
                    {totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}
                  </p>
                </div>
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
              <Button onClick={() => setStep(3)}>Next →</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Cash Count */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">USD</p>
              <CashDenomInput values={cashCounts.USD} onChange={v => setCashCounts(c => ({ ...c, USD: v }))} denoms={CASH_DENOMS.USD || []} prefix="$" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">EUR</p>
              <CashDenomInput values={cashCounts.EUR} onChange={v => setCashCounts(c => ({ ...c, EUR: v }))} denoms={CASH_DENOMS.EUR || []} prefix="€" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Bank (TZS)</p>
                <Input type="number" min={0} value={bankBal || ""} onChange={e => setBankBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Mobile (TZS)</p>
                <Input type="number" min={0} value={mobileBal || ""} onChange={e => setMobileBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={() => setStep(4)}>Review →</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
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
                <div className="flex justify-between font-bold">
                  <span className="text-card-foreground">Difference</span>
                  <span className={isPerfect ? "text-green-500" : "text-destructive"}>{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span>
                </div>
              </div>
            </div>

            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2 font-medium">Shift Result</p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Result (Buy − Cash)</span>
                  <span className={`${(cashResult || 0) >= 0 ? "text-green-500" : "text-destructive"}`}>{(cashResult || 0) >= 0 ? "+" : ""}{formatCurrency(cashResult || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chip MISS</span>
                  <span className={`${totalMissValue === 0 ? "text-green-500" : "text-destructive"}`}>{totalMissValue >= 0 ? "+" : ""}{formatCurrency(totalMissValue)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-bold text-sm">
                  <span className="text-card-foreground">= Shift Result</span>
                  <span className={`${shiftResult >= 0 ? "text-green-500" : "text-destructive"}`}>{shiftResult >= 0 ? "+" : ""}{formatCurrency(shiftResult)}</span>
                </div>
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
              <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
              <Button variant="destructive" onClick={handleClose} disabled={loading}>{loading ? "Closing…" : "Close Shift"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Cage;
