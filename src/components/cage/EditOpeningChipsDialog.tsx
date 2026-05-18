import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, ShieldAlert } from "lucide-react";
import ChipDenomInput from "@/components/ChipDenomInput";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { formatNumberSpaces, CHIP_DENOMS } from "@/lib/currency";
import { chipSum } from "@/components/cage/CageHelpers";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  shift: Tables<"shifts">;
  open: boolean;
  onClose: () => void;
}

/**
 * EditOpeningChipsDialog — manager-only edit of opening chip counts on an
 * already-open cage shift. Records a full diff to activity_logs.
 * ONLY chips are editable — cash, mobile, bank are untouched.
 */
const EditOpeningChipsDialog = ({ shift, open, onClose }: Props) => {
  const { casinoId } = useAuth();
  const qc = useQueryClient();

  const initialChips = useMemo(() => {
    const of = (shift.opening_float || {}) as Record<string, any>;
    const raw = (of.chips || {}) as Record<string, number>;
    const out: Record<number, number> = {};
    CHIP_DENOMS.forEach(d => { out[d] = Number(raw[d] || raw[String(d)] || 0); });
    return out;
  }, [shift.opening_float]);

  const [showOverride, setShowOverride] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [chips, setChips] = useState<Record<number, number>>(initialChips);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when dialog re-opens
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setShowOverride(true);
      setUnlocked(false);
      setManagerId(null);
      setChips(initialChips);
      setReason("");
      onClose();
    }
  };

  const handleConfirmOverride = (mgrId: string) => {
    setManagerId(mgrId);
    setUnlocked(true);
    setShowOverride(false);
    setChips(initialChips);
  };

  const newTotal = useMemo(() => chipSum(chips), [chips]);
  const oldTotal = useMemo(() => chipSum(initialChips), [initialChips]);
  const delta = newTotal - oldTotal;

  const diff = useMemo(() => {
    const changes: Array<{ denom: number; old: number; new: number; delta: number }> = [];
    CHIP_DENOMS.forEach(d => {
      const oldV = initialChips[d] || 0;
      const newV = chips[d] || 0;
      if (oldV !== newV) changes.push({ denom: d, old: oldV, new: newV, delta: newV - oldV });
    });
    return changes;
  }, [chips, initialChips]);

  const handleSave = async () => {
    if (!casinoId || !managerId) return;
    if (diff.length === 0) { toast.info("No changes"); return; }
    if (!reason.trim()) { toast.error("Please provide a reason"); return; }
    setSaving(true);
    try {
      const of = (shift.opening_float || {}) as Record<string, any>;
      const oldTotals = (of.totals || {}) as Record<string, any>;
      const oldTotalTzs = Number(oldTotals.total_tzs || 0);
      const newTotalTzs = oldTotalTzs - oldTotal + newTotal;

      const newOpeningFloat = {
        ...of,
        chips,
        totals: {
          ...oldTotals,
          chips_tzs: newTotal,
          total_tzs: newTotalTzs,
        },
      };

      const { error } = await supabase
        .from("shifts")
        .update({ opening_float: newOpeningFloat } as any)
        .eq("id", shift.id);
      if (error) throw error;

      await logAction(casinoId, "edit", "OPENING_CHIPS_EDITED", {
        shift_id: shift.id,
        manager_id: managerId,
        reason: reason.trim(),
        old_chips: initialChips,
        new_chips: chips,
        diff,
        old_chips_tzs: oldTotal,
        new_chips_tzs: newTotal,
        delta_tzs: delta,
      });

      qc.invalidateQueries({ queryKey: ["active-shift"] });
      toast.success("Opening chips updated");
      handleOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (showOverride) {
    return (
      <ManagerOverrideDialog
        open={open && showOverride}
        onClose={() => handleOpenChange(false)}
        onConfirm={handleConfirmOverride}
        title="Edit Opening Chips"
        description="Manager authentication required to edit shift opening chips. All changes will be recorded in the audit log."
        actionType="OPENING_CHIPS_EDIT_REQUESTED"
        actionDetails={{ shift_id: shift.id }}
      />
    );
  }

  return (
    <Dialog open={open && unlocked} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Edit Opening Chips
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 flex gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Chip-only edit. Every change is logged to the audit trail with manager identity and reason.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Opening Chips</p>
          <ChipDenomInput values={chips} onChange={setChips} columns={2} size="md" showValue />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Old Total</p>
            <p className="font-mono font-bold">{formatNumberSpaces(oldTotal)}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[9px] uppercase text-muted-foreground">New Total</p>
            <p className="font-mono font-bold">{formatNumberSpaces(newTotal)}</p>
          </div>
          <div className="rounded border border-border p-2">
            <p className="text-[9px] uppercase text-muted-foreground">Δ</p>
            <p className={`font-mono font-bold ${delta > 0 ? "cms-amount-positive" : delta < 0 ? "cms-amount-negative" : ""}`}>
              {delta > 0 ? "+" : ""}{formatNumberSpaces(delta)}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason (required)</p>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Explain why opening chips need to be corrected…"
            rows={2}
            className={`text-sm ${!reason.trim() ? "border-destructive/60 focus-visible:ring-destructive/40" : ""}`}
          />
          {!reason.trim() && (
            <p className="text-[10px] font-medium text-destructive flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Reason must be filled to save
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || diff.length === 0 || !reason.trim()} className="gap-1.5">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save & Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOpeningChipsDialog;
