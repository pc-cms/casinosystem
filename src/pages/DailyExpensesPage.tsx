/**
 * Manager · Daily Expenses — full-day view across all sources (Live, Slots, Office).
 * Single "Add Expense" button with a source selector: live_game / slots / office.
 *  · live_game  → attached to the current open Live Game cashier shift
 *  · slots      → attached to the current open Slots cashier shift
 *  · office     → debits MAIN_CASH directly via create_office_expense RPC
 */
import { useMemo, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import { getBusinessDate } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { useDailyExpenses } from "@/hooks/use-daily-expenses";
import { useExpenseCategories, useCreateOfficeExpense } from "@/hooks/use-expense-categories";
import { useCreateExpense, useCreateSlotsExpense } from "@/hooks/use-expenses";
import { useActiveShift } from "@/hooks/use-shift";
import { useActiveCageSlotsShift } from "@/hooks/use-cage-slots";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type Source = "live_game" | "slots" | "office";

const srcOf = (r: any): Source => {
  const s = (r.source || (r.cage_type === "slots" ? "slots" : "live_game")).toLowerCase();
  if (s === "office") return "office";
  if (s === "slots") return "slots";
  return "live_game";
};

const DailyExpensesPage = () => {
  const { roles } = useAuth();
  const { data: serverDate } = useEffectiveBusinessDate();
  const [date, setDate] = useState<string>(() => serverDate || getBusinessDate());
  const [filter, setFilter] = useState<"all" | Source>("all");
  const [addOpen, setAddOpen] = useState(false);

  const canAdd =
    roles.includes("manager") ||
    roles.includes("finance_manager") ||
    roles.includes("super_admin") ||
    roles.includes("floor_manager");

  const { data: rows = [], isLoading } = useDailyExpenses(date);
  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r: any) => srcOf(r) === filter);
  }, [rows, filter]);
  const total = filtered.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <PageShell>
      <PageHeader icon={Receipt} title="Daily Expenses" subtitle="All sources · Live Game / Slots / Office" date>
        {canAdd && (
          <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-8"><Plus className="w-4 h-4" /> Add Expense</Button>
        )}
      </PageHeader>

      <div className="cms-panel">
        <div className="cms-header flex items-center justify-between flex-wrap gap-2">
          <span>{fmtDate(date)} · {filtered.length} entries</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftDate(-1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 px-2 text-xs rounded border border-border bg-background font-mono" />
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftDate(1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            <div className="mx-2 h-5 border-l border-border" />
            {(["all", "live_game", "slots", "office"] as const).map(s => (
              <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} className="h-7 text-[11px] uppercase" onClick={() => setFilter(s)}>{s.replace("_", " ")}</Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card">
              <tr className="border-b border-border">
                {["Time", "Source", "Category", "Amount", "Description", "Player", "Approved"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 uppercase text-muted-foreground ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</td></tr> :
               filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No expenses</td></tr> :
               filtered.map((r: any) => {
                const src = srcOf(r);
                const player = r.players ? `${r.players.first_name || ""} ${r.players.last_name || ""}`.trim() : r.player_name || "";
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{fmtDateTime(r.created_at).slice(-5)}</td>
                    <td className="px-3 py-2 uppercase text-[10px] font-bold">{src.replace("_", " ")}</td>
                    <td className="px-3 py-2 uppercase">{r.category_code || r.category}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatNumberSpaces(Number(r.amount || 0))}</td>
                    <td className="px-3 py-2 truncate max-w-[280px] text-muted-foreground">{r.description}</td>
                    <td className="px-3 py-2 text-muted-foreground">{player || "—"}</td>
                    <td className="px-3 py-2 text-center">{r.approved ? "✓" : ""}</td>
                  </tr>
                );
               })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td colSpan={3} className="px-3 py-2 text-right">TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">{formatNumberSpaces(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {addOpen && <AddExpenseDialog onClose={() => setAddOpen(false)} />}
    </PageShell>
  );
};

export default DailyExpensesPage;

const AddExpenseDialog = ({ onClose }: { onClose: () => void }) => {
  const [source, setSource] = useState<Source>("office");
  const { data: cats = [] } = useExpenseCategories(source);
  const { data: liveShift } = useActiveShift();
  const { data: slotsShift } = useActiveCageSlotsShift();

  const createOffice = useCreateOfficeExpense();
  const createLive = useCreateExpense();
  const createSlots = useCreateSlotsExpense();

  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const isPending = createOffice.isPending || createLive.isPending || createSlots.isPending;

  const submit = async () => {
    const amt = Number(amount);
    if (!category || !amt || amt <= 0) {
      toast.error("Category and amount are required");
      return;
    }
    try {
      if (source === "office") {
        await createOffice.mutateAsync({ category_code: category, amount: amt, description });
      } else if (source === "live_game") {
        if (!liveShift?.id) { toast.error("No open Live Game shift"); return; }
        await new Promise<void>((resolve, reject) => createLive.mutate(
          { category, amount: amt, description, player_id: null, player_name: "", shift_id: liveShift.id },
          { onSuccess: () => resolve(), onError: (e: any) => reject(e) },
        ));
      } else {
        if (!slotsShift?.id) { toast.error("No open Slots shift"); return; }
        await createSlots.mutateAsync({
          slots_shift_id: slotsShift.id, category, amount: amt, description, player_id: null, player_name: "",
        });
      }
      onClose();
    } catch { /* toast handled */ }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Source</label>
            <Select value={source} onValueChange={(v) => { setSource(v as Source); setCategory(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office (debits MAIN_CASH)</SelectItem>
                <SelectItem value="live_game">Live Game{liveShift ? "" : " (no open shift)"}</SelectItem>
                <SelectItem value="slots">Slots{slotsShift ? "" : " (no open shift)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {cats.filter(c => c.active).map(c => (
                  <SelectItem key={c.id} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount (TZS)</label>
            <Input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose / notes" />
          </div>
          {source === "office" && (
            <p className="text-[11px] text-muted-foreground">Office expenses debit MAIN_CASH automatically, do not affect Live/Slots cage balances, and require no approval.</p>
          )}
          {source === "live_game" && !liveShift && (
            <p className="text-[11px] text-destructive">No open Live Game shift — open one in Cage first.</p>
          )}
          {source === "slots" && !slotsShift && (
            <p className="text-[11px] text-destructive">No open Slots shift — open one in Cage Slots first.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || !category || !Number(amount)}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
