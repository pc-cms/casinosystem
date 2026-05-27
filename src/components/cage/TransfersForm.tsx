import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight, Banknote, HandCoins, ArrowUpRight, ArrowDownLeft, Dice5, Coins, Check, Clock } from "lucide-react";
import ChipDenomInput from "@/components/ChipDenomInput";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { useCreateCageTransfer, useCageTransfers, type CageTransferType, cageTransferLabel } from "@/hooks/use-cage-transfers";
import { useApproveSlotsTransfer } from "@/hooks/use-cage-slots-transfers";
import { useAuth } from "@/lib/auth-context";
import { sumChips } from "@/hooks/use-chip-colors";
import { formatCurrency, formatNumberSpaces } from "@/lib/currency";
import type { Tables } from "@/integrations/supabase/types";

type Props = {
  shiftId: string;
  tables: Tables<"gaming_tables">[];
};

type Direction = "in" | "out";

const TYPE_OPTIONS: Array<{
  value: CageTransferType;
  label: string;
  icon: typeof Banknote;
  description: string;
  needsOverride: boolean;
  direction: Direction;
  /** Tailwind utility classes for the colored chip & active border. */
  tone: { bg: string; text: string; border: string; activeBg: string; activeBorder: string };
}> = [
  { value: "add_float", label: "Add Float", icon: Banknote, description: "Cash IN from manager safe", needsOverride: false, direction: "in",
    tone: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" } },
  { value: "collection", label: "Collection", icon: HandCoins, description: "Cash OUT to manager safe", needsOverride: true, direction: "out",
    tone: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", activeBg: "bg-red-500/15", activeBorder: "border-red-500/50" } },
  { value: "fill", label: "Fill (to Table)", icon: ArrowUpRight, description: "Chips OUT to table", needsOverride: false, direction: "out",
    tone: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", activeBg: "bg-amber-500/15", activeBorder: "border-amber-500/50" } },
  { value: "credit", label: "Credit (from Table)", icon: ArrowDownLeft, description: "Chips IN from table", needsOverride: false, direction: "in",
    tone: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30", activeBg: "bg-sky-500/15", activeBorder: "border-sky-500/50" } },
  { value: "slots_out", label: "Cage Slots OUT", icon: Dice5, description: "Cash OUT to slots cashier", needsOverride: false, direction: "out",
    tone: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", activeBg: "bg-orange-500/15", activeBorder: "border-orange-500/50" } },
  { value: "slots_in", label: "Cage Slots IN", icon: Coins, description: "Cash IN from slots cashier", needsOverride: false, direction: "in",
    tone: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/30", activeBg: "bg-teal-500/15", activeBorder: "border-teal-500/50" } },
];

const TYPE_MAP = new Map(TYPE_OPTIONS.map(o => [o.value, o]));

const TransfersForm = ({ shiftId, tables }: Props) => {
  const { user } = useAuth();
  const create = useCreateCageTransfer();
  const { data: transfers = [] } = useCageTransfers(shiftId);

  const [type, setType] = useState<CageTransferType>("add_float");
  const [amount, setAmount] = useState("");
  const [tableId, setTableId] = useState("");
  const [chips, setChips] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const cfg = TYPE_OPTIONS.find(t => t.value === type)!;
  const isChipFlow = type === "fill" || type === "credit";
  const chipsTotal = useMemo(() => sumChips(chips), [chips]);
  const finalAmount = isChipFlow ? chipsTotal : Number(amount) || 0;

  const tableMap = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables]);

  const reset = () => {
    setAmount(""); setChips({}); setNote(""); setTableId("");
  };

  const handleTypeChange = (next: CageTransferType) => {
    setType(next);
    reset();
  };

  const submit = (managerId: string) => {
    create.mutate({
      transfer_type: type,
      shift_id: shiftId,
      amount: finalAmount,
      table_id: isChipFlow ? tableId : null,
      chips: isChipFlow
        ? Object.fromEntries(Object.entries(chips).filter(([, q]) => q > 0).map(([d, q]) => [String(d), q]))
        : null,
      note,
      approved_by: managerId,
    }, {
      onSuccess: () => { reset(); setShowOverride(false); },
    });
  };

  const handleSubmit = () => {
    if (finalAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (isChipFlow && !tableId) {
      toast.error("Select a table");
      return;
    }
    if (!user) return;

    if (cfg.needsOverride) {
      setShowOverride(true);
    } else {
      submit(user.id);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3 items-stretch">
      {/* LEFT — form */}
      <div className="cms-panel p-4 space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">1. Transfer Type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTypeChange(opt.value)}
                  className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                    active
                      ? `${opt.tone.activeBorder} ${opt.tone.activeBg}`
                      : `${opt.tone.border} ${opt.tone.bg} hover:brightness-125`
                  }`}
                >
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

        {/* Cash flow form */}
        {!isChipFlow && (
          <div>
            <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 block">2. Amount (TZS)</label>
            <NumberInput
              value={amount}
              onChange={setAmount}
              className="text-xl h-12"
              placeholder="0"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
        )}

        {/* Chip flow form */}
        {isChipFlow && (
          <>
            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 block">2. Table</label>
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No open tables</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {tables.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTableId(t.id)}
                      className={`px-3 py-1.5 rounded text-sm font-mono shrink-0 transition-colors ${tableId === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-primary/20"}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">
                3. Chips {type === "fill" ? "to Send" : "to Receive"}
              </label>
              <ChipDenomInput
                values={chips}
                onChange={setChips}
                columns={2}
                size="lg"
                onSubmit={handleSubmit}
              />
            </div>
          </>
        )}

        {/* Note */}
        <div>
          <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5 block">Note (optional)</label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Reason / context…"
            className="text-sm resize-none"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={finalAmount <= 0 || (isChipFlow && !tableId) || create.isPending}
          className={`w-full gap-1.5 h-12 text-base font-bold ${cfg.tone.activeBg} ${cfg.tone.text} ${cfg.tone.activeBorder} border hover:brightness-110`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          {create.isPending ? "Recording…" : cfg.label} {finalAmount > 0 && `· ${formatCurrency(finalAmount)}`}
        </Button>

        {cfg.needsOverride && (
          <p className="text-xs text-warning text-center font-semibold">Manager Override required for {cfg.label}</p>
        )}
      </div>

      {/* RIGHT — list */}
      <div className="cms-panel">
        <div className="cms-header text-sm font-bold">Transfers ({transfers.length})</div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {["Type", "Table", "Amount", "Note", "Time"].map(h => (
                  <th key={h} className={`text-xs font-bold text-foreground uppercase px-3 py-2 ${h === "Amount" || h === "Time" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-6">No transfers yet</td></tr>
              ) : transfers.map(tr => {
                const t = tr.transfer_type as CageTransferType;
                const opt = TYPE_MAP.get(t);
                const positive = opt?.direction === "in";
                const tone = opt?.tone;
                return (
                  <tr key={tr.id} className={`border-b border-border last:border-0 ${positive ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${tone?.bg || "bg-muted"} ${tone?.text || "text-foreground"} ${tone?.border || "border-border"}`}>
                        {cageTransferLabel(t)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground font-mono">
                      {tr.table_id ? tableMap.get(tr.table_id)?.name || "—" : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-sm font-bold ${positive ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      {positive ? "+" : "−"}{formatNumberSpaces(Number(tr.amount))}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]">
                      {tr.note || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {new Date(tr.created_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit" })}
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
        title="Collection — Manager Override"
        description="Withdrawing cash from cage to manager safe requires manager authentication."
        actionType="CAGE_COLLECTION"
        actionDetails={{ amount: finalAmount, note }}
      />
    </div>
  );
};

const ApproveSlotsLinkedButton = ({ transferId, counterpartId }: { transferId: string; counterpartId: string | null }) => {
  const [open, setOpen] = useState(false);
  const approve = useApproveSlotsTransfer();
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 gap-1 text-[10px] font-bold border-amber-500/50 text-amber-500 hover:bg-amber-500/15"
        onClick={() => setOpen(true)}
        disabled={approve.isPending}
      >
        <Clock className="w-3 h-3" /> Approve
      </Button>
      <ManagerOverrideDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          // counterpartId is the slots-side row; we approve both sides.
          if (counterpartId) {
            approve.mutate({ id: counterpartId, counterpart_lg_id: transferId });
          }
          setOpen(false);
        }}
        title="Approve Slots Transfer"
        description="Confirm that the cash from the slots cashier has been received."
        actionType="CAGE_TRANSFER_APPROVE"
      />
    </>
  );
};

export default TransfersForm;
