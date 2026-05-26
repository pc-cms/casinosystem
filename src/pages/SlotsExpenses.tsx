import { useState } from "react";
import { toast } from "sonner";
import { Receipt, CheckCircle, Plus, X, Trash2 } from "lucide-react";
import { CardSkeleton, TableSkeleton } from "@/components/LoadingSkeletons";
import { useApproveExpense, useDeleteExpense } from "@/hooks/use-casino-data";
import { useSlotsExpenses, useCreateSlotsExpense } from "@/hooks/use-expenses";
import { useActiveCageSlotsShift } from "@/hooks/use-cage-slots";
import { useExpenseAnalytics } from "@/hooks/use-expenses-analytics";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlayerNameAutocomplete } from "@/components/PlayerNameAutocomplete";
import { formatCurrency } from "@/lib/currency";

const CATS = [
  { value: "food", label: "Food" },
  { value: "alcohol", label: "Alcohol" },
  { value: "taxi", label: "Taxi" },
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" },
  { value: "other", label: "Other" },
];

const CAT_COLORS: Record<string, string> = {
  food: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  alcohol: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  taxi: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  hotel: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  flight: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  other: "bg-muted text-muted-foreground",
};

interface DraftRow {
  uid: string;
  target: "casino" | "player" | "";
  player_name: string;
  category: string;
  amount: string;
  description: string;
}

const newDraft = (): DraftRow => ({
  uid: Math.random().toString(36).slice(2),
  target: "",
  player_name: "",
  category: "",
  amount: "",
  description: "",
});

const SlotsExpenses = () => {
  const { isManager } = useAuth();
  const { data: shift, isLoading: loadingShift } = useActiveCageSlotsShift();
  const { data: expenses = [], isLoading: loadingExpenses } = useSlotsExpenses(shift?.id);
  const create = useCreateSlotsExpense();
  const approve = useApproveExpense();
  const del = useDeleteExpense();
  const [drafts, setDrafts] = useState<DraftRow[]>([newDraft()]);

  const isLoading = loadingShift || loadingExpenses;
  const analytics = useExpenseAnalytics(expenses as any);

  const updateDraft = (uid: string, patch: Partial<DraftRow>) =>
    setDrafts(d => d.map(r => (r.uid === uid ? { ...r, ...patch } : r)));

  const removeDraft = (uid: string) =>
    setDrafts(d => (d.length > 1 ? d.filter(r => r.uid !== uid) : d));

  const submitDraft = async (uid: string) => {
    const row = drafts.find(r => r.uid === uid);
    if (!row) return;
    if (!row.target) return toast.error("Choose target");
    if (row.target === "player" && !row.player_name.trim()) return toast.error("Enter player name");
    if (!row.category) return toast.error("Choose category");
    const amt = Number(row.amount);
    if (!amt || amt <= 0) return toast.error("Amount must be > 0");
    if (!shift?.id) return toast.error("No active slots shift");
    try {
      await new Promise<void>((resolve, reject) => {
        create.mutate({
          slots_shift_id: shift.id,
          category: row.category,
          amount: amt,
          description: row.description,
          player_id: null,
          player_name: row.target === "player" ? row.player_name.trim() : "",
        }, { onSuccess: () => resolve(), onError: (e: any) => reject(e) });
      });
      setDrafts(d => [...d.filter(r => r.uid !== uid), newDraft()]);
    } catch {/* toast handled */}
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Receipt} title="Slots Expenses" subtitle="Loading…" />
        <CardSkeleton count={3} />
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={Receipt}
        title="Slots Expenses"
        subtitle={shift
          ? `Immutable · ${expenses.length} records · ${analytics.pendingCount} pending`
          : "No active slots shift — open a shift in Cage Slots to record expenses."}
        date
      />

      {/* KPI cards */}
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
          <p className="font-mono text-lg font-bold text-accent">{analytics.pendingCount}</p>
        </div>
      </div>

      {/* Entry table */}
      <div className="cms-panel overflow-visible mb-6">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">New entries</h3>
          <Button size="sm" variant="outline" onClick={() => setDrafts(d => [...d, newDraft()])} className="h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Row
          </Button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Target</th>
              <th className="text-left px-3 py-2">Player</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-right px-3 py-2">Amount (TZS)</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-center px-3 py-2 w-[140px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map(d => (
              <tr key={d.uid} className="border-b border-border last:border-0">
                <td className="px-2 py-1.5">
                  <Select
                    value={d.target}
                    onValueChange={v => updateDraft(d.uid, { target: v as "casino" | "player", player_name: "" })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Target" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casino">Casino</SelectItem>
                      <SelectItem value="player">Player</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <PlayerNameAutocomplete
                    placeholder={d.target === "player" ? "Player name" : "—"}
                    value={d.player_name}
                    onChange={v => updateDraft(d.uid, { player_name: v })}
                    disabled={d.target !== "player"}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select value={d.category} onValueChange={v => updateDraft(d.uid, { category: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      {CATS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <NumberInput placeholder="0" value={d.amount} onChange={v => updateDraft(d.uid, { amount: v })} className="h-8 text-xs text-right" />
                </td>
                <td className="px-2 py-1.5">
                  <Input placeholder="Description" value={d.description} onChange={e => updateDraft(d.uid, { description: e.target.value })} className="h-8 text-xs" />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="inline-flex gap-1">
                    <Button size="sm" className="h-8 px-3" onClick={() => submitDraft(d.uid)} disabled={create.isPending || !shift}>
                      OK
                    </Button>
                    {drafts.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeDraft(d.uid)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History */}
      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Target</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-center px-3 py-2">Status</th>
              <th className="text-center px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {analytics.filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-8">No expenses for this shift</td></tr>
            ) : analytics.filtered.map((exp: any) => (
              <tr key={exp.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                  {new Date(exp.created_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${CAT_COLORS[exp.category] || CAT_COLORS.other}`}>{exp.category}</span>
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">
                  {exp.players ? `${exp.players.first_name} ${exp.players.last_name}` : (exp.player_name || "Casino")}
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm cms-amount-negative">
                  {formatCurrency(Number(exp.amount))}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{exp.description || "—"}</td>
                <td className="px-3 py-2 text-center">
                  {exp.approved ? (
                    <span className="cms-status-active text-xs"><CheckCircle className="w-3 h-3 inline mr-0.5" /> Approved</span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="inline-flex gap-1">
                    {!exp.approved && isManager && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => approve.mutate(exp.id)} disabled={approve.isPending}>Approve</Button>
                    )}
                    {!exp.approved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate({ id: exp.id, amount: Number(exp.amount), category: exp.category })}
                        title="Cancel expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SlotsExpenses;
