/**
 * Stock movement dialog: delta (+ in / − out / adjustment) + reason.
 * Inserts pos_inventory_movements; DB trigger updates stock_qty.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormGrid } from "@/components/ui/form-grid";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useAddPosInventoryMovement } from "@/hooks/use-pos-inventory";
import type { PosMenuItem } from "@/hooks/use-pos-menu";
import { formatNumberSpaces } from "@/lib/currency";

type Direction = "in" | "out";

const PRESET_REASONS: Record<Direction, string[]> = {
  in: ["Stock-in (delivery)", "Returned by waiter", "Found / recount +"],
  out: ["Waste / spoilage", "Spillage", "Recount −"],
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: PosMenuItem | null;
}

export const StockMovementDialog = ({ open, onOpenChange, item }: Props) => {
  const { user } = useAuth();
  const add = useAddPosInventoryMovement();
  const [direction, setDirection] = useState<Direction>("in");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setDirection("in");
      setQty("1");
      setReason("");
    }
  }, [open]);

  const qtyN = Number(qty) || 0;
  const delta = direction === "in" ? qtyN : -qtyN;
  const newStock = (item?.stock_qty ?? 0) + delta;
  const valid = !!item && qtyN > 0 && reason.trim().length > 0;

  const handle = async () => {
    if (!item) return;
    if (!valid) {
      toast({ title: "Enter a positive quantity and reason", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync({
        item_id: item.id,
        delta,
        reason: reason.trim(),
        user_id: user?.id ?? null,
      });
      toast({ title: direction === "in" ? "Stock added" : "Stock removed" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={`Stock movement · ${item?.name ?? ""}`} size="md">
      <div className="space-y-4">
        <div className="rounded-md bg-muted/40 px-4 py-3 flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Current stock</span>
          <span className="font-mono tabular-nums text-lg">
            {item?.stock_qty != null ? formatNumberSpaces(item.stock_qty) : "—"}
          </span>
        </div>

        <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="in">+ Stock in</TabsTrigger>
            <TabsTrigger value="out">− Stock out</TabsTrigger>
          </TabsList>
        </Tabs>

        <FormGrid>
          <FormField span={6} label="Quantity" required>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField span={6} label="New stock">
            <div className="h-10 flex items-center font-mono tabular-nums">
              {formatNumberSpaces(newStock)}
            </div>
          </FormField>
        </FormGrid>

        <FormGrid>
          <FormField span={12} label="Reason" required>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Delivery from supplier"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {PRESET_REASONS[direction].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70"
                >
                  {r}
                </button>
              ))}
            </div>
          </FormField>
        </FormGrid>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handle} disabled={!valid || add.isPending}>
            {add.isPending ? "Saving…" : "Confirm"}
          </Button>
        </ResponsiveDialogFooter>
      </div>
    </ResponsiveDialog>
  );
};

export default StockMovementDialog;
