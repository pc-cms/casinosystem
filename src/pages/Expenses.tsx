import { useState } from "react";
import { usePlayers, useExpenses, useCreateExpense, useApproveExpense } from "@/hooks/use-casino-data";
import { useExpenseAnalytics } from "@/hooks/use-expenses-analytics";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { formatCurrency } from "@/lib/currency";

const CATS = [
  { value: "food", label: "Food" }, { value: "alcohol", label: "Alcohol" },
  { value: "taxi", label: "Taxi" }, { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" }, { value: "other", label: "Other" },
];

const CAT_COLORS: Record<string, string> = {
  food: "bg-emerald-500/15 text-emerald-400",
  alcohol: "bg-purple-500/15 text-purple-400",
  taxi: "bg-yellow-500/15 text-yellow-400",
  hotel: "bg-blue-500/15 text-blue-400",
  flight: "bg-sky-500/15 text-sky-400",
  other: "bg-muted text-muted-foreground",
};

const Expenses = () => {
  const { isManager } = useAuth();
  const { data: expenses = [] } = useExpenses();
  const { data: players = [] } = usePlayers();
  const approve = useApproveExpense();
  const [showAdd, setShowAdd] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [pendingOverride, setPendingOverride] = useState<string | null>(null);

  const analytics = useExpenseAnalytics(expenses as any, dateRange.from ? dateRange : undefined);

  const handleApprove = (id: string) => {
    if (isManager) {
      setPendingOverride(id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">{expenses.length} records · {analytics.pendingCount} pending</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Expense</Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{formatCurrency(analytics.totalAmount)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Approved</p>
          <p className="font-mono text-lg font-bold text-emerald-400">{formatCurrency(analytics.approvedAmount)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Pending</p>
          <p className="font-mono text-lg font-bold text-yellow-400">{formatCurrency(analytics.pendingAmount)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Categories</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{Object.keys(analytics.byCategory).length}</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex gap-2 mb-4">
        <Input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-40 font-mono text-xs" placeholder="From" />
        <Input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-40 font-mono text-xs" placeholder="To" />
        {(dateRange.from || dateRange.to) && (
          <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: "", to: "" })}>Clear</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Category Breakdown */}
        <div className="cms-panel p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> By Category
          </h3>
          <div className="space-y-2">
            {Object.entries(analytics.byCategory).sort((a, b) => b[1].total - a[1].total).map(([cat, data]) => (
              <div key={cat} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${CAT_COLORS[cat] || CAT_COLORS.other}`}>{cat}</span>
                  <span className="text-xs text-muted-foreground">×{data.count}</span>
                </div>
                <span className="font-mono text-sm text-card-foreground">{formatCurrency(data.total)}</span>
              </div>
            ))}
            {Object.keys(analytics.byCategory).length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
          </div>
        </div>

        {/* Top Players */}
        <div className="cms-panel p-4 lg:col-span-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Top Players by Expenses</h3>
          <div className="space-y-2">
            {analytics.topPlayers.map(([pid, data]) => (
              <div key={pid} className="flex items-center justify-between">
                <span className="text-sm text-card-foreground">{data.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">×{data.count}</span>
                  <span className="font-mono text-sm font-medium text-card-foreground">{formatCurrency(data.total)}</span>
                </div>
              </div>
            ))}
            {analytics.topPlayers.length === 0 && <p className="text-xs text-muted-foreground">No player-linked expenses</p>}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Category", "Description", "Player", "Amount", "Status", "Action"].map(h => (
                <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-4 py-3 ${h === "Amount" ? "text-right" : h === "Status" || h === "Action" ? "text-center" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analytics.filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No expenses</td></tr>
            ) : analytics.filtered.map(exp => (
              <tr key={exp.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${CAT_COLORS[exp.category] || CAT_COLORS.other}`}>{exp.category}</span>
                </td>
                <td className="px-4 py-2 text-sm text-card-foreground">{(exp as any).description || "—"}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground">{exp.players ? `${exp.players.first_name} ${exp.players.last_name}` : "—"}</td>
                <td className="px-4 py-2 text-right font-mono text-sm text-card-foreground">{formatCurrency(Number(exp.amount))}</td>
                <td className="px-4 py-2 text-center">
                  {exp.approved ? <span className="cms-status-active text-xs"><CheckCircle className="w-3 h-3 inline mr-0.5" /> Approved</span> : <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                </td>
                <td className="px-4 py-2 text-center">
                  {!exp.approved && isManager && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleApprove(exp.id)}>Approve</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddExpenseDialog open={showAdd} onClose={() => setShowAdd(false)} players={players} />

      <ManagerOverrideDialog
        open={!!pendingOverride}
        onClose={() => setPendingOverride(null)}
        onConfirm={() => {
          if (pendingOverride) {
            approve.mutate(pendingOverride);
            setPendingOverride(null);
          }
        }}
        title="Approve Expense"
        description="Manager authentication required to approve this expense."
      />
    </div>
  );
};

const AddExpenseDialog = ({ open, onClose, players }: { open: boolean; onClose: () => void; players: any[] }) => {
  const create = useCreateExpense();
  const [form, setForm] = useState({ category: "", amount: "", description: "", player_id: "" });

  const handleSubmit = () => {
    if (!form.category || !form.amount) return;
    create.mutate({ category: form.category, amount: Number(form.amount), description: form.description, player_id: form.player_id || null },
      { onSuccess: () => { setForm({ category: "", amount: "", description: "", player_id: "" }); onClose(); } });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{CATS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" placeholder="Amount (TZS)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="font-mono" />
          <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select value={form.player_id} onValueChange={v => setForm(f => ({ ...f, player_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Link to player (optional)" /></SelectTrigger>
            <SelectContent>{players.filter((p: any) => p.status === "active").map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.category || !form.amount || create.isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Expenses;
