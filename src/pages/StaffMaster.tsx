import { useState } from "react";
import { UserCheck, Plus, Pencil, Camera } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useEmployees, useUpsertEmployee, type Employee } from "@/hooks/use-payroll";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n).replace(/,/g, " ");

const StaffMaster = () => {
  const { roles } = useAuth();
  const canEdit = roles.includes("hr") || roles.includes("super_admin");
  const { data: employees = [], isLoading } = useEmployees();
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);

  return (
    <PageShell>
      <PageHeader icon={UserCheck} title="Staff Master" subtitle="Universal employee directory used by Payroll">
        {canEdit && (
          <Button onClick={() => setEditing({ payroll_status: "active" })} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Employee
          </Button>
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
                <DTHeader>Department</DTHeader>
                <DTHeader align="right">Basic Salary</DTHeader>
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
                <DTRow><DTCell colSpan={11} className="text-center text-muted-foreground py-8">No employees yet</DTCell></DTRow>
              )}
              {employees.map(e => (
                <DTRow key={e.id}>
                  <DTCell>
                    <PhotoBadge employee={e} canEdit={canEdit} />
                  </DTCell>
                  <DTCell className="font-medium">{e.full_name}</DTCell>
                  <DTCell>{e.position || <span className="text-muted-foreground">·</span>}</DTCell>
                  <DTCell>{e.department || <span className="text-muted-foreground">·</span>}</DTCell>
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
              ))}
            </DTBody>
          </DataTable>
        )}
      </PageSection>

      {editing && (
        <EmployeeEditorDialog
          value={editing}
          onClose={() => setEditing(null)}
        />
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
          <Field label="Department" v={v.department} onChange={x => set("department", x)} />
          <Field label="Employment Date" type="date" v={v.employment_date ?? ""} onChange={x => set("employment_date", x || null)} />
          <Field label="Basic Salary (TZS)" type="number" v={v.basic_salary ?? 0} onChange={x => set("basic_salary", Number(x) || 0)} />
          <Field label="Status" v={v.payroll_status ?? "active"} onChange={x => set("payroll_status", x)} />
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
