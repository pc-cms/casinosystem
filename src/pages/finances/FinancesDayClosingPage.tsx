import { useEffect, useState, useMemo } from "react";
import { ClipboardPen, Lock, Plus, Trash2 } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import {
  useFinDayClosing, useDayClosingList, useUpsertDayClosing, useLockDayClosing,
  useShiftsTablesResultForDate, useFinWallets,
} from "@/hooks/use-fin";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";

const today = () => new Date().toISOString().slice(0, 10);

export default function FinancesDayClosingPage() {
  const [bd, setBd] = useState(today());
  const { data: existing } = useFinDayClosing(bd);
  const { data: list = [] } = useDayClosingList();
  const { data: tablesAuto = 0 } = useShiftsTablesResultForDate(bd);
  const { data: wallets = [] } = useFinWallets();
  const upsert = useUpsertDayClosing();
  const lock = useLockDayClosing();

  const [slots, setSlots] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    if (existing) {
      setSlots(Number(existing.slots_result || 0));
      setNotes(existing.notes || "");
      setLines(Array.isArray(existing.income_lines) ? (existing.income_lines as any[]) : []);
    } else {
      setSlots(0); setNotes(""); setLines([]);
    }
  }, [existing?.id]);

  const locked = !!existing?.locked_at;
  const incomeTotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.amount || 0) * Number(l.fx_rate || 1), 0),
    [lines]
  );

  const addLine = () => setLines((l) => [...l, { wallet_id: "", currency: "TZS", amount: 0, fx_rate: 1, denominations: {} }]);
  const updateLine = (i: number, patch: any) => setLines((l) => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));

  const save = async () => {
    await upsert.mutateAsync({
      id: existing?.id,
      business_date: bd,
      tables_result: tablesAuto,
      slots_result: slots,
      income_lines: lines,
      notes,
    });
  };

  return (
    <PageShell>
      <PageHeader icon={ClipboardPen} title="Day Closing" subtitle="Tables auto · Slots manual · Income lines">
        <Input type="date" value={bd} onChange={(e) => setBd(e.target.value)} className="w-40 font-mono text-xs" />
      </PageHeader>

      <div className="grid sm:grid-cols-3 gap-3">
        <PageSection title="Tables (auto)">
          <div className="text-2xl font-mono">{formatNumberSpaces(tablesAuto)}</div>
          <div className="text-xs text-muted-foreground">From shifts.tables_result · read-only</div>
        </PageSection>
        <PageSection title="Slots (manual)">
          <Input type="number" step="0.01" disabled={locked} value={slots || ""} onChange={(e) => setSlots(Number(e.target.value))} className="text-lg font-mono" />
        </PageSection>
        <PageSection title="Total Income (lines)">
          <div className="text-2xl font-mono">{formatNumberSpaces(incomeTotal)}</div>
        </PageSection>
      </div>

      <PageSection title="Income Lines" titleRight={!locked && <Button size="sm" variant="outline" onClick={addLine}><Plus className="w-3.5 h-3.5" /> Line</Button>}>
        {!lines.length && <div className="text-sm text-muted-foreground text-center py-4">No income lines</div>}
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground">Wallet</label>
              <Select value={l.wallet_id} onValueChange={(v) => {
                const w = wallets.find((x: any) => x.id === v);
                updateLine(i, { wallet_id: v, currency: w?.currency || l.currency });
              }} disabled={locked}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.currency})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-3"><label className="text-xs text-muted-foreground">Amount</label>
              <Input type="number" step="0.01" disabled={locked} value={l.amount || ""} onChange={(e) => updateLine(i, { amount: Number(e.target.value) })} /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground">Currency</label>
              <Input value={l.currency} disabled className="font-mono" /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground">FX → TZS</label>
              <Input type="number" step="0.000001" disabled={locked} value={l.fx_rate || 1} onChange={(e) => updateLine(i, { fx_rate: Number(e.target.value) })} /></div>
            <div className="col-span-1 text-right">
              {!locked && <Button variant="ghost" size="sm" onClick={() => removeLine(i)}><Trash2 className="w-3.5 h-3.5" /></Button>}
            </div>
          </div>
        ))}
      </PageSection>

      <PageSection title="Notes">
        <Input value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
      </PageSection>

      <div className="flex justify-end gap-2">
        {!locked && <Button onClick={save}>Save Draft</Button>}
        {existing && !locked && (
          <Button onClick={async () => { await save(); await lock.mutateAsync(existing.id); }}>
            <Lock className="w-4 h-4" /> Lock & Post Income
          </Button>
        )}
        {locked && <span className="text-xs text-muted-foreground self-center">Locked {fmtDate(existing!.locked_at)}</span>}
      </div>

      <PageSection title="Recent closings">
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Date</th><th className="text-right">Tables</th><th className="text-right">Slots</th><th className="text-right">Income lines</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40 cursor-pointer" onClick={() => setBd(r.business_date)}>
                  <td className="px-3 py-1.5 font-mono text-xs">{fmtDate(r.business_date)}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(r.tables_result))}</td>
                  <td className="text-right font-mono">{formatNumberSpaces(Number(r.slots_result))}</td>
                  <td className="text-right">{Array.isArray(r.income_lines) ? r.income_lines.length : 0}</td>
                  <td className="text-xs">{r.locked_at ? <span className="text-green-600">Locked</span> : <span className="text-muted-foreground">Draft</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
