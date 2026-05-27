import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight, Banknote, HandCoins, ArrowDownLeft, ArrowUpRight, Check, Clock } from "lucide-react";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import {
  useSlotsTransfers, useCreateSlotsTransfer, useApproveSlotsTransfer,
  SLOTS_TRANSFER_LABEL, type SlotsTransferType,
} from "@/hooks/use-cage-slots-transfers";
import { useActiveShift } from "@/hooks/use-shift";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";

type Props = { shiftId: string };

type Tone = { bg: string; text: string; border: string; activeBg: string; activeBorder: string };

const TYPE_OPTIONS: Array<{
  value: SlotsTransferType; label: string; icon: typeof Banknote;
  description: string; needsOverride: boolean; isCross: boolean; tone: Tone;
}> = [
  { value: "fill", label: "Ace Fill", icon: Banknote, description: "ACE System Fill — cash IN from manager safe",
    needsOverride: false, isCross: false,
    tone: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" } },
  { value: "collection", label: "Collect", icon: HandCoins, description: "Cash OUT to manager safe",
    needsOverride: true, isCross: false,
    tone: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", activeBg: "bg-red-500/15", activeBorder: "border-red-500/50" } },
  { value: "lg_in", label: "Cage LG IN", icon: ArrowDownLeft, description: "Cash IN from Live Game cage",
    needsOverride: false, isCross: true,
    tone: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/30", activeBg: "bg-teal-500/15", activeBorder: "border-teal-500/50" } },
  { value: "lg_out", label: "Cage LG OUT", icon: ArrowUpRight, description: "Cash OUT to Live Game cage",
    needsOverride: false, isCross: true,
    tone: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", activeBg: "bg-orange-500/15", activeBorder: "border-orange-500/50" } },
];

const TYPE_MAP = new Map(TYPE_OPTIONS.map(o => [o.value, o]));

const SlotsTransfersForm = ({ shiftId }: Props) => {
  const { user } = useAuth();
  const { data: lgShift } = useActiveShift();
  const { data: transfers = [] } = useSlotsTransfers(shiftId);
  const create = useCreateSlotsTransfer();
  const approve = useApproveSlotsTransfer();

  const [type, setType] = useState<SlotsTransferType>("fill");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [approveOpen, setApproveOpen] = useState<null | { id: string; counterpart: string | null }>(null);

  const cfg = TYPE_OPTIONS.find(t => t.value === type)!;
  const finalAmount = Number(amount) || 0;

  const reset = () => { setAmount(""); setNote(""); };

  const submit = (managerId: string) => {
    create.mutate({
      cage_slots_shift_id: shiftId,
      transfer_type: type,
      amount: finalAmount,
      note,
      approved_by: managerId,
      counterpart_lg_shift_id: cfg.isCross ? (lgShift?.id ?? null) : null,
    }, { onSuccess: () => { reset(); setShowOverride(false); } });
  };

  const handleSubmit = () => {
    if (finalAmount <= 0) { toast.error("Amount must be greater than zero"); return; }
    if (cfg.isCross && !lgShift) { toast.error("No open Live Game shift to pair with"); return; }
    if (!user) return;
    if (cfg.needsOverride) setShowOverride(true);
    else submit(user.id);
  };

  const pendingIncoming = useMemo(
    () => transfers.filter(t => t.requires_approval && !t.approved_at && t.transfer_type === "lg_in").length,
    [transfers],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3 items-stretch">
      {/* LEFT — form */}
      <div className="cms-panel p-4 space-y-4">
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">1. Transfer Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = type === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => setType(opt.value)}
                  className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                    active ? `${opt.tone.activeBorder} ${opt.tone.activeBg}` : `${opt.tone.border} ${opt.tone.bg} hover:brightness-125`
                  }`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${opt.tone.text}`} />
                    <span className={`text-sm font-bold ${opt.tone.text}`}>{opt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-tight">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 block">2. Amount (TZS)</label>
          <NumberInput value={amount} onChange={setAmount} className="text-xl h-12" placeholder="0"
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>

        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 block">Note (optional)</label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Reason / context…" className="text-sm resize-none" />
        </div>

        <Button onClick={handleSubmit} disabled={finalAmount <= 0 || create.isPending}
          className={`w-full gap-1.5 h-12 text-base font-bold ${cfg.tone.activeBg} ${cfg.tone.text} ${cfg.tone.activeBorder} border hover:brightness-110`}>
          <ArrowLeftRight className="w-4 h-4" />
          {create.isPending ? "Recording…" : cfg.label} {finalAmount > 0 && `· ${formatCurrency(finalAmount)}`}
        </Button>

        {cfg.needsOverride && <p className="text-xs text-warning text-center font-semibold">Manager Override required for {cfg.label}</p>}
        {cfg.isCross && !lgShift && <p className="text-xs text-destructive text-center font-semibold">No open Live Game shift — can't pair</p>}
        {cfg.isCross && lgShift && <p className="text-[10px] text-muted-foreground text-center">Mirrored automatically to the Live Game cage.</p>}
      </div>

      {/* RIGHT — list */}
      <div className="cms-panel">
        <div className="cms-header text-sm font-bold flex items-center justify-between">
          <span>Transfers ({transfers.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {["Type", "Amount", "Note", "Time"].map(h => (
                  <th key={h} className={`text-xs font-bold text-foreground uppercase px-3 py-2 ${h === "Amount" || h === "Time" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted-foreground text-sm py-6">No transfers yet</td></tr>
              ) : transfers.map(tr => {
                const opt = TYPE_MAP.get(tr.transfer_type)!;
                const positive = tr.direction === "in";
                return (
                  <tr key={tr.id} className={`border-b border-border last:border-0 ${positive ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${opt.tone.bg} ${opt.tone.text} ${opt.tone.border}`}>
                        {SLOTS_TRANSFER_LABEL[tr.transfer_type]}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-sm font-bold ${positive ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      {positive ? "+" : "−"}{formatNumberSpaces(Number(tr.amount))}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[160px]">{tr.note || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {fmtDateTime(tr.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ManagerOverrideDialog
        open={showOverride}
        onClose={() => setShowOverride(false)}
        onConfirm={(managerId) => submit(managerId)}
        title="Collect — Manager Override"
        description="Withdrawing cash from the slots cage to manager safe requires manager authentication."
        actionType="CAGE_SLOTS_COLLECTION"
        actionDetails={{ amount: finalAmount, note }}
      />
    </div>
  );
};

export default SlotsTransfersForm;
