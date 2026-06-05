import { useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import FinanceCasinoSwitcher from "@/components/finances/FinanceCasinoSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { useFinWallets, useUpsertFinWallet, useFinWalletBalances } from "@/hooks/use-fin";
import { useCasino } from "@/lib/casino-context";
import { formatNumberSpaces } from "@/lib/currency";

const CURRENCIES = ["TZS", "USD", "EUR", "GBP", "KES"];
const KINDS = ["cash", "bank", "safe", "cage", "external"];

export default function FinancesWalletsPage() {
  const { activeCasinoId } = useCasino();
  const { data: wallets = [] } = useFinWallets();
  const { data: balances } = useFinWalletBalances();
  const upsert = useUpsertFinWallet();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", kind: "cash", currency: "TZS", sort_order: 0, is_active: true });

  return (
    <PageShell>
      <PageHeader icon={Wallet} title="Wallets" subtitle="Per-casino cash, bank, safe, cage">
        <FinanceCasinoSwitcher allowNetwork={false} />
        <Button onClick={() => { setForm({ name: "", kind: "cash", currency: "TZS", sort_order: 0, is_active: true }); setOpen(true); }}>
          <Plus className="w-4 h-4" /> Add Wallet
        </Button>
      </PageHeader>
      <PageSection card={false}>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Name</th><th className="text-left">Kind</th><th className="text-left">Currency</th><th className="text-right">Balance</th><th className="w-20"></th></tr>
            </thead>
            <tbody>
              {wallets.map((w: any) => (
                <tr key={w.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-1.5">{w.name}</td>
                  <td className="capitalize">{w.kind}</td>
                  <td className="font-mono">{w.currency}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(balances?.get(w.id) || 0))}</td>
                  <td className="text-right pr-3">
                    <Button variant="ghost" size="sm" onClick={() => { setForm(w); setOpen(true); }}>Edit</Button>
                  </td>
                </tr>
              ))}
              {!wallets.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No wallets yet</td></tr>}
            </tbody>
          </table>
        </div>
      </PageSection>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={form.id ? "Edit wallet" : "New wallet"}>
        <FormGrid>
          <FormField span={6} label="Name"><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
          <FormField span={3} label="Kind">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField span={3} label="Currency">
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField span={6} label="Sort order"><Input type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></FormField>
        </FormGrid>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            await upsert.mutateAsync({ ...form, casino_id: activeCasinoId });
            setOpen(false);
          }}>Save</Button>
        </div>
      </ResponsiveDialog>
    </PageShell>
  );
}
