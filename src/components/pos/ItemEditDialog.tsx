import { useEffect, useState } from "react";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useUpsertPosMenuItem,
  type PosMenuCategory,
  type PosMenuItem,
} from "@/hooks/use-pos-menu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  casinoId: string;
  item?: PosMenuItem | null;
  categories: PosMenuCategory[];
  defaultCategoryId?: string | null;
}

export const ItemEditDialog = ({
  open,
  onOpenChange,
  casinoId,
  item,
  categories,
  defaultCategoryId,
}: Props) => {
  const upsert = useUpsertPosMenuItem();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [stockQty, setStockQty] = useState<string>("");
  const [lowThreshold, setLowThreshold] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setCategoryId(item?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
      setPrice(item ? String(item.price_tzs) : "");
      setStockQty(item?.stock_qty != null ? String(item.stock_qty) : "");
      setLowThreshold(item?.low_threshold != null ? String(item.low_threshold) : "");
      setIsActive(item?.is_active ?? true);
    }
  }, [open, item, categories, defaultCategoryId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!categoryId) {
      toast({ title: "Category is required", variant: "destructive" });
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast({ title: "Price must be a non-negative number", variant: "destructive" });
      return;
    }
    const stockNum = stockQty.trim() === "" ? null : Number(stockQty);
    const lowNum = lowThreshold.trim() === "" ? null : Number(lowThreshold);
    if (stockNum != null && !Number.isFinite(stockNum)) {
      toast({ title: "Stock must be a number or empty", variant: "destructive" });
      return;
    }
    if (lowNum != null && !Number.isFinite(lowNum)) {
      toast({ title: "Low threshold must be a number or empty", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: item?.id,
        casino_id: casinoId,
        category_id: categoryId,
        name: name.trim(),
        price_tzs: Math.round(priceNum),
        stock_qty: stockNum,
        low_threshold: lowNum,
        is_active: isActive,
      });
      toast({ title: item ? "Item updated" : "Item created" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    }
  };

  const activeCategories = categories.filter((c) => c.is_active || c.id === item?.category_id);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit item" : "New item"}
      size="lg"
    >
      <FormGrid>
        <FormField span={8} label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormField>
        <FormField span={4} label="Active">
          <div className="flex items-center h-10">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </FormField>
        <FormField span={6} label="Category" required>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {activeCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField span={6} label="Price (TZS)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        <FormField span={6} label="Stock qty" hint="Leave empty to disable tracking">
          <Input
            type="number"
            inputMode="numeric"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
          />
        </FormField>
        <FormField span={6} label="Low threshold" hint="Alert when stock falls below">
          <Input
            type="number"
            inputMode="numeric"
            value={lowThreshold}
            onChange={(e) => setLowThreshold(e.target.value)}
          />
        </FormField>
      </FormGrid>
      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
};

export default ItemEditDialog;
