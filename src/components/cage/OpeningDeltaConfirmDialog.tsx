import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Play } from "lucide-react";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { formatNumberSpaces, CHIP_DENOMS, formatChipLabel } from "@/lib/currency";

interface DiffRow { denom: number; expected: number; entered: number; delta: number }

interface Props {
  open: boolean;
  onClose: () => void;
  /** Per-denom chip diff (only rows where entered ≠ expected). */
  diff: DiffRow[];
  expectedTotal: number;
  enteredTotal: number;
  onConfirm: (override: { managerId: string; reason: string }) => void;
}

/**
 * OpeningDeltaConfirmDialog — blocks Open Shift when entered opening chips
 * differ from the expected baseline (last shift's closing). Requires a manager
 * override + a written reason. The override payload is forwarded to the caller
 * so it can be persisted in opening_float.chip_delta_override and audit log.
 */
const OpeningDeltaConfirmDialog = ({ open, onClose, diff, expectedTotal, enteredTotal, onConfirm }: Props) => {
  const [showOverride, setShowOverride] = useState(true);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const delta = enteredTotal - expectedTotal;

  const handleClose = () => {
    setShowOverride(true);
    setManagerId(null);
    setReason("");
    onClose();
  };

  const handleManagerConfirm = (id: string) => {
    setManagerId(id);
    setShowOverride(false);
  };

  const handleConfirm = () => {
    if (!managerId || !reason.trim()) return;
    onConfirm({ managerId, reason: reason.trim() });
    handleClose();
  };

  if (!open) return null;

  if (showOverride) {
    return (
      <ManagerOverrideDialog
        open
        onClose={handleClose}
        onConfirm={handleManagerConfirm}
        title="Opening Chips Mismatch"
        description="Entered opening chips do not match the expected baseline (last closing). Manager authentication is required to proceed."
        actionType="OPEN_SHIFT_CHIP_DELTA_OVERRIDE_REQUESTED"
        actionDetails={{ expected_tzs: expectedTotal, entered_tzs: enteredTotal, delta_tzs: delta }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Confirm Opening Chip Delta
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
          The opening chips you entered differ from the previous closing baseline.
          The override and reason will be saved in the audit log.
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Expected</p>
            <p className="font-mono font-bold">{formatNumberSpaces(expectedTotal)}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Entered</p>
            <p className="font-mono font-bold">{formatNumberSpaces(enteredTotal)}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Δ</p>
            <p className={`font-mono font-bold ${delta > 0 ? "cms-amount-positive" : delta < 0 ? "cms-amount-negative" : ""}`}>
              {delta > 0 ? "+" : ""}{formatNumberSpaces(delta)}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Per-denomination diff</p>
          <div className="rounded border border-border max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-2 py-1 font-medium text-muted-foreground">Chip</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground">Expected</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground">Entered</th>
                  <th className="text-right px-2 py-1 font-medium text-muted-foreground">Δ qty</th>
                </tr>
              </thead>
              <tbody>
                {diff.map(r => (
                  <tr key={r.denom} className="border-t border-border">
                    <td className="px-2 py-1"><span className="cms-chip-token">{formatChipLabel(r.denom)}</span></td>
                    <td className="px-2 py-1 text-right font-mono">{r.expected}</td>
                    <td className="px-2 py-1 text-right font-mono">{r.entered}</td>
                    <td className={`px-2 py-1 text-right font-mono font-bold ${r.delta > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      {r.delta > 0 ? "+" : ""}{r.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason (required)</p>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Explain why opening chips differ from the previous closing…"
            rows={2}
            className={`text-sm ${!reason.trim() ? "border-destructive/60 focus-visible:ring-destructive/40" : ""}`}
          />
          {!reason.trim() && (
            <p className="text-[10px] font-medium text-destructive flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Reason must be filled to open the shift
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()} className="gap-1.5">
            <Play className="w-4 h-4" /> Confirm & Open Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpeningDeltaConfirmDialog;
