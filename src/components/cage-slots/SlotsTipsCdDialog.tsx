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
import { tipsBucketOf, TIPS_BUCKET_LABEL, type TipsBucket } from "@/lib/slots-tips-bucket";

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

  const tipsWithBucket = tips.map((t: any) => ({ ...t, bucket: tipsBucketOf(t.created_at) as TipsBucket }));
  const sumBy = (b: TipsBucket) => tipsWithBucket.filter((t: any) => t.bucket === b).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  const totalDay = sumBy("day");
  const totalEvening = sumBy("evening");
  const total = totalDay + totalEvening;

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
      description="Split into Day (13:00–21:10) and Evening (21:11–05:00) for separate cashier payout. Not part of the shift balance."
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
              <Button onClick={submit} disabled={!Number(amount) || create.isPending}>Add</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["day", "evening"] as TipsBucket[]).map((bucket) => {
            const rows = tipsWithBucket.filter((t: any) => t.bucket === bucket);
            const subtotal = bucket === "day" ? totalDay : totalEvening;
            return (
              <div key={bucket} className="cms-panel p-0 overflow-hidden">
                <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold border-b border-border bg-muted/40 flex items-center justify-between">
                  <span>{TIPS_BUCKET_LABEL[bucket]}</span>
                  <span className="font-mono">{formatNumberSpaces(subtotal)}</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-1.5">When</th>
                      <th className="text-right px-3 py-1.5">TZS</th>
                      <th className="text-left px-3 py-1.5">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={3} className="text-center text-muted-foreground py-4">·</td></tr>
                    )}
                    {rows.map((t: any) => (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatNumberSpaces(Number(t.amount))}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{t.note || "·"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {total > 0 && (
          <div className="cms-panel p-3 flex items-center justify-between text-sm font-bold">
            <span>Total Tips CD</span>
            <span className="font-mono">{formatNumberSpaces(total)} TZS</span>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
};

export default SlotsTipsCdDialog;
