import { useState, useMemo } from "react";
import { Tag, Trash2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinCategories } from "@/hooks/use-fin";
import { fmtDateTime } from "@/lib/format-date";

const useAliases = () =>
  useQuery({
    queryKey: ["fin-category-aliases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fin_category_aliases")
        .select("*, fin_categories(name, group_name)")
        .order("alias_norm");
      if (error) throw error;
      return data || [];
    },
  });

export default function FinancesAliasesPage() {
  const qc = useQueryClient();
  const { data: aliases = [] } = useAliases();
  const { data: cats = [] } = useFinCategories();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return aliases;
    return aliases.filter((a: any) =>
      a.alias_original?.toLowerCase().includes(s) ||
      a.fin_categories?.name?.toLowerCase().includes(s)
    );
  }, [aliases, search]);

  const update = useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      const { error } = await supabase.from("fin_category_aliases").update({ category_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-category-aliases"] });
      toast.success("Mapping updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fin_category_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-category-aliases"] });
      toast.success("Alias removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        icon={Tag}
        title="Excel Aliases"
        subtitle={`${aliases.length} learned mappings · used by Excel Import for auto-matching`}
      />
      <PageSection card={false}>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search alias or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7"
            />
          </div>
        </div>
        <div className="rounded-md border border-border overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Excel label</th>
                <th className="px-3 py-2 text-left">Normalized</th>
                <th className="px-3 py-2 text-left">Mapped category</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a: any) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-1.5">{a.alias_original}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{a.alias_norm}</td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={a.category_id}
                      onValueChange={(v) => update.mutate({ id: a.id, category_id: v })}
                    >
                      <SelectTrigger className="h-7 text-xs w-[280px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cats.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.group_name} → {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{fmtDateTime(a.created_at)}</td>
                  <td className="px-3 py-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        if (confirm(`Remove alias "${a.alias_original}"?`)) remove.mutate(a.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-6">
                    {search ? "No matches" : "No aliases yet — confirm mappings during Excel Import"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
