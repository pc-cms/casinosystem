import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import FinanceCasinoSwitcher from "@/components/finances/FinanceCasinoSwitcher";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useFinBudget, useFinCategories, useUpsertFinBudget, useSetAnnualBudget } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function FinancesBudgetPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [currency, setCurrency] = useState("TZS");
  const { data: categories = [] } = useFinCategories();
  const { data: budget = [] } = useFinBudget(year);
  const upsert = useUpsertFinBudget();
  const setAnnual = useSetAnnualBudget();

  const grid = useMemo(() => {
    const map: Record<string, Record<number, number>> = {};
    (budget || []).filter((b: any) => b.currency === currency).forEach((b: any) => {
      map[b.category_id] = map[b.category_id] || {};
      map[b.category_id][b.month] = Number(b.planned_amount);
    });
    return map;
  }, [budget, currency]);

  const onSetMonth = async (categoryId: string, month: number, value: number) => {
    await upsert.mutateAsync({ year, month, category_id: categoryId, currency, planned_amount: value });
  };

  return (
    <PageShell>
      <PageHeader icon={Target} title="Budget" subtitle="Per-casino · per-category · per-month">
        <FinanceCasinoSwitcher allowNetwork={false} />
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 font-mono" />
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="TZS">TZS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
        </Select>
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">Category</th>
                {MONTHS.map((m, i) => <th key={m} className="text-right px-1.5 font-medium uppercase">{m}</th>)}
                <th className="text-right px-2">Annual</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c: any) => {
                const row = grid[c.id] || {};
                const annual = Object.values(row).reduce((s, v) => s + (v as number), 0);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-2 py-1"><span className="text-muted-foreground text-[10px] uppercase mr-1">{c.group_code}</span>{c.name}</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className="px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 text-right font-mono text-xs"
                          value={row[i + 1] || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            // optimistic local update via setTimeout debounce
                            (e.target as any)._pending = v;
                          }}
                          onBlur={(e) => {
                            const v = Number((e.target as HTMLInputElement).value);
                            onSetMonth(c.id, i + 1, v);
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-2 text-right">
                      <button
                        className="font-mono underline-offset-2 hover:underline"
                        onClick={() => {
                          const newAnnual = Number(prompt(`Set annual for ${c.name} (${currency}). Current: ${formatNumberSpaces(annual)}`, String(annual)));
                          if (!isNaN(newAnnual)) setAnnual.mutate({ year, category_id: c.id, currency, annual: newAnnual });
                        }}
                      >
                        {formatNumberSpaces(annual)}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
