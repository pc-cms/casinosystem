import { useMemo, useState } from "react";
import { formatNumberSpaces } from "@/lib/currency";
import { usePosMenuCategories, usePosMenuItems, type PosMenuItem } from "@/hooks/use-pos-menu";
import { useAddPosOrder } from "@/hooks/use-pos-orders";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  casinoId: string;
  shiftId: string;
  tabId: string | null;
  userId: string;
}

export const MenuPanel = ({ casinoId, shiftId, tabId, userId }: Props) => {
  const { data: categories = [] } = usePosMenuCategories(casinoId);
  const { data: items = [] } = usePosMenuItems(casinoId);
  const addOrder = useAddPosOrder();

  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const effectiveCat = selectedCat ?? activeCategories[0]?.id ?? null;

  const filtered = useMemo(() => {
    return items.filter((i) => i.is_active && (!effectiveCat || i.category_id === effectiveCat));
  }, [items, effectiveCat]);

  const handleAdd = async (item: PosMenuItem, qty: number) => {
    if (!tabId) {
      toast({ title: "Select or open a tab first", variant: "destructive" });
      return;
    }
    try {
      await addOrder.mutateAsync({
        casino_id: casinoId,
        shift_id: shiftId,
        tab_id: tabId,
        waiter_user_id: userId,
        item_id: item.id,
        item_name: item.name,
        unit_price_tzs: item.price_tzs,
        qty,
      });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  if (activeCategories.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No active menu categories. Ask the POS manager to set up the menu.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 overflow-x-auto p-2 border-b border-border">
        {activeCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCat(c.id)}
            className={cn(
              "px-4 h-10 rounded-md whitespace-nowrap text-sm font-medium transition-colors",
              effectiveCat === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/70 text-foreground",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">No items in this category.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map((it) => {
              const outOfStock = it.stock_qty != null && it.stock_qty <= 0;
              return (
                <ItemTile
                  key={it.id}
                  item={it}
                  outOfStock={outOfStock}
                  disabled={!tabId || outOfStock || addOrder.isPending}
                  onAdd={(qty) => handleAdd(it, qty)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ItemTile = ({
  item,
  outOfStock,
  disabled,
  onAdd,
}: {
  item: PosMenuItem;
  outOfStock: boolean;
  disabled: boolean;
  onAdd: (qty: number) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        "relative rounded-md border border-border bg-card flex flex-col overflow-hidden",
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => !disabled && onAdd(1)}
        disabled={disabled}
        className="flex-1 p-3 text-left hover:bg-accent/40 transition-colors min-h-[88px] flex flex-col justify-between"
      >
        <div className="font-medium text-sm leading-tight line-clamp-2">{item.name}</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono tabular-nums font-semibold">
            {formatNumberSpaces(item.price_tzs)}
          </span>
          {outOfStock && (
            <span className="text-xs text-cms-amount-negative">Out</span>
          )}
          {!outOfStock && item.stock_qty != null && (
            <span className="text-[10px] text-muted-foreground">×{item.stock_qty}</span>
          )}
        </div>
      </button>
      <div className="flex border-t border-border">
        {[2, 3, 5].map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(q)}
            className="flex-1 h-8 text-xs font-mono hover:bg-accent/40 border-l border-border first:border-l-0"
          >
            ×{q}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MenuPanel;
