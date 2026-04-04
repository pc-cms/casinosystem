import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useTransactions, useExpenses, useCreateTransaction } from "@/hooks/use-casino-data";
import { useCloseShift, useCreateCashCount, useCashCounts } from "@/hooks/use-shift";
import { useChipBaseline, useCloseAllTables, baselineToMap } from "@/hooks/use-table-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { getBusinessDate } from "@/lib/business-day";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Square, CheckCircle2, Package } from "lucide-react";
import {
  CURRENCIES, FOREIGN_CURRENCIES, formatCurrency, formatNumberSpaces, CASH_DENOMS,
} from "@/lib/currency";
import PlayerSearch from "@/components/cage/PlayerSearch";
import ChipDenomInput from "@/components/ChipDenomInput";
import CashDenomInput, { cashSum } from "@/components/cage/CashDenomInput";
import CashCountGrid from "@/components/cage/CashCountGrid";
import CloseShiftDialog from "@/components/cage/CloseShiftDialog";
import {
  MOBILE_PROVIDERS, emptyMobile, emptyBanks, mobileTotal, bankTotalTzs,
  chipSum, emptyCash, calcGrandTotal,
  type MobileProviders, type Banks,
} from "@/components/cage/CageHelpers";
import type { Tables } from "@/integrations/supabase/types";

const ActiveShiftView = ({ shift, players, tables }: {
  shift: Tables<"shifts">;
  players: Tables<"players">[];
  tables: Tables<"gaming_tables">[];
}) => {
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
  const shiftExpenses = useMemo(() => expenses.filter(e => e.shift_id === shift.id), [expenses, shift.id]);

  const totalBuyIns = useMemo(() => shiftTransactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0), [shiftTransactions]);
  const totalCashouts = useMemo(() => shiftTransactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0), [shiftTransactions]);
  const totalExpenses = useMemo(() => shiftExpenses.reduce((s, e) => s + Number(e.amount), 0), [shiftExpenses]);

  const openingFloat = useMemo(() => {
    const of = shift.opening_float as Record<string, unknown> | null;
    const totals = of?.totals as Record<string, number> | undefined;
    return totals?.total_tzs || 0;
  }, [shift]);

  const expectedCash = openingFloat + totalBuyIns - totalCashouts - totalExpenses;
  const cashResult = totalBuyIns - totalCashouts;

  const shiftDuration = useMemo(() => {
    const start = new Date(shift.opened_at);
    const diff = Math.floor((Date.now() - start.getTime()) / 60000);
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  }, [shift.opened_at]);

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
              ) : shiftTransactions.map(tx => {
                const txWithPlayer = tx as typeof tx & { players?: { first_name: string; last_name: string } };
                return (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                        {tx.type === "buy" ? "BUY" : "CASH"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-card-foreground">{txWithPlayer.players?.first_name} {txWithPlayer.players?.last_name}</td>
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
                );
              })}
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
        onConfirm={(data) => {
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
const BuyInForm = ({ players, tables, exchangeRates, shiftId, onSubmit, loading }: {
  players: Tables<"players">[];
  tables: Tables<"gaming_tables">[];
  exchangeRates: Record<string, number>;
  shiftId: string;
  onSubmit: (data: Record<string, unknown>, opts?: Record<string, unknown>) => void;
  loading: boolean;
}) => {
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
    const player = players.find(p => p.id === playerId);
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
            {tables.map(t => (
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
const CashoutForm = ({ players, shiftId, onSubmit, loading }: {
  players: Tables<"players">[];
  shiftId: string;
  onSubmit: (data: Record<string, unknown>, opts?: Record<string, unknown>) => void;
  loading: boolean;
}) => {
  const [playerId, setPlayerId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const total = useMemo(() => chipSum(chips), [chips]);

  const handleSubmit = () => {
    if (!playerId || total <= 0) return;
    const player = players.find(p => p.id === playerId);
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
  expectedBalance: number;
  shiftId: string;
  exchangeRates: Record<string, number>;
  cashChecks: Tables<"cash_counts">[];
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
            {cashChecks.slice(0, 5).map(cc => (
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
const CloseTablesForm = ({ tables }: { tables: Tables<"gaming_tables">[] }) => {
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
            {distribution.length > 0 && (
              <div className="flex flex-wrap gap-1 ml-8">
                {distribution.map(({ denom, diff }) => (
                  <span key={denom} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${diff > 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    {denom}: {diff > 0 ? `+${diff}` : diff}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Button onClick={handleClose} disabled={!allConfirmed || closeAllTables.isPending} className="w-full gap-1.5">
        <CheckCircle2 className="w-4 h-4" /> {closeAllTables.isPending ? "Closing…" : "Close All Tables"}
      </Button>
    </div>
  );
};

export default ActiveShiftView;
