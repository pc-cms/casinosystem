import { useEffect, useState } from "react";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useUpsertPosMenuCategory, type PosMenuCategory } from "@/hooks/use-pos-menu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  casinoId: string;
  category?: PosMenuCategory | null;
  defaultSortOrder: number;
}

export const CategoryEditDialog = ({ open, onOpenChange, casinoId, category, defaultSortOrder }: Props) => {
  const upsert = useUpsertPosMenuCategory();
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(defaultSortOrder);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setSortOrder(category?.sort_order ?? defaultSortOrder);
      setIsActive(category?.is_active ?? true);
    }
  }, [open, category, defaultSortOrder]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: category?.id,
        casino_id: casinoId,
        name: name.trim(),
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        is_active: isActive,
      });
      toast({ title: category ? "Category updated" : "Category created" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Edit category" : "New category"}
      size="md"
    >
      <FormGrid>
        <FormField span={12} label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormField>
        <FormField span={6} label="Sort order">
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </FormField>
        <FormField span={6} label="Active">
          <div className="flex items-center h-10">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
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

export default CategoryEditDialog;
