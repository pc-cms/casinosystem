import { useState } from "react";
import { useCMS } from "@/lib/cms-context";
import { CHIP_COLORS } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const Cage = () => {
  const { players, tables, addTransaction, transactions } = useCMS();
  const activePlayers = players.filter(p => p.status === "active");
  const openTables = tables.filter(t => t.status === "open");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cage</h1>
        <p className="text-sm text-muted-foreground">Buy-in & Cashout operations</p>
      </div>

      <Tabs defaultValue="buy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buy" className="gap-1.5">
            <ArrowDownToLine className="w-4 h-4" /> Buy-In
          </TabsTrigger>
          <TabsTrigger value="cashout" className="gap-1.5">
            <ArrowUpFromLine className="w-4 h-4" /> Cashout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <BuyInForm players={activePlayers} tables={openTables} onSubmit={addTransaction} />
        </TabsContent>

        <TabsContent value="cashout">
          <CashoutForm players={activePlayers} tables={openTables} onSubmit={addTransaction} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 cms-panel">
        <div className="cms-header">Today's Transactions</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Player</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Table</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-2">Amount</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No transactions</td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{tx.id}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${tx.type === "buy" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-card-foreground">{tx.playerName}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{tx.tableId || "—"}</td>
                    <td className={`px-4 py-2 text-right font-mono text-sm font-medium ${tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}`}>
                      €{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                      {new Date(tx.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const BuyInForm = ({ players, tables, onSubmit }: {
  players: any[]; tables: any[];
  onSubmit: (t: any) => void;
}) => {
  const [playerId, setPlayerId] = useState("");
  const [tableId, setTableId] = useState("");
  const [amount, setAmount] = useState("");

  const player = players.find(p => p.id === playerId);

  const handleSubmit = () => {
    if (!playerId || !tableId || !amount || Number(amount) <= 0) return;
    onSubmit({
      type: "buy",
      playerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : "",
      tableId,
      amount: Number(amount),
      operatorId: "OP1",
    });
    setAmount("");
  };

  return (
    <div className="cms-panel p-4 space-y-4 max-w-md">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Player</label>
        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
          <SelectContent>
            {players.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.nickname})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Table</label>
        <Select value={tableId} onValueChange={setTableId}>
          <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
          <SelectContent>
            {tables.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name} — {t.game}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount (€)</label>
        <Input
          type="number"
          min={0}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="font-mono"
          placeholder="0"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
      </div>
      <Button onClick={handleSubmit} disabled={!playerId || !tableId || !amount} className="w-full">
        <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Confirm Buy-In
      </Button>
    </div>
  );
};

const CashoutForm = ({ players, tables, onSubmit }: {
  players: any[]; tables: any[];
  onSubmit: (t: any) => void;
}) => {
  const [playerId, setPlayerId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const denominations = [5, 25, 100, 500, 1000, 5000];

  const player = players.find(p => p.id === playerId);
  const total = Object.entries(chips).reduce((sum, [denom, count]) => sum + Number(denom) * (count || 0), 0);

  const handleSubmit = () => {
    if (!playerId || total <= 0) return;
    onSubmit({
      type: "cashout",
      playerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : "",
      tableId: null,
      amount: total,
      chips,
      operatorId: "OP1",
    });
    setChips({});
  };

  return (
    <div className="cms-panel p-4 space-y-4 max-w-md">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Player</label>
        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
          <SelectContent>
            {players.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.nickname})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Chip Count</label>
        <div className="grid grid-cols-3 gap-2">
          {denominations.map(d => (
            <div key={d} className="flex items-center gap-2">
              <span className={`cms-chip ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>€{d}</span>
              <Input
                type="number"
                min={0}
                value={chips[d] || ""}
                onChange={e => setChips(c => ({ ...c, [d]: Number(e.target.value) || 0 }))}
                className="font-mono w-16 h-8 text-xs"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="cms-panel p-3 text-center">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total</p>
        <p className="text-2xl font-mono font-bold cms-amount-positive">€{total.toLocaleString()}</p>
      </div>

      <Button onClick={handleSubmit} disabled={!playerId || total <= 0} className="w-full">
        <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Confirm Cashout
      </Button>
    </div>
  );
};

export default Cage;
