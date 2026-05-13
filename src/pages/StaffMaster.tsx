import { useMemo, useState } from "react";
import { UserCheck, Plus, Pencil, Camera, RotateCw } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { useEmployees, useUpsertEmployee, type Employee } from "@/hooks/use-payroll";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format-date";
import { useQueryClient } from "@tanstack/react-query";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n).replace(/,/g, " ");

const DEPT_ORDER = ["Pit", "Floor", "Security", "Office"] as const;

const tenureYears = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years.toFixed(1);
};

const categoryBadge = (e: Employee) => {
  if (e.is_pit_boss) return <Badge variant="secondary" className="ml-1 px-1 text-[10px]">PB</Badge>;
  if (e.dealer_category === "dealer") return <Badge variant="outline" className="ml-1 px-1 text-[10px]">D</Badge>;
  if (e.dealer_category === "inspector") return <Badge variant="outline" className="ml-1 px-1 text-[10px]">I</Badge>;
  if (e.dealer_category === "trainee") return <Badge variant="outline" className="ml-1 px-1 text-[10px]">T</Badge>;
  return null;
};

const StaffMaster = () => {
  const { roles } = useAuth();
  const { activeCasinoId } = useCasino();
  const qc = useQueryClient();
  const canEdit = roles.includes("hr") || roles.includes("manager") || roles.includes("super_admin");
  const { data: employees = [], isLoading } = useEmployees();
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);
  const [reimporting, setReimporting] = useState(false);

  const grouped = useMemo(() => {
    const by: Record<string, Employee[]> = { Pit: [], Floor: [], Security: [], Office: [], Other: [] };
    for (const e of employees) {
      const k = (DEPT_ORDER as readonly string[]).includes(e.department) ? e.department : "Other";
      by[k].push(e);
    }
    for (const k of Object.keys(by)) by[k].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return by;
  }, [employees]);

  const totalCols = 14;

  const handleReimport = async () => {
    if (!activeCasinoId) return;
    if (!confirm("Rebuild the entire Staff Master from current Staff and Pit Personnel? Bank/NSSF/Tax info entered manually for this casino will be cleared.")) return;
    setReimporting(true);
    try {
      const { data, error } = await supabase.rpc("reimport_staff_master", { p_casino_id: activeCasinoId });
      if (error) throw error;
      const r = data as any;
      toast.success(`Imported ${r.total} employees (Pit ${r.dealers_imported} + Staff ${r.staff_imported})`);
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReimporting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader icon={UserCheck} title="Staff Master" subtitle="Universal directory of all casino personnel — Pit, Floor, Security, Office">
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={handleReimport} disabled={reimporting}>
              <RotateCw className={`w-4 h-4 mr-1 ${reimporting ? "animate-spin" : ""}`} /> Reimport
            </Button>
            <Button onClick={() => setEditing({ payroll_status: "active", department: "Floor" })} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Employee
            </Button>
          </>
        )}
      </PageHeader>

      <PageSection card={false}>
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-4">Loading…</div>
        ) : (
          <DataTable>
            <DTHead>
              <DTRow>
                <DTHeader className="w-12"></DTHeader>
                <DTHeader>Name</DTHeader>
                <DTHeader>Position</DTHeader>
                <DTHeader>Onboarding</DTHeader>
                <DTHeader>Tenure</DTHeader>
                <DTHeader>Contract Start</DTHeader>
                <DTHeader>Contract End</DTHeader>
                <DTHeader align="right">Salary</DTHeader>
                <DTHeader>Bank</DTHeader>
                <DTHeader>Account #</DTHeader>
                <DTHeader>NSSF</DTHeader>
                <DTHeader>Tax ID</DTHeader>
                <DTHeader>Status</DTHeader>
                <DTHeader></DTHeader>
              </DTRow>
            </DTHead>
            <DTBody>
              {employees.length === 0 && (
                <DTRow><DTCell colSpan={totalCols} className="text-center text-muted-foreground py-8">No employees yet — click Reimport to build from Staff and Pit Personnel</DTCell></DTRow>
              )}
              {(["Pit", "Floor", "Security", "Office", "Other"] as const).flatMap(dept => {
                const list = grouped[dept];
                if (!list || list.length === 0) return [] as JSX.Element[];
                const rows: JSX.Element[] = [];
                rows.push(
                  <DTRow key={`hdr-${dept}`} className="bg-muted/50">
                    <DTCell colSpan={totalCols} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-1.5">
                      {dept} <span className="ml-2 text-[10px]">({list.length})</span>
                    </DTCell>
                  </DTRow>
                );
                for (const e of list) {
                  const tenure = tenureYears(e.onboarding_date);
                  rows.push(
                    <DTRow key={e.id}>
                      <DTCell><PhotoBadge employee={e} canEdit={canEdit} /></DTCell>
                      <DTCell className="font-medium">{e.full_name}</DTCell>
                      <DTCell>
                        <span className="inline-flex items-center">
                          {e.position || <span className="text-muted-foreground">·</span>}
                          {categoryBadge(e)}
                        </span>
                      </DTCell>
                      <DTCell className="text-xs">{e.onboarding_date ? fmtDate(e.onboarding_date) : <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell className="text-xs font-mono">{tenure ? `${tenure}y` : <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell className="text-xs">{e.contract_start ? fmtDate(e.contract_start) : <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell className="text-xs">{e.contract_end ? fmtDate(e.contract_end) : <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell numeric>{fmt(e.basic_salary)}</DTCell>
                      <DTCell>{e.bank?.bank_name || <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell className="font-mono text-xs">{e.bank?.account_number || <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell className="font-mono text-xs">{e.nssf_number || <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell className="font-mono text-xs">{e.tax_id || <span className="text-muted-foreground">·</span>}</DTCell>
                      <DTCell>
                        <span className={e.payroll_status === "active" ? "text-emerald-600" : "text-muted-foreground"}>
                          {e.payroll_status}
                        </span>
                      </DTCell>
                      <DTCell>
                        {canEdit && (
                          <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </DTCell>
                    </DTRow>
                  );
                }
                return rows;
              })}
            </DTBody>
          </DataTable>
        )}
      </PageSection>

      {editing && (
        <EmployeeEditorDialog value={editing} onClose={() => setEditing(null)} />
      )}
    </PageShell>
  );
};

const PhotoBadge = ({ employee, canEdit }: { employee: Employee; canEdit: boolean }) => {
  const upsert = useUpsertEmployee();
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${employee.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("employee-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("employee-photos").getPublicUrl(path);
    await upsert.mutateAsync({ id: employee.id, photo_url: data.publicUrl } as any);
  };
  return employee.photo_url ? (
    <img src={employee.photo_url} alt={employee.full_name} className="w-8 h-8 rounded object-cover" />
  ) : canEdit ? (
    <label className="cursor-pointer inline-flex items-center justify-center w-8 h-8 rounded border border-dashed border-border text-muted-foreground hover:bg-muted">
      <Camera className="w-3.5 h-3.5" />
      <input type="file" accept="image/*" className="hidden" onChange={onPick} />
    </label>
  ) : (
    <span className="text-muted-foreground">·</span>
  );
};

const EmployeeEditorDialog = ({ value, onClose }: { value: Partial<Employee>; onClose: () => void }) => {
  const [v, setV] = useState<any>({ ...value, bank: value.bank || {} });
  const upsert = useUpsertEmployee();
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }));
  const setBank = (k: string, val: any) => setV((s: any) => ({ ...s, bank: { ...s.bank, [k]: val } }));
  const isPit = v.department === "Pit";
  const save = async () => {
    if (!v.full_name?.trim()) { toast.error("Name is required"); return; }
    await upsert.mutateAsync(v);
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{v.id ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Field label="Full Name *" v={v.full_name} onChange={x => set("full_name", x)} />
          <Field label="Position"   v={v.position}  onChange={x => set("position",  x)} />
          <Field label="Department (Pit/Floor/Security/Office)" v={v.department} onChange={x => set("department", x)} />
          <Field label="Status" v={v.payroll_status ?? "active"} onChange={x => set("payroll_status", x)} />
          <Field label="Onboarding Date" type="date" v={v.onboarding_date ?? ""} onChange={x => set("onboarding_date", x || null)} />
          <Field label="Contract Start" type="date" v={v.contract_start ?? ""} onChange={x => set("contract_start", x || null)} />
          <Field label="Contract End" type="date" v={v.contract_end ?? ""} onChange={x => set("contract_end", x || null)} />
          <Field label="Basic Salary (TZS)" type="number" v={v.basic_salary ?? 0} onChange={x => set("basic_salary", Number(x) || 0)} />
          {isPit && (
            <>
              <Field label="Dealer Category (dealer/inspector/trainee)" v={v.dealer_category ?? ""} onChange={x => set("dealer_category", x || null)} />
              <label className="space-y-1 text-xs flex flex-col">
                <span className="text-muted-foreground">Pit Boss</span>
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={v.is_pit_boss ? "yes" : "no"} onChange={e => set("is_pit_boss", e.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </>
          )}
          <Field label="NSSF Number" v={v.nssf_number ?? ""} onChange={x => set("nssf_number", x)} />
          <Field label="Tax ID" v={v.tax_id ?? ""} onChange={x => set("tax_id", x)} />
          <Field label="GEPF Number" v={v.gepf_number ?? ""} onChange={x => set("gepf_number", x)} />
          <div />
          <Field label="Bank Name" v={v.bank?.bank_name ?? ""} onChange={x => setBank("bank_name", x)} />
          <Field label="Bank Code" v={v.bank?.bank_code ?? ""} onChange={x => setBank("bank_code", x)} />
          <Field label="Branch Code" v={v.bank?.branch_code ?? ""} onChange={x => setBank("branch_code", x)} />
          <Field label="Account Number" v={v.bank?.account_number ?? ""} onChange={x => setBank("account_number", x)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={upsert.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, v, onChange, type = "text" }: { label: string; v: any; onChange: (x: string) => void; type?: string }) => (
  <label className="space-y-1 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <Input type={type} value={v ?? ""} onChange={e => onChange(e.target.value)} />
  </label>
);

export default StaffMaster;
