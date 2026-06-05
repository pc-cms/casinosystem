import { useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { useFinMoneyChange, useCreateMoneyChange, useFinWallets } from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";

export default function FinancesMoneyChangePage() {
  const { data: rows = [] } = useFinMoneyChange();
  const { data: wallets = [] } = useFinWallets();
  const create = useCreateMoneyChange();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    business_date: new Date().toISOString().slice(0, 10),
    from_wallet_id: "", to_wallet_id: "",
    from_amount: 0, to_amount: 0, rate: 1,
    from_currency: "TZS", to_currency: "USD", note: "",
  });

  return (
    <PageShell>
      <PageHeader icon={ArrowLeftRight} title="Money Change" subtitle="Cross-currency / cross-casino allowed">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New Change</Button>
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Date</th><th>From</th><th className="text-right">Amount</th><th>→</th><th>To</th><th className="text-right">Amount</th><th className="text-right">Rate</th><th className="text-left">Note</th></tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-1.5 font-mono text-xs">{fmtDate(r.business_date)}</td>
                  <td>{r.fwf?.name}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(r.from_amount))} {r.from_currency}</td>
                  <td>→</td>
                  <td>{r.fwt?.name}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(r.to_amount))} {r.to_currency}</td>
                  <td className="text-right font-mono">{r.rate}</td>
                  <td className="text-xs text-muted-foreground">{r.note}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="text-center text-muted-foreground py-6">No changes</td></tr>}
            </tbody>
          </table>
        </div>
      </PageSection>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="New money change">
        <FormGrid>
          <FormField span={4} label="Business date"><Input type="date" value={form.business_date} onChange={(e) => setForm({ ...form, business_date: e.target.value })} /></FormField>
          <FormField span={4} label="From wallet">
            <Select value={form.from_wallet_id} onValueChange={(v) => {
              const w = wallets.find((x: any) => x.id === v);
              setForm({ ...form, from_wallet_id: v, from_currency: w?.currency || form.from_currency });
            }}>
              <SelectTrigger><SelectValue placeholder="From" /></SelectTrigger>
              <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.currency})</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField span={4} label="To wallet">
            <Select value={form.to_wallet_id} onValueChange={(v) => {
              const w = wallets.find((x: any) => x.id === v);
              setForm({ ...form, to_wallet_id: v, to_currency: w?.currency || form.to_currency, to_casino_id: w?.casino_id });
            }}>
              <SelectTrigger><SelectValue placeholder="To" /></SelectTrigger>
              <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.currency})</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField span={4} label={`From amount (${form.from_currency})`}><Input type="number" step="0.01" value={form.from_amount || ""} onChange={(e) => setForm({ ...form, from_amount: Number(e.target.value) })} /></FormField>
          <FormField span={4} label="Rate"><Input type="number" step="0.000001" value={form.rate || 1} onChange={(e) => setForm({ ...form, rate: Number(e.target.value), to_amount: Number((Number(form.from_amount) * Number(e.target.value)).toFixed(2)) })} /></FormField>
          <FormField span={4} label={`To amount (${form.to_currency})`}><Input type="number" step="0.01" value={form.to_amount || ""} onChange={(e) => setForm({ ...form, to_amount: Number(e.target.value) })} /></FormField>
          <FormField span={12} label="Note"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
        </FormGrid>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!form.from_wallet_id || !form.to_wallet_id || !form.from_amount} onClick={async () => { await create.mutateAsync(form); setOpen(false); }}>Record</Button>
        </div>
      </ResponsiveDialog>
    </PageShell>
  );
}
