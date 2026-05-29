/**
 * Comp budget widget for POS Manager dashboard — shows current month's
 * house-comp usage vs limit, with progress bar and an inline edit dialog.
 */
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Progress } from "@/components/ui/progress";
import { useCasino } from "@/lib/casino-context";
import { usePosCompBudgetStatus, useSetPosCompBudget, usePosCompBudgetOverrides } from "@/hooks/use-pos-comp-budget";
import { fmtDateTime } from "@/lib/format-date";

import { formatNumberSpaces } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

export default function CompBudgetCard() {
  const { activeCasinoId } = useCasino();
  const { data: status } = usePosCompBudgetStatus(activeCasinoId);
  const setBudget = useSetPosCompBudget();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!status) return null;
  const pct = Math.min(100, Number(status.percent_used ?? 0));
  const isOver = status.is_over;
  const isNear = !isOver && pct >= 80;

  const openEdit = () => {
    setDraft(String(status.limit_tzs || 0));
    setOpen(true);
  };

  const save = () => {
    if (!activeCasinoId) return;
    const n = Number((draft || "").replace(/\D/g, ""));
    setBudget.mutate(
      { casino_id: activeCasinoId, month_start: status.month_start, limit_tzs: n },
      {
        onSuccess: () => {
          toast({ title: "Comp budget updated" });
          setOpen(false);
        },
        onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const month = new Date(status.month_start).toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider">House Comp Budget</h3>
            {isOver && <ShieldAlert className="w-4 h-4 text-destructive" />}
          </div>
          <div className="text-[11px] text-muted-foreground">{month}</div>
        </div>
        <Button size="sm" variant="outline" onClick={openEdit}>
          {status.limit_tzs > 0 ? "Edit limit" : "Set limit"}
        </Button>
      </div>

      {status.limit_tzs > 0 ? (
        <>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-mono text-xs text-muted-foreground">
              {formatNumberSpaces(status.used_house_tzs)} / {formatNumberSpaces(status.limit_tzs)} TZS
            </span>
            <span className={`font-mono text-sm font-bold ${isOver ? "cms-amount-negative" : isNear ? "text-amber-500" : ""}`}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <Progress value={pct} className={isOver ? "[&>div]:bg-destructive" : isNear ? "[&>div]:bg-amber-500" : ""} />
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <Cell label="Remaining" value={status.remaining_tzs} positive />
            <Cell label="Player comps" value={status.used_player_tzs} />
          </div>
          {isOver && (
            <p className="mt-2 text-[10px] text-destructive">
              Monthly house-comp budget exceeded. Review approvals or raise the limit.
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          No limit set for this month. Used so far: <span className="font-mono">{formatNumberSpaces(status.used_house_tzs)}</span> TZS (house) ·{" "}
          <span className="font-mono">{formatNumberSpaces(status.used_player_tzs)}</span> TZS (player).
        </p>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={`Comp budget — ${month}`}
        description="Monthly cap for house-comp tabs in this casino. Player comps are not capped."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cb_limit">Limit (TZS)</Label>
            <Input
              id="cb_limit"
              inputMode="numeric"
              value={draft ? formatNumberSpaces(Number(draft.replace(/\D/g, "")) || 0) : ""}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={setBudget.isPending}>Save</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

const Cell = ({ label, value, positive }: { label: string; value: number; positive?: boolean }) => (
  <div className="rounded border border-border bg-background px-2 py-1.5">
    <div className="text-[9px] uppercase text-muted-foreground tracking-wider">{label}</div>
    <div className={`font-mono font-bold text-sm ${positive && value > 0 ? "cms-amount-positive" : ""}`}>
      {formatNumberSpaces(Math.round(value))}
    </div>
  </div>
);
