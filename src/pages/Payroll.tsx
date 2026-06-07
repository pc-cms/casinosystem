import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Plus, Copy } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { usePayrollPeriods, useCreatePayrollPeriod, useDuplicatePayrollPeriod, type PayrollPeriod } from "@/hooks/use-payroll";
import { fmtDateTime } from "@/lib/format-date";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const statusBadge = (s: PayrollPeriod["status"]) => {
  const cls = s === "locked" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : s === "hr_approved" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-muted text-muted-foreground";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{s.replace("_"," ")}</span>;
};

const Payroll = () => {
  const nav = useNavigate();
  const { roles } = useAuth();
  const canCreate = roles.some(r => ["hr","finance_manager","super_admin"].includes(r));
  const { data: periods = [], isLoading } = usePayrollPeriods();
  const create = useCreatePayrollPeriod();
  const duplicate = useDuplicatePayrollPeriod();
  const [newOpen, setNewOpen] = useState(false);
  const [dupSource, setDupSource] = useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const handleCreate = async () => {
    const id = await create.mutateAsync({ year, month });
    setNewOpen(false);
    nav(`/payroll/${id}`);
  };
  const handleDuplicate = async () => {
    if (!dupSource) return;
    const id = await duplicate.mutateAsync({ source: dupSource, year, month });
    setDupSource(null);
    nav(`/payroll/${id}`);
  };

  return (
    <PageShell>
      <PageHeader icon={Wallet} title="Payroll" subtitle="Monthly payroll periods">
        {canCreate && (
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1"/>New Month</Button>
        )}
      </PageHeader>

      <PageSection card={false}>
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-4">Loading…</div>
        ) : (
          <DataTable>
            <DTHead><DTRow>
              <DTHeader>Period</DTHeader>
              <DTHeader>Status</DTHeader>
              <DTHeader>HR Approved</DTHeader>
              <DTHeader>Manager Approved</DTHeader>
              <DTHeader>Locked</DTHeader>
              <DTHeader></DTHeader>
            </DTRow></DTHead>
            <DTBody>
              {periods.length === 0 && (
                <DTRow><DTCell colSpan={6} className="text-center text-muted-foreground py-8">No payroll periods yet</DTCell></DTRow>
              )}
              {periods.map(p => (
                <DTRow key={p.id} className="cursor-pointer" onClick={() => nav(`/payroll/${p.id}`)}>
                  <DTCell className="font-medium">{MONTHS[p.month-1]} {p.year}</DTCell>
                  <DTCell>{statusBadge(p.status)}</DTCell>
                  <DTCell className="text-xs text-muted-foreground">{p.hr_approved_at ? fmtDateTime(p.hr_approved_at) : "·"}</DTCell>
                  <DTCell className="text-xs text-muted-foreground">{p.manager_approved_at ? fmtDateTime(p.manager_approved_at) : "·"}</DTCell>
                  <DTCell className="text-xs text-muted-foreground">{p.locked_at ? fmtDateTime(p.locked_at) : "·"}</DTCell>
                  <DTCell>
                    {canCreate && (
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setDupSource(p.id); }}>
                        <Copy className="w-3 h-3 mr-1"/> Duplicate
                      </Button>
                    )}
                  </DTCell>
                </DTRow>
              ))}
            </DTBody>
          </DataTable>
        )}
      </PageSection>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Payroll Period</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Year</span>
              <YearSelect value={year} onChange={setYear} className="w-full" /></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Month</span>
              <Input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} /></label>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupSource} onOpenChange={o => !o && setDupSource(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicate to New Month</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Year</span>
              <YearSelect value={year} onChange={setYear} className="w-full" /></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Month</span>
              <Input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} /></label>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupSource(null)}>Cancel</Button>
            <Button onClick={handleDuplicate} disabled={duplicate.isPending}>Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default Payroll;
