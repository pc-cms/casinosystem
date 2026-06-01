/**
 * SlotsTipsCdPayoutDialog — record an actual Cash Desk tips PAYOUT for a
 * specific bucket (Day / Evening). One payout per bucket per shift (DB unique).
 *
 * The cashier types the FACT ACTUALLY paid out — may differ from collected
 * (e.g. cashier topped up from own pocket to cover a shortfall). The collected
 * amount is recorded alongside for audit.
 */
import { useEffect, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { formatNumberSpaces } from "@/lib/currency";
import { useCashOutSlotsTipsCd } from "@/hooks/use-slots-tips-cd-payouts";
import { TIPS_BUCKET_LABEL, type TipsBucket } from "@/lib/slots-tips-bucket";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shiftId: string;
  bucket: TipsBucket;
  collectedAmount: number;
}

const SlotsTipsCdPayoutDialog = ({ open, onOpenChange, shiftId, bucket, collectedAmount }: Props) => {
  const create = useCashOutSlotsTipsCd();
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open) {
      setAmount(String(collectedAmount));
      setNote("");
    }
  }, [open, collectedAmount]);

  const amt = Number(amount) || 0;
  const delta = amt - collectedAmount;

  const submit = async () => {
    if (amt < 0) return;
    await create.mutateAsync({
      shift_id: shiftId,
      bucket,
      amount: amt,
      collected_amount: collectedAmount,
      note,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cash Out · ${TIPS_BUCKET_LABEL[bucket]}`}
      description="Money physically leaves the cage now. Enter the amount actually paid out."
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Collected</p>
            <p className="font-mono text-base">{formatNumberSpaces(collectedAmount)}</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Paying out</p>
            <p className="font-mono text-base">{formatNumberSpaces(amt)}</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Delta</p>
            <p className={`font-mono text-base ${delta === 0 ? "" : delta > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
              {delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${formatNumberSpaces(delta)}`}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Actual payout (TZS)</p>
          <NumberInput value={amount} onChange={setAmount} min={0} />
          {delta !== 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              {delta > 0
                ? "Paying more than collected — cashier covering shortfall from own funds."
                : "Paying less than collected — leftover stays in cage as surplus."}
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Note (optional)</p>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. dealer pool, top-up reason…" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={amt < 0 || create.isPending}>
            Confirm Cash Out
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
};

export default SlotsTipsCdPayoutDialog;
