/**
 * TipsDialog — unified dialog for cashier to record one of three tip kinds:
 *  - tips_live  (Live Game tips, dealer pool)
 *  - tips_poker (Club Poker tips, separate report)
 *  - tips_floor (Floor staff tips — must select recipient employee)
 *
 * Flow for all three is identical: cashier counts the chips that came in,
 * cash is handed out from the cage, transaction is inserted with the matching
 * type. No player_id (NULL), no impact on tables_result/shift_result.
 * Chips end up in Miss automatically via the standard end-of-shift
 * counted − opening rule on closing_count.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Gift, UserCheck, ArrowUpFromLine } from "lucide-react";
import ChipDenomInput from "@/components/ChipDenomInput";
import { sumChips } from "@/hooks/use-chip-colors";
import { formatCurrency } from "@/lib/currency";
import { useCreateTransaction } from "@/hooks/use-casino-data";
import { useStaffMembers } from "@/hooks/use-staff";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type TipsKind = "tips_live" | "tips_poker" | "tips_floor";

const KIND_META: Record<TipsKind, { title: string; icon: typeof Gift; subtitle: string }> = {
  tips_live: {
    title: "Tips · Live Game",
    icon: Gift,
    subtitle: "Chips → cash. Goes into dealer pool (Monthly Tips).",
  },
  tips_poker: {
    title: "Tips · Club Poker",
    icon: Coins,
    subtitle: "Chips → cash. Tracked separately in poker tips report.",
  },
  tips_floor: {
    title: "Tips · Floor",
    icon: UserCheck,
    subtitle: "Chips → cash, handed directly to chosen employee.",
  },
};

type Props = {
  kind: TipsKind;
  open: boolean;
  onClose: () => void;
  shiftId: string;
  tables: Tables<"gaming_tables">[];
};

export const TipsDialog = ({ kind, open, onClose, shiftId, tables }: Props) => {
  const meta = KIND_META[kind];
  const [chips, setChips] = useState<Record<number, number>>({});
  const [tableId, setTableId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const total = useMemo(() => sumChips(chips), [chips]);
  const createTx = useCreateTransaction();

  const { data: staff = [] } = useStaffMembers();
  const employees = useMemo(
    () => (staff as any[]).filter(s => s.is_active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [staff],
  );

  const pokerTables = useMemo(
    () => tables.filter(t => (t.game || "").toLowerCase().includes("poker") && t.status === "open"),
    [tables],
  );

  const reset = () => {
    setChips({});
    setTableId("");
    setEmployeeId("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (total <= 0) {
      toast.error("Enter at least one chip");
      return;
    }
    if (kind === "tips_floor" && !employeeId) {
      toast.error("Select a recipient employee");
      return;
    }
    createTx.mutate(
      {
        player_id: null,
        table_id: kind === "tips_poker" ? (tableId || null) : null,
        type: kind,
        amount: total,
        chips: Object.fromEntries(
          Object.entries(chips).filter(([, v]) => (v || 0) > 0).map(([k, v]) => [k, v]),
        ) as Record<string, number>,
        shift_id: shiftId,
        tips_recipient_employee_id: kind === "tips_floor" ? employeeId : null,
      },
      {
        onSuccess: () => handleClose(),
      },
    );
  };

  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="w-4 h-4" /> {meta.title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{meta.subtitle}</p>
        </DialogHeader>

        <div className="space-y-3">
          {kind === "tips_poker" && pokerTables.length > 0 && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Poker Table (optional)
              </label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select table…" />
                </SelectTrigger>
                <SelectContent>
                  {pokerTables.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "tips_floor" && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Recipient Employee
              </label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} <span className="text-muted-foreground ml-1">· {e.department}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Chips to Receive
            </label>
            <ChipDenomInput values={chips} onChange={setChips} columns={2} size="lg" onSubmit={handleSubmit} />
          </div>

          <div className="cms-panel p-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Cash to Hand Out</span>
            <span className="font-mono text-xl font-bold">{formatCurrency(total)}</span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={total <= 0 || createTx.isPending || (kind === "tips_floor" && !employeeId)}
            className="w-full gap-1.5 h-11"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            {createTx.isPending ? "Recording…" : `Record Tip · ${formatCurrency(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TipsDialog;
