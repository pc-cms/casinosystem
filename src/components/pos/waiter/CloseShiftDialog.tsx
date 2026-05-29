/**
 * Close POS shift: preview Z-report + enter closing cash → calls pos_close_shift RPC.
 * Server enforces: no open tabs, immutability after close, permission check.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormGrid } from "@/components/ui/form-grid";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { toast } from "@/hooks/use-toast";
import { formatNumberSpaces } from "@/lib/currency";
import {
  useClosePosShift,
  usePosZReportPreview,
  type PosShift,
  type PosZReport,
} from "@/hooks/use-pos-shift";
import ZReportView from "./ZReportView";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shift: PosShift | null;
  openTabsCount: number;
  onClosed: (z: PosZReport) => void;
}

export const CloseShiftDialog = ({ open, onOpenChange, shift, openTabsCount, onClosed }: Props) => {
  const closeMut = useClosePosShift();
  const { data: preview, isLoading } = usePosZReportPreview(shift?.id ?? null, open);
  const [closingCash, setClosingCash] = useState("0");

  useEffect(() => {
    if (open && preview) {
      setClosingCash(String(preview.expected_cash ?? 0));
    }
  }, [open, preview]);

  const previewWithCash: PosZReport | null = preview
    ? {
        ...preview,
        closing_cash: Math.round(Number(closingCash) || 0),
        cash_delta: Math.round(Number(closingCash) || 0) - preview.expected_cash,
      }
    : null;

  const canClose = openTabsCount === 0 && !!shift && !!preview && !closeMut.isPending;

  const handle = async () => {
    if (!shift) return;
    if (openTabsCount > 0) {
      toast({ title: "Close all open tabs first", variant: "destructive" });
      return;
    }
    try {
      const z = await closeMut.mutateAsync({
        shift_id: shift.id,
        closing_cash: Math.round(Number(closingCash) || 0),
      });
      toast({ title: "Shift closed" });
      onClosed(z);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed to close shift", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Close shift · Z-report" size="xl">
      <div className="space-y-4">
        {openTabsCount > 0 && (
          <div className="rounded-md bg-cms-amount-negative/10 text-cms-amount-negative px-3 py-2 text-sm">
            {openTabsCount} open tab(s) must be closed first.
          </div>
        )}

        <FormGrid>
          <FormField span={6} label="Closing cash in drawer">
            <Input
              type="number"
              inputMode="numeric"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              className="text-lg"
            />
          </FormField>
          <FormField span={6} label="Expected">
            <div className="h-10 flex items-center font-mono tabular-nums">
              {preview ? formatNumberSpaces(preview.expected_cash) : "—"} TZS
            </div>
          </FormField>
        </FormGrid>

        {isLoading && <div className="text-sm text-muted-foreground">Computing report…</div>}
        {previewWithCash && <ZReportView z={previewWithCash} />}

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handle} disabled={!canClose}>
            {closeMut.isPending ? "Closing…" : "Confirm & close shift"}
          </Button>
        </ResponsiveDialogFooter>
      </div>
    </ResponsiveDialog>
  );
};

export default CloseShiftDialog;
