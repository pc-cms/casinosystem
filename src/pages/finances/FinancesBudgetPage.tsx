import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import FinanceCasinoSwitcher from "@/components/finances/FinanceCasinoSwitcher";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YearSelect } from "@/components/ui/year-select";

import { Button } from "@/components/ui/button";
import { useFinBudget, useFinCategories, useUpsertFinBudget } from "@/hooks/use-fin";
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
        <YearSelect value={year} onChange={setYear} />
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="TZS">TZS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
        </Select>
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-auto max-h-[72vh] bg-card">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-muted/40 sticky top-0 z-20">
              <tr className="[&>th]:h-8 [&>th]:px-2 [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-[10px] [&>th]:text-muted-foreground">
                <th className="text-left sticky left-0 z-30 bg-muted/40 min-w-[200px]">Category</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right w-[68px]">{m}</th>
                ))}
                <th className="text-right w-[100px] sticky right-0 z-30 bg-muted/40 border-l border-border">Annual</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c: any) => {
                const row = grid[c.id] || {};
                const annual = Object.values(row).reduce((s, v) => s + (v as number), 0);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30 [&>td]:h-8 [&>td]:px-1 [&>td]:align-middle">
                    <td className="text-left sticky left-0 z-10 bg-card pl-2 pr-3 whitespace-nowrap">
                      <span className="text-muted-foreground text-[9px] uppercase mr-1">{c.group_code}</span>
                      <span className="truncate inline-block max-w-[260px] align-middle">{c.name}</span>
                    </td>
                    {MONTHS.map((_, i) => {
                      const val = row[i + 1];
                      return (
                        <td key={i} className="w-[68px]">
                          <Input
                            type="number"
                            step="0.01"
                            className={`h-6 px-1.5 text-right font-mono tabular-nums text-[11px] ${val ? "" : "text-muted-foreground/50"}`}
                            defaultValue={val || ""}
                            key={`${c.id}-${i}-${val ?? 0}`}
                            onBlur={(e) => {
                              const v = Number((e.target as HTMLInputElement).value);
                              if (v !== (val || 0)) onSetMonth(c.id, i + 1, v);
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="text-right pr-2 sticky right-0 z-10 bg-card border-l border-border">
                      <button
                        className="font-mono tabular-nums underline-offset-2 hover:underline"
                        onClick={() => {
                          const newAnnual = Number(prompt(`Set annual for ${c.name} (${currency}). Current: ${formatNumberSpaces(annual)}`, String(annual)));
                          if (!isNaN(newAnnual)) setAnnual.mutate({ year, category_id: c.id, currency, annual: newAnnual });
                        }}
                      >
                        {annual ? formatNumberSpaces(annual) : <span className="text-muted-foreground/60">·</span>}
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
