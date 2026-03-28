import { useState } from "react";
import { useCMS } from "@/lib/cms-context";
import { EXPENSE_CATEGORIES } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const Expenses = () => {
  const { expenses, players, addExpense, approveExpense } = useCMS();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">{expenses.length} records</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Category</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Description</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">Player</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3">Amount</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-4 py-3">Status</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No expenses</td></tr>
            ) : (
              expenses.map(exp => (
                <tr key={exp.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-[10px] font-mono uppercase">{exp.category}</Badge>
                  </td>
                  <td className="px-4 py-2 text-sm text-card-foreground">{exp.description}</td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{exp.playerName || "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm text-card-foreground">€{exp.amount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center">
                    {exp.approved ? (
                      <span className="cms-status-active"><CheckCircle className="w-3 h-3" /> Approved</span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {!exp.approved && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => approveExpense(exp.id, "MANAGER")}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddExpenseDialog open={showAdd} onClose={() => setShowAdd(false)} players={players} onAdd={addExpense} />
    </div>
  );
};

const AddExpenseDialog = ({ open, onClose, players, onAdd }: {
  open: boolean; onClose: () => void; players: any[]; onAdd: any;
}) => {
  const [form, setForm] = useState({ category: "", amount: "", description: "", playerId: "" });

  const handleSubmit = () => {
    if (!form.category || !form.amount) return;
    const player = players.find((p: any) => p.id === form.playerId);
    onAdd({
      category: form.category,
      amount: Number(form.amount),
      description: form.description,
      playerId: form.playerId || null,
      playerName: player ? `${player.firstName} ${player.lastName}` : null,
    });
    setForm({ category: "", amount: "", description: "", playerId: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Amount (€)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="font-mono" />
          <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select value={form.playerId} onValueChange={v => setForm(f => ({ ...f, playerId: v }))}>
            <SelectTrigger><SelectValue placeholder="Link to player (optional)" /></SelectTrigger>
            <SelectContent>
              {players.filter((p: any) => p.status === "active").map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.category || !form.amount}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Expenses;
