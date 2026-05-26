/**
 * Inline lock/unlock control rendered in the header of every rota grid.
 *
 * - Always shows the current state (lock badge or "Unlocked" hint).
 * - Manager / HR / Super Admin see an action button to toggle the state.
 * - On lock/unlock the rota grid re-fetches and switches to read-only
 *   automatically (the parent reads useRotaLock too and feeds readOnly).
 */
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useLockRota, useUnlockRota, useRotaLock, type RotaScope } from "@/hooks/use-rota-lock";
import { fmtDateOnly } from "@/lib/format-date";

interface Props {
  scope: RotaScope;
  month: string; // "YYYY-MM"
}

export const RotaLockButton = ({ scope, month }: Props) => {
  const { roles, isManager } = useAuth();
  const canToggle = isManager || roles.includes("hr") || roles.includes("super_admin");
  const { data: lock } = useRotaLock(scope, month);
  const lockMut = useLockRota();
  const unlockMut = useUnlockRota();

  const locked = !!lock;
  const busy = lockMut.isPending || unlockMut.isPending;

  if (locked) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
          <Lock className="w-3 h-3" />
          Locked · {fmtDateOnly(lock!.locked_at)}
        </span>
        {canToggle && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1"
            disabled={busy}
            onClick={() => unlockMut.mutate({ scope, month })}
          >
            <LockOpen className="w-3 h-3" /> Unlock
          </Button>
        )}
      </div>
    );
  }

  if (!canToggle) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-muted text-muted-foreground">
        <LockOpen className="w-3 h-3" /> Unlocked
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-[11px] gap-1"
      disabled={busy}
      onClick={() => lockMut.mutate({ scope, month })}
      title="Lock this month — rota will become read-only"
    >
      <Lock className="w-3 h-3" /> Lock month
    </Button>
  );
};

export default RotaLockButton;
