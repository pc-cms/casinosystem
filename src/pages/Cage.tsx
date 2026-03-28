import { useState, useMemo } from "react";
import { usePlayers, useGamingTables, useTransactions, useCreateTransaction } from "@/hooks/use-casino-data";
import { useActiveShift, useOpenShift, useCloseShift, useCreateCashCount } from "@/hooks/use-shift";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Play, Square, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency, CURRENCIES, DEFAULT_EXCHANGE_RATES, CASH_DENOMS } from "@/lib/currency";

// =================== MAIN CAGE PAGE ===================
const Cage = () => {
  const { data: shift } = useActiveShift();
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  // If no shift open, show open shift screen
  if (!shift) {
    return <OpenShiftScreen />;
  }

  return <ActiveShiftView shift={shift} players={players} tables={tables} />;
};

// =================== OPEN SHIFT ===================
const OpenShiftScreen = () => {
  const openShift = useOpenShift();
  const [rates, setRates] = useState<Record<string, number>>({ ...DEFAULT_EXCHANGE_RATES });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleOpen = () => {
    openShift.mutate({
      exchange_rates: rates,
      opening_float: {},
    }, { onSuccess: () => setShowConfirm(false) });
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="cms-panel p-6 text-center">
        <Play className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">No Active Shift</h2>
        <p className="text-sm text-muted-foreground mb-6">Open a new shift to start operations.</p>

        <div className="space-y-3 text-left mb-6">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">Exchange Rates (per 1 unit → TZS)</label>
          {CURRENCIES.filter(c => c !== "TZS").map(c => (
            <div key={c} className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-card-foreground w-12">{c}</span>
              <Input
                type="number"
                min={0}
                value={rates[c] || ""}
                onChange={e => setRates(r => ({ ...r, [c]: Number(e.target.value) || 0 }))}
                className="font-mono"
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">TZS</span>
            </div>
          ))}
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
              <div key={c} className="flex justify-between">
                <span className="text-muted-foreground">1 {c}</span>
                <span className="font-mono font-medium text-card-foreground">{formatCurrency(rates[c] || 0)}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleOpen} disabled={openShift.isPending}>
              {openShift.isPending ? "Opening..." : "Confirm"}
            </Button>
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
  const createTx = useCreateTransaction();
  const closeShift = useCloseShift();
  const [showClose, setShowClose] = useState(false);

  const activePlayers = players.filter(p => p.status === "active");
  const openTables = tables.filter(t => t.status === "open");

  const exchangeRates = (shift.exchange_rates || {}) as Record<string, number>;

  const totalBuyIns = useMemo(() =>
    transactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const totalCashouts = useMemo(() =>
    transactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const expectedBalance = totalBuyIns - totalCashouts;

  const shiftDuration = useMemo(() => {
    const start = new Date(shift.opened_at);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 60000);
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
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
              <span key={c} className="text-[10px] font-mono text-muted-foreground">
                {c}: {(exchangeRates[c] || 0).toLocaleString()}
              </span>
            ))}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowClose(true)} className="gap-1.5">
          <Square className="w-3.5 h-3.5" /> Close Shift
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Buy-Ins</p>
          <p className="font-mono text-lg font-bold cms-amount-negative">{formatCurrency(totalBuyIns)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Cashouts</p>
          <p className="font-mono text-lg font-bold cms-amount-positive">{formatCurrency(totalCashouts)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Expected Balance</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Transactions</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{transactions.length}</p>
        </div>
      </div>

      {/* Operation Tabs */}
      <Tabs defaultValue="buy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1.5"><ArrowDownToLine className="w-4 h-4" /> Buy-In</TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1.5"><ArrowUpFromLine className="w-4 h-4" /> Cashout</TabsTrigger>
          <TabsTrigger value="balance" className="gap-1.5"><Calculator className="w-4 h-4" /> Cash Check</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuyInForm
            players={activePlayers}
            tables={openTables}
            exchangeRates={exchangeRates}
            shiftId={shift.id}
            onSubmit={createTx.mutate}
            loading={createTx.isPending}
          />
        </TabsContent>
        <TabsContent value="cashout">
          <CashoutForm players={activePlayers} shiftId={shift.id} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="balance">
          <CashCheckForm expectedBalance={expectedBalance} shiftId={shift.id} />
        </TabsContent>
      </Tabs>

      {/* Transaction Log */}
      <div className="mt-8 cms-panel">
        <div className="cms-header">Shift Transactions</div>
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
              {transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-8">No transactions</td></tr>
              ) : [...transactions].reverse().map((tx, idx) => (
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
                    {(tx as any).original_currency || "TZS"}
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
        onConfirm={(data) => {
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

// =================== BUY-IN FORM (with multi-currency) ===================
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
    onSubmit(
      {
        player_id: playerId,
        table_id: tableId,
        type: "buy" as const,
        amount: tzsAmount,
        shift_id: shiftId,
        chips: currency !== "TZS" ? { original_currency: currency, original_amount: Number(amount), rate: exchangeRates[currency] } : undefined,
      },
      { onSuccess: () => setAmount("") }
    );
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
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Table (analytics)</label>
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
            <SelectContent>
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
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
    onSubmit(
      { player_id: playerId, table_id: null, type: "cashout" as const, amount: total, chips, shift_id: shiftId },
      { onSuccess: () => setChips({}) }
    );
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

// =================== CASH CHECK ===================
const CashCheckForm = ({ expectedBalance, shiftId }: { expectedBalance: number; shiftId: string }) => {
  const createCount = useCreateCashCount();
  const [currency, setCurrency] = useState("TZS");
  const denoms = currency === "TZS" ? CHIP_DENOMS.map(Number) : (CASH_DENOMS[currency] || []);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const realBalance = Object.entries(counts).reduce((sum, [d, c]) => sum + Number(d) * (c || 0), 0);
  const difference = realBalance - expectedBalance;

  const handleRecord = () => {
    createCount.mutate({
      shift_id: shiftId,
      count_type: "check",
      currency,
      denominations: counts,
      total: realBalance,
    }, { onSuccess: () => setCounts({}) });
  };

  return (
    <div className="cms-panel p-4 space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Count physical cash/chips. System logs snapshot.</p>
        <Select value={currency} onValueChange={(v) => { setCurrency(v); setCounts({}); }}>
          <SelectTrigger className="w-24 font-mono"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
          {currency === "TZS" ? "Chip Count" : `${currency} Cash Count`}
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {denoms.map(d => (
            <div key={d} className="flex items-center gap-1.5">
              <span className={`cms-chip text-[9px] min-w-[40px] text-center ${currency === "TZS" ? (CHIP_COLORS[d] || "bg-muted text-foreground") : "bg-muted text-foreground"}`}>
                {currency === "TZS" ? formatChipLabel(d) : d.toLocaleString()}
              </span>
              <Input type="number" min={0} value={counts[d] || ""} onChange={e => setCounts(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                className="font-mono w-14 h-8 text-xs" placeholder="0" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="cms-panel p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Expected</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
        </div>
        <div className="cms-panel p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Counted</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(realBalance, currency)}</p>
        </div>
        <div className="cms-panel p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Difference</p>
          <p className={`font-mono text-sm font-bold ${difference === 0 ? "text-card-foreground" : difference > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
            {difference >= 0 ? "+" : ""}{formatCurrency(difference, currency)}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={handleRecord} disabled={createCount.isPending} className="w-full">
        <Calculator className="w-4 h-4 mr-1.5" /> Record Snapshot
      </Button>
    </div>
  );
};

// =================== CLOSE SHIFT DIALOG ===================
const CloseShiftDialog = ({ open, onClose, shift, expectedBalance, onConfirm, loading }: any) => {
  const [notes, setNotes] = useState("");
  const [chipCounts, setChipCounts] = useState<Record<number, number>>({});
  const [cashCounts, setCashCounts] = useState<Record<string, Record<number, number>>>({ USD: {}, EUR: {} });

  const chipTotal = Object.entries(chipCounts).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const usdTotal = Object.entries(cashCounts.USD || {}).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);
  const eurTotal = Object.entries(cashCounts.EUR || {}).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

  const rates = (shift?.exchange_rates || {}) as Record<string, number>;
  const totalTzs = chipTotal + (usdTotal * (rates.USD || 0)) + (eurTotal * (rates.EUR || 0));
  const diff = totalTzs - expectedBalance;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close Shift</DialogTitle></DialogHeader>

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

        {/* Summary */}
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
            <p className={`font-mono text-xs font-bold ${diff === 0 ? "text-card-foreground" : diff > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
              {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Notes</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shift notes..." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onConfirm({
            closingCount: { TZS: chipCounts, USD: cashCounts.USD, EUR: cashCounts.EUR },
            closingCash: { TZS: chipTotal, USD: usdTotal, EUR: eurTotal, total_tzs: totalTzs },
            notes,
          })} disabled={loading}>
            {loading ? "Closing..." : "Close Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Cage;
