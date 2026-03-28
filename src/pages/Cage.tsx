import { useState, useMemo } from "react";
import { usePlayers, useGamingTables, useTransactions, useCreateTransaction } from "@/hooks/use-casino-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, ArrowUpFromLine, Calculator } from "lucide-react";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel, formatCurrency } from "@/lib/currency";

const Cage = () => {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions(date);
  const createTx = useCreateTransaction();

  const activePlayers = players.filter(p => p.status === "active");
  const openTables = tables.filter(t => t.status === "open");

  // Cash balance calculation
  const totalBuyIns = useMemo(() =>
    transactions.filter(t => t.type === "buy").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const totalCashouts = useMemo(() =>
    transactions.filter(t => t.type === "cashout").reduce((s, t) => s + Number(t.amount), 0), [transactions]);
  const expectedBalance = totalBuyIns - totalCashouts;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cage</h1>
          <p className="text-sm text-muted-foreground">Buy-in & Cashout — Immutable transactions</p>
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44 font-mono" />
      </div>

      {/* Cash Balance Summary */}
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

      <Tabs defaultValue="buy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1.5"><ArrowDownToLine className="w-4 h-4" /> Buy-In</TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1.5"><ArrowUpFromLine className="w-4 h-4" /> Cashout</TabsTrigger>
          <TabsTrigger value="balance" className="gap-1.5"><Calculator className="w-4 h-4" /> Cash Check</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuyInForm players={activePlayers} tables={openTables} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="cashout">
          <CashoutForm players={activePlayers} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="balance">
          <CashCheckForm expectedBalance={expectedBalance} />
        </TabsContent>
      </Tabs>

      {/* Transaction Log */}
      <div className="mt-8 cms-panel">
        <div className="cms-header">Today's Transactions</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["#", "Type", "Player", "Table", "Amount", "Time"].map(h => (
                  <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-4 py-2 ${h === "Amount" || h === "Time" ? "text-right" : h === "#" ? "text-center w-12" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No transactions</td></tr>
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
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * BUY-IN: Cashier inputs Player, Table (analytics only), Amount.
 * NO chip denominations — system records total amount only.
 */
const BuyInForm = ({ players, tables, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [tableId, setTableId] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = () => {
    if (!playerId || !tableId || !amount || Number(amount) <= 0) return;
    onSubmit(
      { player_id: playerId, table_id: tableId, type: "buy" as const, amount: Number(amount) },
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
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Table (for analytics)</label>
        <Select value={tableId} onValueChange={setTableId}>
          <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
          <SelectContent>{tables.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} — {t.game}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount (TZS)</label>
        <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-lg" placeholder="0"
          onKeyDown={e => e.key === "Enter" && handleSubmit()} />
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || !tableId || !amount || Number(amount) <= 0 || loading} className="w-full">
        <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Record Buy-In
      </Button>
    </div>
  );
};

/**
 * CASHOUT: Cashier inputs chip denominations.
 * System calculates total. Cashier gives money based on result.
 */
const CashoutForm = ({ players, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const total = Object.entries(chips).reduce((sum, [d, c]) => sum + Number(d) * (c || 0), 0);

  const handleSubmit = () => {
    if (!playerId || total <= 0) return;
    onSubmit(
      { player_id: playerId, table_id: null, type: "cashout" as const, amount: total, chips },
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

/**
 * CASH CHECK: Manual denomination count to verify expected balance.
 * System logs snapshot — does NOT correct anything.
 */
const CashCheckForm = ({ expectedBalance }: { expectedBalance: number }) => {
  const [chips, setChips] = useState<Record<number, number>>({});
  const realBalance = Object.entries(chips).reduce((sum, [d, c]) => sum + Number(d) * (c || 0), 0);
  const difference = realBalance - expectedBalance;

  return (
    <div className="cms-panel p-4 space-y-4 max-w-lg">
      <p className="text-xs text-muted-foreground">Count physical cash by denomination. System compares to expected balance.</p>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Physical Cash Count</label>
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
      <div className="grid grid-cols-3 gap-3">
        <div className="cms-panel p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Expected</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(expectedBalance)}</p>
        </div>
        <div className="cms-panel p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Counted</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(realBalance)}</p>
        </div>
        <div className="cms-panel p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Difference</p>
          <p className={`font-mono text-sm font-bold ${difference === 0 ? "text-card-foreground" : difference > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
            {difference >= 0 ? "+" : ""}{formatCurrency(difference)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Cage;
