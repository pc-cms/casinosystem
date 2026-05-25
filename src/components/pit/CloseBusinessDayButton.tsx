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
import { useActiveShift } from "@/hooks/use-shift";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";

/**
 * Close the current business day. Visible always to staff working the cage
 * surface (cashier / manager / pit / finance / super_admin). Confirmation
 * always requires manager password (or RFID) — the role gate only controls
 * who sees the button, never who can authorize the close.
 *
 * Money for the day is reconciled in the Cage, so the close action lives here.
 * If forgotten, an automatic close runs at 11:00 AM EAT.
 */
export function CloseBusinessDayButton() {
  const { roles } = useAuth();
  const { data: currentDate } = useEffectiveBusinessDate();
  const { data: lastClosure } = useLastBusinessDayClosure();
  const { data: activeShift } = useActiveShift();
  const closeMut = useCloseBusinessDay();
  const [open, setOpen] = useState(false);
  const [askPassword, setAskPassword] = useState(false);

  const canSee = roles.some(r =>
    ["cashier", "cashier_slots", "manager", "pit", "finance_manager", "super_admin"].includes(r)
  );

  if (!canSee) return null;

  const shiftBlocking = !!activeShift;

  const handleProceed = () => {
    setOpen(false);
    setAskPassword(true);
  };

  const handleManagerVerified = async () => {
    setAskPassword(false);
    try {
      await closeMut.mutateAsync();
    } catch {
      /* toast already shown */
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={shiftBlocking}
        title={shiftBlocking ? "Close the active cage shift first" : undefined}
        className="gap-1.5"
      >
        <Lock className="h-3.5 w-3.5" />
        Close Day
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
          <p className="text-xs text-amber-700 dark:text-amber-400 pt-1 font-medium">
            Manager password will be required to confirm.
          </p>
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
          <Button onClick={handleProceed} disabled={closeMut.isPending}>
            Continue
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>

      <ManagerOverrideDialog
        open={askPassword}
        onClose={() => setAskPassword(false)}
        onConfirm={handleManagerVerified}
        title="Confirm Close Business Day"
        description={`Enter manager credentials to close business day ${currentDate || ""}.`}
        actionType="BUSINESS_DAY_CLOSE_CONFIRM"
        actionDetails={{ business_date: currentDate }}
      />
    </>
  );
}

