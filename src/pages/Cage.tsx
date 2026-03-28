import { useState, useMemo } from "react";
import { usePlayers, useGamingTables, useTransactions, useCreateTransaction, useExpenses } from "@/hooks/use-casino-data";
import { useActiveShift, useOpenShift, useCloseShift, useCreateCashCount, useCashCounts } from "@/hooks/use-shift";
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

// =================== MAIN CAGE PAGE ===================
const Cage = () => {
  const { data: shift } = useActiveShift();
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  if (!shift) return <OpenShiftScreen tables={tables} />;
  return <ActiveShiftView shift={shift} players={players} tables={tables} />;
};

// =================== OPEN SHIFT ===================
const OpenShiftScreen = ({ tables }: { tables: any[] }) => {
  const openShift = useOpenShift();
  const [rates, setRates] = useState<Record<string, number>>({ ...DEFAULT_EXCHANGE_RATES });
  const [showConfirm, setShowConfirm] = useState(false);
  // Opening cash input
  const [openingChips, setOpeningChips] = useState<Record<number, number>>({});
  const [openingCash, setOpeningCash] = useState<Record<string, Record<number, number>>>({ USD: {}, EUR: {} });
  const [bankBalance, setBankBalance] = useState(0);
  const [mobileBalance, setMobileBalance] = useState(0);

  const chipTotal = Object.entries(openingChips).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const usdTotal = Object.entries(openingCash.USD || {}).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const eurTotal = Object.entries(openingCash.EUR || {}).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const openingTotal = chipTotal + (usdTotal * (rates.USD || 0)) + (eurTotal * (rates.EUR || 0)) + bankBalance + mobileBalance;

  const handleOpen = () => {
    openShift.mutate({
      exchange_rates: rates,
      opening_float: {
        chips: openingChips,
        cash: { USD: openingCash.USD, EUR: openingCash.EUR },
        bank: bankBalance,
        mobile: mobileBalance,
        totals: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, bank: bankBalance, mobile: mobileBalance, total_tzs: openingTotal },
      },
    }, { onSuccess: () => setShowConfirm(false) });
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
          
          {/* TZS Chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">TZS Chips</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CHIP_DENOMS.map(d => (
                <div key={d} className="flex items-center gap-1">
                  <span className={`cms-chip text-[8px] min-w-[36px] text-center ${CHIP_COLORS[d] || ""}`}>{formatChipLabel(d)}</span>
                  <Input type="number" min={0} value={openingChips[d] || ""} onChange={e => setOpeningChips(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                    className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
                </div>
              ))}
            </div>
            <p className="text-right font-mono text-xs mt-1 text-card-foreground">= {formatCurrency(chipTotal)}</p>
          </div>

          {/* USD Cash */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">USD Cash</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(CASH_DENOMS.USD || []).map(d => (
                <div key={d} className="flex items-center gap-1">
                  <span className="cms-chip text-[8px] min-w-[32px] text-center bg-muted text-foreground">${d}</span>
                  <Input type="number" min={0} value={openingCash.USD?.[d] || ""} onChange={e => setOpeningCash(c => ({ ...c, USD: { ...c.USD, [d]: Number(e.target.value) || 0 } }))}
                    className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
                </div>
              ))}
            </div>
            <p className="text-right font-mono text-xs mt-1 text-card-foreground">= ${usdTotal.toLocaleString()}</p>
          </div>

          {/* EUR Cash */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">EUR Cash</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(CASH_DENOMS.EUR || []).map(d => (
                <div key={d} className="flex items-center gap-1">
                  <span className="cms-chip text-[8px] min-w-[32px] text-center bg-muted text-foreground">€{d}</span>
                  <Input type="number" min={0} value={openingCash.EUR?.[d] || ""} onChange={e => setOpeningCash(c => ({ ...c, EUR: { ...c.EUR, [d]: Number(e.target.value) || 0 } }))}
                    className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
                </div>
              ))}
            </div>
            <p className="text-right font-mono text-xs mt-1 text-card-foreground">= €{eurTotal.toLocaleString()}</p>
          </div>

          {/* Bank & Mobile */}
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

        <Button onClick={() => setShowConfirm(true)} className="w-full gap-1.5" size="lg">
          <Play className="w-4 h-4" /> Open Shift
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Confirm Shift Open</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {CURRENCIES.filter(c => c !== "TZS").map(c => (
              <div key={c} className="flex justify-between" >
                <span className="text-muted-foreground">1 {c}</span>
                <span className="font-mono font-medium text-card-foreground">{formatCurrency(rates[c] || 0)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-muted-foreground">Opening Total</span>
              <span className="font-mono font-bold text-card-foreground">{formatCurrency(openingTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleOpen} disabled={openShift.isPending}>{openShift.isPending ? "Opening..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  // Filter shift-specific transactions and expenses
  const shiftTransactions = useMemo(() => transactions.filter(t => t.shift_id === shift.id), [transactions, shift.id]);
  const shiftExpenses = useMemo(() => expenses.filter((e: any) => e.shift_id === shift.id), [expenses, shift.id]);

  const totalBuyIns = useMemo(() => shiftTransactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0), [shiftTransactions]);
  const totalCashouts = useMemo(() => shiftTransactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0), [shiftTransactions]);
  const totalExpenses = useMemo(() => shiftExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0), [shiftExpenses]);

  // Opening float total
  const openingFloat = useMemo(() => {
    const of = shift.opening_float as any;
    return of?.totals?.total_tzs || 0;
  }, [shift]);

  // Expected balance = opening + buy-ins - cashouts - expenses
  const expectedBalance = openingFloat + totalBuyIns - totalCashouts - totalExpenses;

  const shiftDuration = useMemo(() => {
    const start = new Date(shift.opened_at);
    const diff = Math.floor((Date.now() - start.getTime()) / 60000);
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  }, [shift.opened_at]);

  return (
    <div>
      {/* Shift Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cage</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted-foreground">Shift active: {shiftDuration}</span>
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

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Opening</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{formatCurrency(openingFloat)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Buy-Ins</p>
          <p className="font-mono text-lg font-bold cms-amount-negative">{formatCurrency(totalBuyIns)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Cashouts</p>
          <p className="font-mono text-lg font-bold cms-amount-positive">{formatCurrency(totalCashouts)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Expenses</p>
          <p className="font-mono text-lg font-bold text-orange-500">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Expected</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Transactions</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{shiftTransactions.length}</p>
        </div>
      </div>

      {/* Operation Tabs */}
      <Tabs defaultValue="buy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1.5"><ArrowDownToLine className="w-4 h-4" /> Buy-In</TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1.5"><ArrowUpFromLine className="w-4 h-4" /> Cashout</TabsTrigger>
          <TabsTrigger value="check" className="gap-1.5"><Calculator className="w-4 h-4" /> Cash Check</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuyInForm players={activePlayers} tables={openTables} exchangeRates={exchangeRates} shiftId={shift.id} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="cashout">
          <CashoutForm players={activePlayers} shiftId={shift.id} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="check">
          <CashCheckForm expectedBalance={expectedBalance} shiftId={shift.id} exchangeRates={exchangeRates} cashChecks={cashChecks} />
        </TabsContent>
      </Tabs>

      {/* Transaction Log */}
      <div className="mt-8 cms-panel">
        <div className="cms-header">Shift Transactions ({shiftTransactions.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["#", "Type", "Player", "Table", "Amount", "Currency", "Time"].map(h => (
                  <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-4 py-2 ${h === "Amount" || h === "Time" ? "text-right" : h === "#" ? "text-center w-12" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shiftTransactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-8">No transactions</td></tr>
              ) : [...shiftTransactions].reverse().map((tx, idx) => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-center text-xs font-mono text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {tx.type === "buy" ? "BUY" : "CASH"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-card-foreground">{(tx as any).players?.first_name} {(tx as any).players?.last_name}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{(tx as any).gaming_tables?.name || "—"}</td>
                  <td className={`px-4 py-2 text-right font-mono text-sm font-medium ${tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}`}>
                    {tx.type === "buy" ? "-" : "+"}{formatCurrency(Number(tx.amount))}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                    {(tx.chips as any)?.original_currency || (tx.chips as any)?.currency || "TZS"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Close Shift Dialog */}
      <CloseShiftDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        shift={shift}
        expectedBalance={expectedBalance}
        tables={tables}
        onConfirm={(data: any) => {
          closeShift.mutate({
            shift_id: shift.id,
            closing_count: data.closingCount,
            closing_cash: data.closingCash,
            notes: data.notes,
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

  const tzsAmount = useMemo(() => {
    const raw = Number(amount) || 0;
    if (currency === "TZS") return raw;
    return raw * (exchangeRates[currency] || 0);
  }, [amount, currency, exchangeRates]);

  const handleSubmit = () => {
    if (!playerId || !tableId || !amount || tzsAmount <= 0) return;
    onSubmit({
      player_id: playerId, table_id: tableId, type: "buy" as const, amount: tzsAmount, shift_id: shiftId,
      chips: currency !== "TZS" ? { original_currency: currency, original_amount: Number(amount), rate: exchangeRates[currency] } : undefined,
    }, { onSuccess: () => setAmount("") });
  };

  return (
    <div className="cms-panel p-4 space-y-4 max-w-md">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Player</label>
        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
          <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Table</label>
        <Select value={tableId} onValueChange={setTableId}>
          <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
          <SelectContent>{tables.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} — {t.game}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount</label>
          <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-lg" placeholder="0"
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>
        <div className="w-24">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Currency</label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {currency !== "TZS" && tzsAmount > 0 && (
        <div className="cms-panel p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Converted to TZS</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(tzsAmount)}</p>
          <p className="text-[10px] text-muted-foreground">Rate: 1 {currency} = {(exchangeRates[currency] || 0).toLocaleString()} TZS</p>
        </div>
      )}
      <Button onClick={handleSubmit} disabled={!playerId || !tableId || tzsAmount <= 0 || loading} className="w-full">
        <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Record Buy-In
      </Button>
    </div>
  );
};

// =================== CASHOUT FORM ===================
const CashoutForm = ({ players, shiftId, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const total = Object.entries(chips).reduce((sum, [d, c]) => sum + Number(d) * (c || 0), 0);

  const handleSubmit = () => {
    if (!playerId || total <= 0) return;
    onSubmit({ player_id: playerId, table_id: null, type: "cashout" as const, amount: total, chips, shift_id: shiftId },
      { onSuccess: () => setChips({}) });
  };

  return (
    <div className="cms-panel p-4 space-y-4 max-w-lg">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Player</label>
        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
          <SelectContent>{players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Chip Count</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {CHIP_DENOMS.map(d => (
            <div key={d} className="flex items-center gap-1.5">
              <span className={`cms-chip text-[9px] min-w-[40px] text-center ${CHIP_COLORS[d] || ""}`}>{formatChipLabel(d)}</span>
              <Input type="number" min={0} value={chips[d] || ""} onChange={e => setChips(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                className="font-mono w-14 h-8 text-xs" placeholder="0" />
            </div>
          ))}
        </div>
      </div>
      <div className="cms-panel p-3 text-center">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Cashout</p>
        <p className="text-2xl font-mono font-bold cms-amount-positive">{formatCurrency(total)}</p>
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || total <= 0 || loading} className="w-full">
        <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Record Cashout
      </Button>
    </div>
  );
};

// =================== CASH CHECK (FULL SNAPSHOT) ===================
const CashCheckForm = ({ expectedBalance, shiftId, exchangeRates, cashChecks }: {
  expectedBalance: number; shiftId: string; exchangeRates: Record<string, number>; cashChecks: any[];
}) => {
  const createCount = useCreateCashCount();
  // Full multi-asset count
  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  const [usdCash, setUsdCash] = useState<Record<number, number>>({});
  const [eurCash, setEurCash] = useState<Record<number, number>>({});
  const [bankBal, setBankBal] = useState(0);
  const [mobileBal, setMobileBal] = useState(0);

  const chipTotal = Object.entries(chipCounts).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const usdTotal = Object.entries(usdCash).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const eurTotal = Object.entries(eurCash).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const totalTzs = chipTotal + (usdTotal * (exchangeRates.USD || 0)) + (eurTotal * (exchangeRates.EUR || 0)) + bankBal + mobileBal;
  const difference = totalTzs - expectedBalance;

  const handleRecord = () => {
    createCount.mutate({
      shift_id: shiftId,
      count_type: "check",
      currency: "ALL",
      denominations: {
        chips: chipCounts,
        cash: { USD: usdCash, EUR: eurCash },
        bank: bankBal,
        mobile: mobileBal,
        totals: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, bank: bankBal, mobile: mobileBal },
      },
      total: totalTzs,
    }, {
      onSuccess: () => {
        setChipCounts({});
        setUsdCash({});
        setEurCash({});
        setBankBal(0);
        setMobileBal(0);
      },
    });
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="cms-panel p-4 space-y-4">
        <p className="text-xs text-muted-foreground">Count all physical cash, chips, bank & mobile balances. System logs immutable snapshot.</p>

        {/* TZS Chips */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">TZS Chips</p>
          <div className="grid grid-cols-4 gap-1.5">
            {CHIP_DENOMS.map(d => (
              <div key={d} className="flex items-center gap-1">
                <span className={`cms-chip text-[8px] min-w-[36px] text-center ${CHIP_COLORS[d] || ""}`}>{formatChipLabel(d)}</span>
                <Input type="number" min={0} value={chipCounts[d] || ""} onChange={e => setChipCounts(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                  className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
              </div>
            ))}
          </div>
          <p className="text-right font-mono text-xs mt-1 text-card-foreground">= {formatCurrency(chipTotal)}</p>
        </div>

        {/* USD Cash */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">USD Cash</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(CASH_DENOMS.USD || []).map(d => (
              <div key={d} className="flex items-center gap-1">
                <span className="cms-chip text-[8px] min-w-[32px] text-center bg-muted text-foreground">${d}</span>
                <Input type="number" min={0} value={usdCash[d] || ""} onChange={e => setUsdCash(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                  className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
              </div>
            ))}
          </div>
          <p className="text-right font-mono text-xs mt-1 text-card-foreground">= ${usdTotal.toLocaleString()} ({formatCurrency(usdTotal * (exchangeRates.USD || 0))})</p>
        </div>

        {/* EUR Cash */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">EUR Cash</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(CASH_DENOMS.EUR || []).map(d => (
              <div key={d} className="flex items-center gap-1">
                <span className="cms-chip text-[8px] min-w-[32px] text-center bg-muted text-foreground">€{d}</span>
                <Input type="number" min={0} value={eurCash[d] || ""} onChange={e => setEurCash(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                  className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
              </div>
            ))}
          </div>
          <p className="text-right font-mono text-xs mt-1 text-card-foreground">= €{eurTotal.toLocaleString()} ({formatCurrency(eurTotal * (exchangeRates.EUR || 0))})</p>
        </div>

        {/* Bank & Mobile */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Bank Balance (TZS)</p>
            <Input type="number" min={0} value={bankBal || ""} onChange={e => setBankBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Mobile Money (TZS)</p>
            <Input type="number" min={0} value={mobileBal || ""} onChange={e => setMobileBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="cms-panel p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Expected</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
          </div>
          <div className="cms-panel p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Counted</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(totalTzs)}</p>
          </div>
          <div className="cms-panel p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Difference</p>
            <p className={`font-mono text-sm font-bold ${difference === 0 ? "text-green-500" : "text-destructive"}`}>
              {difference >= 0 ? "+" : ""}{formatCurrency(difference)}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={handleRecord} disabled={createCount.isPending} className="w-full">
          <Calculator className="w-4 h-4 mr-1.5" /> Record Snapshot
        </Button>
      </div>

      {/* Previous checks */}
      {cashChecks.length > 0 && (
        <div className="cms-panel">
          <div className="cms-header">Previous Checks ({cashChecks.length})</div>
          <div className="divide-y divide-border">
            {cashChecks.slice(0, 5).map((cc: any) => (
              <div key={cc.id} className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(cc.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-mono text-sm font-medium text-card-foreground">{formatCurrency(Number(cc.total))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =================== CLOSE SHIFT DIALOG (3-STEP) ===================
const CloseShiftDialog = ({ open, onClose, shift, expectedBalance, tables, onConfirm, loading }: any) => {
  const { isManager } = useAuth();
  const [step, setStep] = useState(1);
  const [notes, setNotes] = useState("");

  // Step 1: Table readiness
  const [tableReady, setTableReady] = useState<Record<string, boolean>>({});
  const allTablesReady = tables.length === 0 || tables.every((t: any) => tableReady[t.id]);

  // Step 2: Cashier count
  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  const [cashCounts, setCashCounts] = useState<Record<string, Record<number, number>>>({ USD: {}, EUR: {} });
  const [bankBal, setBankBal] = useState(0);
  const [mobileBal, setMobileBal] = useState(0);

  const chipTotal = Object.entries(chipCounts).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const usdTotal = Object.entries(cashCounts.USD || {}).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const eurTotal = Object.entries(cashCounts.EUR || {}).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const rates = (shift?.exchange_rates || {}) as Record<string, number>;
  const totalTzs = chipTotal + (usdTotal * (rates.USD || 0)) + (eurTotal * (rates.EUR || 0)) + bankBal + mobileBal;
  const diff = totalTzs - expectedBalance;
  const isPerfect = diff === 0;

  const handleClose = () => {
    onConfirm({
      closingCount: {
        chips: chipCounts,
        cash: { USD: cashCounts.USD, EUR: cashCounts.EUR },
        bank: bankBal,
        mobile: mobileBal,
        totals: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, bank: bankBal, mobile: mobileBal, total_tzs: totalTzs },
      },
      closingCash: {
        expected: expectedBalance,
        actual: totalTzs,
        difference: diff,
        table_readiness: tableReady,
      },
      notes: `${notes}${diff !== 0 ? ` | DIFFERENCE: ${diff >= 0 ? "+" : ""}${diff.toLocaleString()} TZS` : " | BALANCED"}`,
    });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep(1);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close Shift — Step {step} of 3</DialogTitle>
        </DialogHeader>

        {/* STEP 1: Table Readiness */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Confirm all tables are restored to base float before closing.</p>
            <div className="space-y-2">
              {tables.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 cms-panel p-3">
                  <Checkbox
                    checked={!!tableReady[t.id]}
                    onCheckedChange={(checked) => setTableReady(r => ({ ...r, [t.id]: !!checked }))}
                    id={`table-${t.id}`}
                  />
                  <label htmlFor={`table-${t.id}`} className="flex-1 cursor-pointer">
                    <span className="text-sm font-medium text-card-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({t.game})</span>
                  </label>
                  {tableReady[t.id] ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Pending</span>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep(2)} disabled={!allTablesReady}>
                <ClipboardCheck className="w-4 h-4 mr-1.5" /> All Tables Ready → Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: Full Count */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Count all chips, cash, bank and mobile money balances.</p>

            {/* TZS Chips */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">TZS Chip Count</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CHIP_DENOMS.map(d => (
                  <div key={d} className="flex items-center gap-1">
                    <span className={`cms-chip text-[8px] min-w-[36px] text-center ${CHIP_COLORS[d] || ""}`}>{formatChipLabel(d)}</span>
                    <Input type="number" min={0} value={chipCounts[d] || ""} onChange={e => setChipCounts(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                      className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
                  </div>
                ))}
              </div>
              <p className="text-right font-mono text-xs mt-1 text-card-foreground">= {formatCurrency(chipTotal)}</p>
            </div>

            {/* USD */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">USD Cash</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(CASH_DENOMS.USD || []).map(d => (
                  <div key={d} className="flex items-center gap-1">
                    <span className="cms-chip text-[8px] min-w-[32px] text-center bg-muted text-foreground">${d}</span>
                    <Input type="number" min={0} value={cashCounts.USD?.[d] || ""}
                      onChange={e => setCashCounts(c => ({ ...c, USD: { ...c.USD, [d]: Number(e.target.value) || 0 } }))}
                      className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
                  </div>
                ))}
              </div>
              <p className="text-right font-mono text-xs mt-1 text-card-foreground">= ${usdTotal.toLocaleString()} ({formatCurrency(usdTotal * (rates.USD || 0))})</p>
            </div>

            {/* EUR */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">EUR Cash</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(CASH_DENOMS.EUR || []).map(d => (
                  <div key={d} className="flex items-center gap-1">
                    <span className="cms-chip text-[8px] min-w-[32px] text-center bg-muted text-foreground">€{d}</span>
                    <Input type="number" min={0} value={cashCounts.EUR?.[d] || ""}
                      onChange={e => setCashCounts(c => ({ ...c, EUR: { ...c.EUR, [d]: Number(e.target.value) || 0 } }))}
                      className="font-mono w-12 h-7 text-[10px]" placeholder="0" />
                  </div>
                ))}
              </div>
              <p className="text-right font-mono text-xs mt-1 text-card-foreground">= €{eurTotal.toLocaleString()} ({formatCurrency(eurTotal * (rates.EUR || 0))})</p>
            </div>

            {/* Bank & Mobile */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Bank Balance (TZS)</label>
                <Input type="number" min={0} value={bankBal || ""} onChange={e => setBankBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Mobile Money (TZS)</label>
                <Input type="number" min={0} value={mobileBal || ""} onChange={e => setMobileBal(Number(e.target.value) || 0)} className="font-mono" placeholder="0" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Review → Next</Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Review & Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Result Summary */}
            <div className={`cms-panel p-4 text-center ${isPerfect ? "border-green-500/30" : "border-destructive/30"}`}>
              {isPerfect ? (
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
              )}
              <p className="text-sm font-medium text-card-foreground mb-1">
                {isPerfect ? "Perfect Balance" : "Mismatch Detected"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPerfect ? "Expected and actual balances match exactly." : "Investigation may be required. Shift can still close."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="cms-panel p-2 text-center">
                <p className="text-[9px] uppercase text-muted-foreground">Expected</p>
                <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
              </div>
              <div className="cms-panel p-2 text-center">
                <p className="text-[9px] uppercase text-muted-foreground">Counted</p>
                <p className="font-mono text-xs font-bold text-card-foreground">{formatCurrency(totalTzs)}</p>
              </div>
              <div className="cms-panel p-2 text-center">
                <p className="text-[9px] uppercase text-muted-foreground">Difference</p>
                <p className={`font-mono text-xs font-bold ${isPerfect ? "text-green-500" : "text-destructive"}`}>
                  {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="cms-panel p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">TZS Chips</span><span className="font-mono text-card-foreground">{formatCurrency(chipTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">USD Cash</span><span className="font-mono text-card-foreground">${usdTotal.toLocaleString()} ({formatCurrency(usdTotal * (rates.USD || 0))})</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">EUR Cash</span><span className="font-mono text-card-foreground">€{eurTotal.toLocaleString()} ({formatCurrency(eurTotal * (rates.EUR || 0))})</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bank Balance</span><span className="font-mono text-card-foreground">{formatCurrency(bankBal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mobile Money</span><span className="font-mono text-card-foreground">{formatCurrency(mobileBal)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 font-bold"><span className="text-card-foreground">Total</span><span className="font-mono text-card-foreground">{formatCurrency(totalTzs)}</span></div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Notes</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shift closing notes..." rows={2} />
            </div>

            {!isPerfect && (
              <div className="flex items-start gap-2 text-xs text-destructive cms-panel p-3 border-destructive/20">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Difference of <strong>{formatCurrency(Math.abs(diff))}</strong> will be logged. Shift will close but mismatch is recorded for investigation.</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button variant="destructive" onClick={handleClose} disabled={loading}>
                {loading ? "Closing..." : "Close Shift"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Cage;
