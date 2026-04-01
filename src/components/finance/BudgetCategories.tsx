import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tags } from "lucide-react";
import { useBudgetCategories, useCreateBudgetCategory, PARENT_GROUPS, PARENT_GROUP_LABELS } from "@/hooks/use-budget";
import { CATEGORY_LABELS } from "@/hooks/use-finance";

const EXPENSE_MAPPINGS = Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }));

export const BudgetCategories = () => {
  const { data: categories = [] } = useBudgetCategories();
  const createCategory = useCreateBudgetCategory();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentGroup, setParentGroup] = useState("operating");
  const [expenseMapping, setExpenseMapping] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createCategory.mutate(
      { name: name.trim(), parent_group: parentGroup, expense_mapping: expenseMapping || undefined },
      { onSuccess: () => { setName(""); setExpenseMapping(""); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Tags className="w-4 h-4 mr-1" />Categories</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Budget Categories</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {PARENT_GROUPS.map(g => {
              const items = categories.filter(c => c.parent_group === g);
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <p className="text-xs font-medium text-muted-foreground uppercase">{PARENT_GROUP_LABELS[g]}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {items.map(c => (
                      <Badge key={c.id} variant="secondary">{c.name}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No categories yet</p>
            )}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-sm font-medium text-foreground">New Category</p>
            <Input placeholder="Category name" value={name} onChange={e => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={parentGroup} onValueChange={setParentGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARENT_GROUPS.map(g => (
                    <SelectItem key={g} value={g}>{PARENT_GROUP_LABELS[g]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expenseMapping} onValueChange={setExpenseMapping}>
                <SelectTrigger><SelectValue placeholder="Expense mapping" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_MAPPINGS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createCategory.isPending}
              size="sm"
              className="w-full"
            >
              Create Category
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
