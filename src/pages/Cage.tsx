import { useState } from "react";
import { usePlayers, useGamingTables, useTransactions, useCreateTransaction } from "@/hooks/use-casino-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const CHIP_COLORS: Record<number, string> = {
  5: "bg-red-600 text-white", 25: "bg-green-600 text-white",
  100: "bg-black text-white border border-white/20", 500: "bg-purple-600 text-white",
  1000: "bg-yellow-500 text-black", 5000: "bg-orange-500 text-white",
};

const Cage = () => {
  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions();
  const createTx = useCreateTransaction();

  const activePlayers = players.filter(p => p.status === "active");
  const openTables = tables.filter(t => t.status === "open");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cage</h1>
        <p className="text-sm text-muted-foreground">Buy-in & Cashout — Immutable transactions</p>
      </div>

      <Tabs defaultValue="buy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1.5"><ArrowDownToLine className="w-4 h-4" /> Buy-In</TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1.5"><ArrowUpFromLine className="w-4 h-4" /> Cashout</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuyInForm players={activePlayers} tables={openTables} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
        <TabsContent value="cashout">
          <CashoutForm players={activePlayers} onSubmit={createTx.mutate} loading={createTx.isPending} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 cms-panel">
        <div className="cms-header">Today's Transactions</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Type", "Player", "Table", "Amount", "Time"].map(h => (
                  <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-4 py-2 ${h === "Amount" || h === "Time" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">No transactions</td></tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {tx.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-card-foreground">{(tx as any).players?.first_name} {(tx as any).players?.last_name}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{(tx as any).gaming_tables?.name || "—"}</td>
                  <td className={`px-4 py-2 text-right font-mono text-sm font-medium ${tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}`}>
                    €{Number(tx.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
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

const BuyInForm = ({ players, tables, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [tableId, setTableId] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = () => {
    if (!playerId || !tableId || !amount || Number(amount) <= 0) return;
    onSubmit({ player_id: playerId, table_id: tableId, type: "buy" as const, amount: Number(amount) },
      { onSuccess: () => setAmount("") });
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
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount (€)</label>
        <Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="font-mono" placeholder="0"
          onKeyDown={e => e.key === "Enter" && handleSubmit()} />
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || !tableId || !amount || loading} className="w-full">
        <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Confirm Buy-In
      </Button>
    </div>
  );
};

const CashoutForm = ({ players, onSubmit, loading }: any) => {
  const [playerId, setPlayerId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const denoms = [5, 25, 100, 500, 1000, 5000];
  const total = Object.entries(chips).reduce((sum, [d, c]) => sum + Number(d) * (c || 0), 0);

  const handleSubmit = () => {
    if (!playerId || total <= 0) return;
    onSubmit({ player_id: playerId, table_id: null, type: "cashout" as const, amount: total, chips },
      { onSuccess: () => setChips({}) });
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
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Chip Count</label>
        <div className="grid grid-cols-3 gap-2">
          {denoms.map(d => (
            <div key={d} className="flex items-center gap-2">
              <span className={`cms-chip ${CHIP_COLORS[d] || ""}`}>€{d}</span>
              <Input type="number" min={0} value={chips[d] || ""} onChange={e => setChips(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                className="font-mono w-16 h-8 text-xs" placeholder="0" />
            </div>
          ))}
        </div>
      </div>
      <div className="cms-panel p-3 text-center">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total</p>
        <p className="text-2xl font-mono font-bold cms-amount-positive">€{total.toLocaleString()}</p>
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || total <= 0 || loading} className="w-full">
        <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Confirm Cashout
      </Button>
    </div>
  );
};

export default Cage;
