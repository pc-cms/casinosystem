/**
 * Admin → Expense Categories (per casino).
 * Manages the dropdown list cashiers and office managers see when adding expenses.
 * Each row optionally maps to a fin_categories row so the expense lands in the
 * correct Monthly Report bucket.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { useFinCategories } from "@/hooks/use-fin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Scope = "live_game" | "slots" | "office" | "any";

interface Row {
  id: string;
  casino_id: string;
  code: string;
  label: string;
  scope: Scope;
  fin_category_id: string | null;
  active: boolean;
  sort_order: number;
}

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "live_game", label: "Live Game" },
  { value: "slots", label: "Slots" },
  { value: "office", label: "Office" },
  { value: "any", label: "All sources" },
];

const useExpenseCategoriesAdmin = () => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["expense-categories-admin", activeCasinoId],
    queryFn: async () => {
      if (!activeCasinoId) return [] as Row[];
      const { data, error } = await (supabase as any)
        .from("expense_categories")
        .select("*")
        .eq("casino_id", activeCasinoId)
        .order("scope")
        .order("sort_order");
      if (error) throw error;
      return data as Row[];
    },
    enabled: !!activeCasinoId,
  });
};

export const ExpenseCategoriesSettings = () => {
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useExpenseCategoriesAdmin();
  const { data: finCats = [] } = useFinCategories();
  const [open, setOpen] = useState(false);
  const emptyForm = { id: "" as string | "", code: "", label: "", scope: "live_game" as Scope, fin_category_id: "", active: true, sort_order: 100 };
  const [form, setForm] = useState(emptyForm);

  const finCatsByGroup = (finCats || []).reduce((acc: Record<string, any[]>, c: any) => {
    (acc[c.group_name] ||= []).push(c);
    return acc;
  }, {});

  const save = useMutation({
    mutationFn: async () => {
      if (!activeCasinoId) throw new Error("No casino");
      const payload: any = {
        casino_id: activeCasinoId,
        code: form.code.trim().toLowerCase(),
        label: form.label.trim(),
        scope: form.scope,
        fin_category_id: form.fin_category_id || null,
        active: form.active,
        sort_order: form.sort_order,
      };
      if (form.id) {
        const { error } = await (supabase as any)
          .from("expense_categories")
          .update({ label: payload.label, scope: payload.scope, fin_category_id: payload.fin_category_id, active: payload.active, sort_order: payload.sort_order })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("expense_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Category saved");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      toast.success("Category deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const finName = (id: string | null) => {
    if (!id) return "—";
    const c = (finCats || []).find((x: any) => x.id === id);
    return c ? `${c.group_name} · ${c.name}` : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold">Expense Categories (per casino)</h3>
          <p className="text-xs text-muted-foreground">
            Codes shown to cashiers and managers when adding an expense. The optional Finance Plan link makes the row appear in the Monthly Report.
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Category
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Scope</th>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Label</th>
              <th className="text-left px-3 py-2">Finance Plan Category</th>
              <th className="text-right px-3 py-2 w-20">Sort</th>
              <th className="text-center px-3 py-2 w-20">Active</th>
              <th className="text-right px-3 py-2 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No categories yet</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-1.5"><Badge variant="outline" className="text-[10px] uppercase">{r.scope}</Badge></td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-1.5">{r.label}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{finName(r.fin_category_id)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-xs">{r.sort_order}</td>
                <td className="px-3 py-1.5 text-center">
                  {r.active ? <Badge className="text-[10px]">Active</Badge> : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setForm({ id: r.id, code: r.code, label: r.label, scope: r.scope, fin_category_id: r.fin_category_id || "", active: r.active, sort_order: r.sort_order }); setOpen(true); }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(`Delete category "${r.label}"?`)) remove.mutate(r.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ResponsiveDialog open={open} onOpenChange={setOpen} title={form.id ? "Edit category" : "New category"}>
        <FormGrid>
          <FormField span={4} label="Scope">
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as Scope })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField span={4} label="Code (immutable)">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              placeholder="e.g. taxi"
              disabled={!!form.id}
              className="font-mono"
            />
          </FormField>
          <FormField span={4} label="Label">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Taxi" />
          </FormField>
          <FormField span={8} label="Finance Plan Category (optional)">
            <Select value={form.fin_category_id || "__none"} onValueChange={(v) => setForm({ ...form, fin_category_id: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Not linked —</SelectItem>
                {Object.entries(finCatsByGroup).map(([group, list]) => (
                  <div key={group}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50">{group}</div>
                    {(list as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField span={2} label="Sort">
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </FormField>
          <FormField span={2} label="Active">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-5 w-5" />
          </FormField>
        </FormGrid>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.code || !form.label || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
};
