import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCancelTransaction } from "@/hooks/use-cancel-transaction";
import { formatCurrency } from "@/lib/currency";

type Tx = {
  id: string;
  type: string;
  amount: number | string;
};

interface Props {
  tx: Tx | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CancelTransactionDialog({ tx, open, onOpenChange }: Props) {
  const [reason, setReason] = useState("");
  const cancel = useCancelTransaction();

  const submit = () => {
    if (!tx) return;
    if (reason.trim().length < 3) return;
    cancel.mutate(
      { id: tx.id, reason: reason.trim() },
      {
        onSuccess: () => {
          setReason("");
          onOpenChange(false);
        },
      },
    );
  };

  const isIn = tx?.type === "buy" || tx?.type === "in";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setReason(""); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Transaction</DialogTitle>
          <DialogDescription>
            The transaction stays in the list but is struck through and excluded from drop, cashout, balance and player stats. The cashier must re-enter the correct one.
          </DialogDescription>
        </DialogHeader>
        {tx && (
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-mono">{isIn ? "IN" : "OUT"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-mono">{formatCurrency(Number(tx.amount))}</span></div>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Reason (required)</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Entered 1 000 000 instead of 100 000, re-entering correct amount"
            rows={3}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep</Button>
          <Button variant="destructive" onClick={submit} disabled={reason.trim().length < 3 || cancel.isPending}>
            {cancel.isPending ? "Cancelling…" : "Cancel Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
