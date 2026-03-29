import { useState } from "react";
import { toast } from "sonner";
import { usePlayers, useExpenses, useCreateExpense, useApproveExpense } from "@/hooks/use-casino-data";
import { useActiveShift } from "@/hooks/use-shift";
import { useExpenseAnalytics } from "@/hooks/use-expenses-analytics";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle } from "lucide-react";
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

/**
 * EXPENSES (STRICT):
 * - General or player-linked
 * - If player selected → expense belongs to player
 * - Cannot edit/delete
 * - REAL RESULT = CASHOUT - DROP - EXPENSES
 */
const Expenses = () => {
  const { isManager } = useAuth();
  const { data: shift } = useActiveShift();
  const { data: expenses = [] } = useExpenses();
  const { data: players = [] } = usePlayers();
  const approve = useApproveExpense();
  const [showAdd, setShowAdd] = useState(false);
  
  const [pendingOverride, setPendingOverride] = useState<string | null>(null);

  const analytics = useExpenseAnalytics(expenses as any);

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
          <p className="text-sm text-muted-foreground">Immutable · {expenses.length} records · {analytics.pendingCount} pending · {new Date().toLocaleDateString()}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Expense</Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total</p>
          <p className="font-mono text-lg font-bold text-card-foreground">{formatCurrency(analytics.totalAmount)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Approved</p>
          <p className="font-mono text-lg font-bold cms-amount-positive">{formatCurrency(analytics.approvedAmount)}</p>
        </div>
        <div className="cms-panel p-3">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Pending</p>
          <p className="font-mono text-lg font-bold text-accent">{formatCurrency(analytics.pendingAmount)}</p>
        </div>
      </div>
      </div>


      {/* Expenses Table */}
      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Category", "Description", "Target", "Amount", "Status", "Action"].map(h => (
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
                <td className="px-4 py-2 text-sm text-muted-foreground">{exp.players ? `${exp.players.first_name} ${exp.players.last_name}` : "General"}</td>
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

      <AddExpenseDialog open={showAdd} onClose={() => setShowAdd(false)} players={players} shiftId={shift?.id || null} />

      <ManagerOverrideDialog
        open={!!pendingOverride}
        onClose={() => setPendingOverride(null)}
        onConfirm={(managerId) => {
          if (pendingOverride) {
            approve.mutate(pendingOverride);
            setPendingOverride(null);
          }
        }}
        title="Approve Expense"
        description="Manager authentication required to approve this expense."
        actionType="APPROVE_EXPENSE"
        actionDetails={{ expense_id: pendingOverride }}
      />
    </div>
  );
};

const AddExpenseDialog = ({ open, onClose, players, shiftId }: { open: boolean; onClose: () => void; players: any[]; shiftId: string | null }) => {
  const create = useCreateExpense();
  const [form, setForm] = useState({ category: "", amount: "", description: "", player_id: "" });

  const handleSubmit = () => {
    if (!form.category || !form.amount) return;
    const amt = Number(form.amount);
    if (amt <= 0) { toast.error("Amount must be greater than zero"); return; }
    if (!shiftId) { toast.error("Cannot create expense without an active shift"); return; }
    create.mutate({ category: form.category, amount: amt, description: form.description, player_id: form.player_id || null, shift_id: shiftId },
      { onSuccess: () => { setForm({ category: "", amount: "", description: "", player_id: "" }); onClose(); } });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Cannot be edited or deleted after creation.</p>
        <div className="space-y-3">
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{CATS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <NumberInput placeholder="Amount (TZS)" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
          <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select value={form.player_id} onValueChange={v => setForm(f => ({ ...f, player_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Link to player (optional)" /></SelectTrigger>
            <SelectContent>{players.filter((p: any) => p.status === "active").map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.category || !form.amount || create.isPending}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Expenses;
