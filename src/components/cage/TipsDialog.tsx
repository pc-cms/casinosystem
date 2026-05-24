/**
 * TipsDialog — unified dialog for cashier to record one of three tip kinds:
 *  - tips_live  (Live Game tips, dealer pool — chips → cash, cash is income)
 *  - tips_poker (Club Poker tips — chip→cash exchange to specific dealer; no balance impact)
 *  - tips_floor (Floor staff tips — chip→cash exchange to specific employee; no balance impact)
 *
 * Poker/Floor both require selecting a recipient via searchable combobox
 * (typeahead by first letters/digits, like player search).
 *  - Poker pool: dealers/inspectors/trainees (no pit_boss) from useDealers().
 *  - Floor pool: useStaffMembers().
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Coins, Gift, UserCheck, ArrowUpFromLine, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ChipDenomInput from "@/components/ChipDenomInput";
import { sumChips } from "@/hooks/use-chip-colors";
import { formatCurrency } from "@/lib/currency";
import { useCreateTransaction, useDealers } from "@/hooks/use-casino-data";
import { useStaffMembers } from "@/hooks/use-staff";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type TipsKind = "tips_live" | "tips_poker" | "tips_floor";

const KIND_META: Record<TipsKind, { title: string; icon: typeof Gift; subtitle: string }> = {
  tips_live: {
    title: "Tips · Live Game",
    icon: Gift,
    subtitle: "Chips → cash. Cash counted as income; pool goes into Monthly Tips.",
  },
  tips_poker: {
    title: "Tips · Club Poker",
    icon: Coins,
    subtitle: "Chips → cash exchange for selected dealer. No cage balance impact.",
  },
  tips_floor: {
    title: "Tips · Floor",
    icon: UserCheck,
    subtitle: "Chips → cash exchange for selected employee. No cage balance impact.",
  },
};

// ───────── Searchable employee combobox ─────────
type EmpItem = { id: string; name: string; sub?: string };

const EmployeeCombobox = ({
  value,
  onChange,
  items,
  placeholder = "Select employee…",
}: {
  value: string;
  onChange: (id: string) => void;
  items: EmpItem[];
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => items.find(i => i.id === value), [items, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">
              {selected.name}
              {selected.sub && <span className="text-muted-foreground ml-1">· {selected.sub}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command
          filter={(value, search) => {
            // value is the CommandItem `value` prop (we set it to the name)
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Type name…" autoFocus />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              {items.map(item => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {item.name}
                    {item.sub && <span className="text-muted-foreground ml-1">· {item.sub}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const [employeeId, setEmployeeId] = useState<string>("");
  const total = useMemo(() => sumChips(chips), [chips]);
  const createTx = useCreateTransaction();

  const { data: staff = [] } = useStaffMembers();
  const { data: dealers = [] } = useDealers();

  // Poker pool: dealers + inspectors + trainees, excluding pit bosses.
  const pokerEmployees = useMemo<EmpItem[]>(() => {
    return (dealers as any[])
      .filter(d => d.is_active !== false && !d.is_pit_boss)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => ({
        id: d.id,
        name: d.name,
        sub: d.category === "inspector" ? "Inspector" : d.category === "trainee" ? "Trainee" : "Dealer",
      }));
  }, [dealers]);

  // Floor pool: any active staff member.
  const floorEmployees = useMemo<EmpItem[]>(() => {
    return (staff as any[])
      .filter(s => s.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => ({ id: s.id, name: s.name, sub: s.department }));
  }, [staff]);

  const reset = () => {
    setChips({});
    setEmployeeId("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const requiresEmployee = kind === "tips_poker" || kind === "tips_floor";

  const handleSubmit = () => {
    if (total <= 0) {
      toast.error("Enter at least one chip");
      return;
    }
    if (requiresEmployee && !employeeId) {
      toast.error("Select a recipient employee");
      return;
    }
    createTx.mutate(
      {
        player_id: null,
        table_id: null,
        type: kind,
        amount: total,
        chips: Object.fromEntries(
          Object.entries(chips).filter(([, v]) => (v || 0) > 0).map(([k, v]) => [k, v]),
        ) as Record<string, number>,
        shift_id: shiftId,
        tips_recipient_employee_id: requiresEmployee ? employeeId : null,
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
          {kind === "tips_poker" && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Recipient (Dealer / Inspector / Trainee)
              </label>
              <EmployeeCombobox
                value={employeeId}
                onChange={setEmployeeId}
                items={pokerEmployees}
                placeholder="Search by name…"
              />
            </div>
          )}

          {kind === "tips_floor" && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Recipient Employee
              </label>
              <EmployeeCombobox
                value={employeeId}
                onChange={setEmployeeId}
                items={floorEmployees}
                placeholder="Search by name…"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Chips to Receive
            </label>
            <ChipDenomInput values={chips} onChange={setChips} columns={2} size="lg" onSubmit={handleSubmit} />
          </div>

          <div className="cms-panel p-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {kind === "tips_live" ? "Cash to Hand Out (income)" : "Cash to Hand Out"}
            </span>
            <span className="font-mono text-xl font-bold">{formatCurrency(total)}</span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={total <= 0 || createTx.isPending || (requiresEmployee && !employeeId)}
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
