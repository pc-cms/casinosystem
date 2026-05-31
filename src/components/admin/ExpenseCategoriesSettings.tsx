/**
 * Admin · per-casino Expense Categories CRUD.
 * Visible to manager / finance_manager / super_admin. Delete restricted to super_admin (via RLS).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Receipt } from "lucide-react";
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  type CategoryScope,
} from "@/hooks/use-expense-categories";
import { useAuth } from "@/lib/auth-context";

const SCOPES: CategoryScope[] = ["live_game", "slots", "office", "any"];

export const ExpenseCategoriesSettings = () => {
  const { roles } = useAuth();
  const canDelete = roles.includes("super_admin");
  const { data: cats = [] } = useExpenseCategories("all");
  const create = useCreateExpenseCategory();
  const update = useUpdateExpenseCategory();
  const del = useDeleteExpenseCategory();

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<CategoryScope>("any");

  const submit = async () => {
    if (!code.trim() || !label.trim()) return;
    await create.mutateAsync({ code: code.trim().toLowerCase(), label: label.trim(), scope });
    setCode(""); setLabel(""); setScope("any");
  };

  return (
    <div className="space-y-4">
      <div className="cms-panel">
        <div className="cms-header flex items-center gap-2">
          <Receipt className="w-4 h-4" /> Add Category
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-[140px_1fr_160px_auto] gap-2 items-end">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase">Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="taxi" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Taxi" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase">Scope</label>
            <Select value={scope} onValueChange={(v) => setScope(v as CategoryScope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map(s => <SelectItem key={s} value={s} className="uppercase">{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submit} disabled={create.isPending || !code.trim() || !label.trim()} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>

      <div className="cms-panel">
        <div className="cms-header">Categories ({cats.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-card">
              <tr className="border-b border-border">
                {["Code", "Label", "Scope", "Order", "Active", ""].map(h => (
                  <th key={h} className="px-3 py-2 text-left uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 ? <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No categories</td></tr> :
               cats.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono uppercase">{c.code}</td>
                  <td className="px-3 py-2">
                    <Input
                      defaultValue={c.label}
                      className="h-7 text-xs"
                      onBlur={(e) => e.target.value !== c.label && update.mutate({ id: c.id, label: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select value={c.scope} onValueChange={(v) => update.mutate({ id: c.id, scope: v as CategoryScope })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCOPES.map(s => <SelectItem key={s} value={s} className="uppercase">{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 w-20">
                    <Input
                      type="number"
                      defaultValue={c.sort_order}
                      className="h-7 text-xs w-16"
                      onBlur={(e) => Number(e.target.value) !== c.sort_order && update.mutate({ id: c.id, sort_order: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2"><Switch checked={c.active} onCheckedChange={(v) => update.mutate({ id: c.id, active: v })} /></td>
                  <td className="px-3 py-2 text-right">
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(c.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
