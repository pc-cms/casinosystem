import { useState } from "react";
import { usePlayers, useExpenses, useCreateExpense, useApproveExpense } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CATS = [
  { value: "food", label: "Food" }, { value: "alcohol", label: "Alcohol" },
  { value: "taxi", label: "Taxi" }, { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" }, { value: "other", label: "Other" },
];

const Expenses = () => {
  const { isManager } = useAuth();
  const { data: expenses = [] } = useExpenses();
  const { data: players = [] } = usePlayers();
  const approve = useApproveExpense();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">{expenses.length} records · Manager approval required</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Expense</Button>
      </div>

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
            {expenses.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No expenses</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2"><Badge variant="outline" className="text-[10px] font-mono uppercase">{exp.category}</Badge></td>
                <td className="px-4 py-2 text-sm text-card-foreground">{exp.description}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground">{(exp as any).players ? `${(exp as any).players.first_name} ${(exp as any).players.last_name}` : "—"}</td>
                <td className="px-4 py-2 text-right font-mono text-sm text-card-foreground">€{Number(exp.amount).toLocaleString()}</td>
                <td className="px-4 py-2 text-center">
                  {exp.approved ? <span className="cms-status-active"><CheckCircle className="w-3 h-3" /> Approved</span> : <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                </td>
                <td className="px-4 py-2 text-center">
                  {!exp.approved && isManager && <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => approve.mutate(exp.id)}>Approve</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddExpenseDialog open={showAdd} onClose={() => setShowAdd(false)} players={players} />
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
          <Input type="number" placeholder="Amount (€)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="font-mono" />
          <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select value={form.player_id} onValueChange={v => setForm(f => ({ ...f, player_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Link to player (optional)" /></SelectTrigger>
            <SelectContent>{players.filter(p => p.status === "active").map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
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
