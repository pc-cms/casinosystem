import { useMemo, useState } from "react";
import { Receipt, Plus, Trash2 } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import FinanceCasinoSwitcher from "@/components/finances/FinanceCasinoSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import {
  useFinExpenses, useCreateFinExpense, useVoidFinExpense,
  useFinCategories, useFinWallets, useFinBudget
} from "@/hooks/use-fin";
import { useAuth } from "@/lib/auth-context";
import { formatNumberSpaces } from "@/lib/currency";
import {
  FinTable, FinTHead, FinTBody, FinTR, FinTH, FinTD,
  FinAmount, FinDate, FinTrunc, FinEmpty, FW,
} from "@/components/finances/FinTable";

const todayBD = () => new Date().toISOString().slice(0, 10);

export default function FinancesExpensesPage() {
  const { roles } = useAuth();
  const canManage = roles.includes("super_admin") || roles.includes("manager") || roles.includes("finance_manager");
  const { data: rows = [] } = useFinExpenses();
  const { data: categories = [] } = useFinCategories();
  const { data: wallets = [] } = useFinWallets();
  const create = useCreateFinExpense();
  const voidExp = useVoidFinExpense();
  const now = new Date();
  const { data: budget = [] } = useFinBudget(now.getFullYear(), now.getMonth() + 1);

  const [open, setOpen] = useState(false);
  const [showVoided, setShowVoided] = useState(false);
  const [form, setForm] = useState<any>({
    business_date: todayBD(), fin_category_id: "", wallet_id: "",
    amount: 0, currency: "TZS", exchange_rate: 1, description: "",
    is_overrun: false, overrun_reason: "",
  });

  const visible = useMemo(() => rows.filter((r: any) => showVoided || !r.voided_at), [rows, showVoided]);

  const overrunCheck = useMemo(() => {
    if (!form.fin_category_id || !form.amount) return null;
    const b = (budget || []).find((x: any) => x.category_id === form.fin_category_id && x.currency === form.currency);
    if (!b) return null;
    const mtd = rows
      .filter((r: any) => r.fin_category_id === form.fin_category_id && !r.voided_at && r.currency === form.currency)
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const limit = Number(b.planned_amount) * (Number(b.overrun_limit_pct || 110) / 100);
    const overshoot = mtd + Number(form.amount) > limit;
    return { overshoot, limit, mtd, planned: Number(b.planned_amount) };
  }, [form, budget, rows]);

  return (
    <PageShell>
      <PageHeader icon={Receipt} title="Expenses" subtitle="Per-casino expense ledger">
        <FinanceCasinoSwitcher />
        <label className="text-xs flex items-center gap-1.5">
          <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Show voided
        </label>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New Expense</Button>}
      </PageHeader>
      <PageSection card={false}>
        <FinTable>
          <FinTHead>
            <tr>
              <FinTH className={FW.date}>Date</FinTH>
              <FinTH>Category</FinTH>
              <FinTH className={FW.wallet}>Wallet</FinTH>
              <FinTH>Description</FinTH>
              <FinTH align="right" className={FW.amount}>Amount</FinTH>
              <FinTH className={FW.actions} />
            </tr>
          </FinTHead>
          <FinTBody>
            {visible.map((r: any) => {
              const ccy = r.currency || "TZS";
              const tzs = Number(r.amount_tzs || r.amount || 0);
              const amt = Number(r.amount || 0);
              return (
                <FinTR key={r.id} className={r.voided_at ? "opacity-50 line-through" : ""}>
                  <FinTD className={FW.date}><FinDate value={r.business_date} /></FinTD>
                  <FinTD><FinTrunc max="max-w-[220px]">{r.fin_categories?.name || r.category || "—"}</FinTrunc></FinTD>
                  <FinTD className={FW.wallet}><FinTrunc max="max-w-[140px]" muted>{r.fin_wallets?.name || "—"}</FinTrunc></FinTD>
                  <FinTD><FinTrunc max="max-w-[380px]" muted>{r.description || ""}</FinTrunc></FinTD>
                  <FinTD align="right" className={FW.amount}>
                    <div className="flex flex-col items-end leading-tight">
                      <FinAmount value={tzs} signed={false} />
                      {ccy !== "TZS" && (
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          {formatNumberSpaces(amt)} {ccy}
                        </span>
                      )}
                    </div>
                  </FinTD>
                  <FinTD align="right" className={FW.actions}>
                    {canManage && !r.voided_at && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => voidExp.mutate(r.id)} title="Void / reverse">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </FinTD>
                </FinTR>
              );
            })}
            {!visible.length && <FinEmpty colSpan={6} msg="No expenses" />}
          </FinTBody>
        </FinTable>
      </PageSection>

      <ResponsiveDialog open={open} onOpenChange={setOpen} title="New expense">
        <FormGrid>
          <FormField span={4} label="Business Date">
            <Input type="date" value={form.business_date} onChange={(e) => setForm({ ...form, business_date: e.target.value })} />
          </FormField>
          <FormField span={8} label="Category">
            <Select value={form.fin_category_id} onValueChange={(v) => setForm({ ...form, fin_category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {categories.filter((c: any) => !c.is_income).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.group_name} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField span={5} label="Wallet">
            <Select value={form.wallet_id} onValueChange={(v) => {
              const w = wallets.find((x: any) => x.id === v);
              setForm({ ...form, wallet_id: v, currency: w?.currency || form.currency });
            }}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.currency})</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField span={4} label="Amount">
            <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </FormField>
          <FormField span={3} label="FX → TZS">
            <Input type="number" step="0.000001" value={form.exchange_rate || 1} onChange={(e) => setForm({ ...form, exchange_rate: Number(e.target.value) })} />
          </FormField>
          <FormField span={12} label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </FormField>
          {overrunCheck?.overshoot && (
            <FormField span={12} label="Overrun reason (required, > limit)">
              <Textarea value={form.overrun_reason} onChange={(e) => setForm({ ...form, overrun_reason: e.target.value, is_overrun: true })} rows={2} />
              <div className="text-xs cms-amount-negative mt-1">
                Limit {formatNumberSpaces(overrunCheck.limit)} · MTD {formatNumberSpaces(overrunCheck.mtd)} · This {formatNumberSpaces(Number(form.amount))} → exceeds
              </div>
            </FormField>
          )}
        </FormGrid>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!form.fin_category_id || !form.wallet_id || !form.amount || (overrunCheck?.overshoot && !form.overrun_reason)}
            onClick={async () => { await create.mutateAsync(form); setOpen(false); }}>
            Record
          </Button>
        </div>
      </ResponsiveDialog>
    </PageShell>
  );
}
