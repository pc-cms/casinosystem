import { useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import FinanceCasinoSwitcher from "@/components/finances/FinanceCasinoSwitcher";
import { YearSelect } from "@/components/ui/year-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineNumberCell } from "@/components/finances/InlineNumberCell";
import { useFinCategories, useFinBudget, useFinExpenses, useUpsertFinBudgetCell } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";
import { useAuth } from "@/lib/auth-context";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function OtherIncomesTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [currency, setCurrency] = useState<"TZS" | "USD">("TZS");
  const { roles } = useAuth();
  const canEdit = roles.includes("super_admin") || roles.includes("finance_manager");

  const { data: categories = [] } = useFinCategories();
  const { data: budget = [] } = useFinBudget(year);
  const { data: expenses = [] } = useFinExpenses({ from: `${year}-01-01`, to: `${year}-12-31` });
  const upsertCell = useUpsertFinBudgetCell();

  const incomeCats = useMemo(
    () => (categories || []).filter((c: any) => c.is_income && !/^(Tables Income|Slots Income)$/.test(c.name)),
    [categories],
  );

  const plan = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    (budget || []).filter((b: any) => b.currency === currency).forEach((b: any) => {
      m[b.category_id] = m[b.category_id] || {};
      m[b.category_id][b.month] = Number(b.planned_amount || 0);
    });
    return m;
  }, [budget, currency]);

  const actual = useMemo(() => {
    const m: Record<string, Record<number, number>> = {};
    (expenses || []).forEach((e: any) => {
      if (e.voided_at || !e.fin_category_id) return;
      const mo = new Date(e.business_date).getMonth() + 1;
      const amt = currency === "TZS" ? Number(e.amount_tzs || e.amount || 0) : Number(e.amount_usd || 0);
      m[e.fin_category_id] = m[e.fin_category_id] || {};
      m[e.fin_category_id][mo] = (m[e.fin_category_id][mo] || 0) + amt;
    });
    return m;
  }, [expenses, currency]);

  return (
    <PageShell>
      <PageHeader icon={Coins} title="Other Incomes" subtitle="Non-operational income · plan vs actual per month">
        <FinanceCasinoSwitcher allowNetwork={false} />
        <YearSelect value={year} onChange={setYear} />
        <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TZS">TZS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>
      <PageSection card={false}>
        {incomeCats.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            No income categories yet. Add them in Finances → Categories (mark <em>is_income</em>).
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-auto max-h-[72vh] bg-card">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-muted/40 sticky top-0 z-20">
                <tr className="[&>th]:h-8 [&>th]:px-2 [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-[10px] [&>th]:text-muted-foreground">
                  <th className="text-left sticky left-0 z-30 bg-muted/40 min-w-[200px]">Category</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right w-[78px]">{m}</th>
                  ))}
                  <th className="text-right w-[110px] sticky right-0 z-30 bg-muted/40 border-l border-border">Year</th>
                </tr>
              </thead>
              <tbody>
                {incomeCats.map((c: any) => {
                  const pRow = plan[c.id] || {};
                  const aRow = actual[c.id] || {};
                  const ytdP = Object.values(pRow).reduce((s: number, v: any) => s + Number(v || 0), 0);
                  const ytdA = Object.values(aRow).reduce((s: number, v: any) => s + Number(v || 0), 0);
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30 [&>td]:h-9 [&>td]:px-1 [&>td]:align-middle">
                      <td className="text-left sticky left-0 z-10 bg-card pl-2 pr-3 whitespace-nowrap">{c.name}</td>
                      {MONTHS.map((_, i) => {
                        const p = pRow[i + 1] || 0;
                        const a = aRow[i + 1] || 0;
                        return (
                          <td key={i} className="w-[78px] text-right">
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              <InlineNumberCell
                                value={p}
                                disabled={!canEdit}
                                onCommit={(v) => upsertCell.mutate({ year, month: i + 1, category_id: c.id, currency, planned_amount: v })}
                                placeholder="·"
                              />
                            </div>
                            <div className={`font-mono tabular-nums leading-tight ${a ? "cms-amount-positive" : "text-muted-foreground/60"}`}>
                              {a ? formatNumberSpaces(a) : "·"}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-right pr-2 sticky right-0 z-10 bg-card border-l border-border">
                        <div className="text-[10px] text-muted-foreground leading-tight">{ytdP ? formatNumberSpaces(ytdP) : "·"}</div>
                        <div className={`font-mono tabular-nums leading-tight ${ytdA ? "cms-amount-positive" : "text-muted-foreground/60"}`}>
                          {ytdA ? formatNumberSpaces(ytdA) : "·"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
              Grey = plan · Green = actual. {canEdit ? "Click plan to edit." : "Read-only for your role."}
            </div>
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}
