/**
 * SlotsTipsCdDialog — record a Cash Desk tip entry for a slots shift.
 * Each entry is an immutable audit row; shown separately in the print report
 * and NEVER folded into the shift balance or CDR.
 */
import { useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { useSlotsTipsCd, useCreateSlotsTipsCd } from "@/hooks/use-slots-tips-cd";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shiftId: string;
  readOnly?: boolean;
}

const SlotsTipsCdDialog = ({ open, onOpenChange, shiftId, readOnly }: Props) => {
  const { data: tips = [] } = useSlotsTipsCd(open ? shiftId : undefined);
  const create = useCreateSlotsTipsCd();
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const total = tips.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  const submit = async () => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return;
    await create.mutateAsync({ shift_id: shiftId, amount: amt, note });
    setAmount("");
    setNote("");
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tips CD · Cash Desk Tips"
      description="Recorded separately for the printed report. Not part of the shift balance."
      size="lg"
    >
      <div className="space-y-4">
        {!readOnly && (
          <div className="cms-panel p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-end">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Amount (TZS)</p>
                <NumberInput value={amount} onChange={setAmount} min={0} />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Note (optional)</p>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. table 5 dealer pool" />
              </div>
              <Button onClick={submit} disabled={!amount || create.isPending}>Add</Button>
            </div>
          </div>
        )}

        <div className="cms-panel p-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-1.5">When</th>
                <th className="text-right px-3 py-1.5">Amount (TZS)</th>
                <th className="text-left px-3 py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {tips.length === 0 && (
                <tr><td colSpan={3} className="text-center text-muted-foreground py-4">·</td></tr>
              )}
              {tips.map((t: any) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatNumberSpaces(Number(t.amount))}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{t.note || "·"}</td>
                </tr>
              ))}
              {tips.length > 0 && (
                <tr className="font-bold border-t-2 border-border">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right font-mono">{formatNumberSpaces(total)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ResponsiveDialog>
  );
};

export default SlotsTipsCdDialog;
