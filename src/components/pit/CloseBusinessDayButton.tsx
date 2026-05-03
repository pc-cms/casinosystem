import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Lock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  useCloseBusinessDay,
  useEffectiveBusinessDate,
  useLastBusinessDayClosure,
} from "@/hooks/use-business-day-closure";

/**
 * Manager (always) or Pit (with active Manager Access) closes the current
 * business day. After closing, all operational filters advance to the next
 * day; if forgotten, an automatic close runs at 11:00 AM EAT.
 */
export function CloseBusinessDayButton() {
  const { roles, managerOverride } = useAuth();
  const { data: currentDate } = useEffectiveBusinessDate();
  const { data: lastClosure } = useLastBusinessDayClosure();
  const closeMut = useCloseBusinessDay();
  const [open, setOpen] = useState(false);

  const isManager = roles.includes("manager");
  const isPit = roles.includes("pit");
  const canClose = isManager || (isPit && managerOverride.active);

  if (!canClose) return null;

  const handleConfirm = async () => {
    try {
      await closeMut.mutateAsync();
      setOpen(false);
    } catch {
      /* toast already shown */
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Lock className="h-3.5 w-3.5" />
        Close Business Day
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        size="md"
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Close business day {currentDate || ""}?
          </span>
        }
      >
        <div className="space-y-3 text-sm">
          <p>This finalizes the current business day for the casino. After confirmation:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Operational filters (Pit, Cashier, Reception) advance to the next day.</li>
            <li>Today's data becomes historical for operational roles.</li>
            <li>If you forget to close, an automatic close runs at 11:00 AM.</li>
          </ul>
          {lastClosure && (
            <p className="text-xs text-muted-foreground pt-1">
              Last closure: {lastClosure.business_date} ({lastClosure.closed_method === "auto_11am" ? "auto" : "manual"})
            </p>
          )}
        </div>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={closeMut.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={closeMut.isPending}>
            {closeMut.isPending ? "Closing…" : "Confirm close"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>
    </>
  );
}
