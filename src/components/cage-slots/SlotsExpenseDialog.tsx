import { useState } from "react";
import { toast } from "sonner";
import { Plus, Receipt, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerNameAutocomplete } from "@/components/PlayerNameAutocomplete";
import { useCreateSlotsExpense } from "@/hooks/use-expenses";

const CATS = [
  { value: "food", label: "Food" },
  { value: "alcohol", label: "Alcohol" },
  { value: "taxi", label: "Taxi" },
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" },
  { value: "other", label: "Other" },
];

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

interface Props {
  slotsShiftId: string;
  disabled?: boolean;
}

export const SlotsExpenseDialog = ({ slotsShiftId, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([newDraft()]);
  const create = useCreateSlotsExpense();

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
    try {
      await new Promise<void>((resolve, reject) => {
        create.mutate({
          slots_shift_id: slotsShiftId,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" disabled={disabled}>
          <Receipt className="w-3.5 h-3.5" /> Expenses
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Slots Cage Expenses</DialogTitle>
        </DialogHeader>

        <div className="cms-panel overflow-visible">
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
                      <Button size="sm" className="h-8 px-3" onClick={() => submitDraft(d.uid)} disabled={create.isPending}>
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
      </DialogContent>
    </Dialog>
  );
};

export default SlotsExpenseDialog;
