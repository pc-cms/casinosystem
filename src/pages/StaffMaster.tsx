import { useMemo, useRef, useState } from "react";
import { UserCheck, Plus, Pencil, Camera, RotateCw, Upload } from "lucide-react";
import { parseStaffMasterXlsx, type ParsedStaffRow } from "@/lib/staff-master-import";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { useEmployees, useUpsertEmployee, type Employee } from "@/hooks/use-payroll";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format-date";
import { useQueryClient } from "@tanstack/react-query";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n).replace(/,/g, " ");
const DEPT_ORDER = ["Management", "Office", "Cash Desk", "Live Game", "Slots", "F&B", "Security", "Housekeeper", "Pit", "Floor"] as const;

const yearsBetween = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
};

const ageFromBirthday = (b: string | null) => {
  const y = yearsBetween(b);
  return y == null ? null : Math.floor(y);
};

const daysFromToday = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.floor(ms / (24 * 3600 * 1000));
};

const monthLabel = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", { month: "short", year: "numeric" });
};

const dot = <span className="text-muted-foreground">·</span>;

const yesNo = (v: boolean) => v ? <span className="text-emerald-600">Yes</span> : dot;

const signedDays = (n: number | null) => {
  if (n == null) return dot;
  const cls = n < 0 ? "text-destructive" : n < 30 ? "text-amber-600" : "text-emerald-600";
  return <span className={cls}>{n}</span>;
};

const categoryBadge = (e: Employee) => {
  if (e.is_pit_boss) return <Badge variant="secondary" className="ml-1 px-1 text-[10px]">PB</Badge>;
  if (e.dealer_category === "dealer") return <Badge variant="outline" className="ml-1 px-1 text-[10px]">D</Badge>;
  if (e.dealer_category === "inspector") return <Badge variant="outline" className="ml-1 px-1 text-[10px]">I</Badge>;
  if (e.dealer_category === "trainee") return <Badge variant="outline" className="ml-1 px-1 text-[10px]">T</Badge>;
  return null;
};

// Calculated-cell tint
const calc = "bg-muted/30";

const StaffMaster = () => {
  const { roles } = useAuth();
  const { activeCasinoId } = useCasino();
  const qc = useQueryClient();
  const canEdit = roles.includes("hr") || roles.includes("manager") || roles.includes("super_admin");
  const { data: employees = [], isLoading } = useEmployees();
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedStaffRow[] | null>(null);
  const [wipeFirst, setWipeFirst] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const by: Record<string, Employee[]> = {};
    for (const k of DEPT_ORDER) by[k] = [];
    by["Other"] = [];
    for (const e of employees) {
      const k = (DEPT_ORDER as readonly string[]).includes(e.department) ? e.department : "Other";
      (by[k] ||= []).push(e);
    }
    for (const k of Object.keys(by)) by[k].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return by;
  }, [employees]);

  const TOTAL_COLS = 33; // 32 template cols + photo

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

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const rows = await parseStaffMasterXlsx(f);
      if (!rows.length) { toast.error("No rows found in file"); return; }
      setImportPreview(rows);
      setWipeFirst(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse file");
    }
  };

  const handleConfirmImport = async () => {
    if (!activeCasinoId || !importPreview) return;
    setImporting(true);
    try {
      if (wipeFirst) {
        const { error } = await supabase.from("employees").delete().eq("casino_id", activeCasinoId);
        if (error) throw error;
      }
      const payload = importPreview.map(r => ({ ...r, casino_id: activeCasinoId, payroll_status: "active" as const }));
      // Chunked insert to keep payloads small
      for (let i = 0; i < payload.length; i += 100) {
        const slice = payload.slice(i, i + 100);
        const { error } = await supabase.from("employees").insert(slice as any);
        if (error) throw error;
      }
      toast.success(`Imported ${payload.length} employees`);
      qc.invalidateQueries({ queryKey: ["employees"] });
      setImportPreview(null);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader icon={UserCheck} title="Staff Master" subtitle="Universal directory of all casino personnel">
        {canEdit && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handlePickFile} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Import from Excel
            </Button>
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
          <div className="overflow-x-auto">
            <DataTable className="text-xs">
              <DTHead>
                <DTRow>
                  <DTHeader className="w-10"></DTHeader>
                  <DTHeader className={calc}>S/N</DTHeader>
                  <DTHeader>Name</DTHeader>
                  <DTHeader className={calc}>Remain</DTHeader>
                  <DTHeader>Dept</DTHeader>
                  <DTHeader>Position</DTHeader>
                  <DTHeader>Contract</DTHeader>
                  <DTHeader align="right">Salary</DTHeader>
                  <DTHeader>Joining</DTHeader>
                  <DTHeader className={calc}>Exp YY</DTHeader>
                  <DTHeader>Birthday</DTHeader>
                  <DTHeader className={calc}>Age</DTHeader>
                  <DTHeader>Phone</DTHeader>
                  <DTHeader>Job Desc</DTHeader>
                  <DTHeader>Gen Det</DTHeader>
                  <DTHeader>Intro</DTHeader>
                  <DTHeader>Rules</DTHeader>
                  <DTHeader>Discip</DTHeader>
                  <DTHeader>Confid</DTHeader>
                  <DTHeader>Contr Start</DTHeader>
                  <DTHeader>Contr End</DTHeader>
                  <DTHeader className={calc}>End Mon</DTHeader>
                  <DTHeader align="right">AL Earn</DTHeader>
                  <DTHeader align="right">AL Used</DTHeader>
                  <DTHeader align="right">AL Sold</DTHeader>
                  <DTHeader>Corp Mail</DTHeader>
                  <DTHeader>Gend</DTHeader>
                  <DTHeader>Nation</DTHeader>
                  <DTHeader>Lic Type</DTHeader>
                  <DTHeader>Lic Av</DTHeader>
                  <DTHeader>Pass Date</DTHeader>
                  <DTHeader className={calc}>Renew</DTHeader>
                  <DTHeader>Uniform</DTHeader>
                  <DTHeader></DTHeader>
                </DTRow>
              </DTHead>
              <DTBody>
                {employees.length === 0 && (
                  <DTRow><DTCell colSpan={TOTAL_COLS} className="text-center text-muted-foreground py-8">No employees yet — click Reimport to build from Staff and Pit Personnel</DTCell></DTRow>
                )}
                {([...DEPT_ORDER, "Other"] as const).flatMap(dept => {
                  const list = grouped[dept];
                  if (!list || list.length === 0) return [] as JSX.Element[];
                  const rows: JSX.Element[] = [];
                  rows.push(
                    <DTRow key={`hdr-${dept}`} className="bg-muted/50">
                      <DTCell colSpan={TOTAL_COLS} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground py-1.5">
                        {dept} <span className="ml-2 text-[10px]">({list.length})</span>
                      </DTCell>
                    </DTRow>
                  );
                  list.forEach((e, idx) => {
                    const exp = yearsBetween(e.onboarding_date);
                    const age = ageFromBirthday(e.birthday);
                    const remain = (Number(e.annual_leave_earned) || 0) - (Number(e.annual_leave_used) || 0) - (Number(e.annual_leave_sold) || 0);
                    const renew = daysFromToday(e.license_pass_date);
                    rows.push(
                      <DTRow key={e.id}>
                        <DTCell><PhotoBadge employee={e} canEdit={canEdit} /></DTCell>
                        <DTCell className={`${calc} font-mono`}>{idx + 1}</DTCell>
                        <DTCell className="font-medium whitespace-nowrap">{e.full_name}</DTCell>
                        <DTCell className={`${calc} font-mono`}>{signedDays(remain)}</DTCell>
                        <DTCell>{e.department || dot}</DTCell>
                        <DTCell>
                          <span className="inline-flex items-center">
                            {e.position || dot}
                            {categoryBadge(e)}
                          </span>
                        </DTCell>
                        <DTCell>{e.contract_type || dot}</DTCell>
                        <DTCell numeric className="font-mono">{fmt(e.basic_salary)}</DTCell>
                        <DTCell>{e.onboarding_date ? fmtDate(e.onboarding_date) : dot}</DTCell>
                        <DTCell className={`${calc} font-mono`}>{exp != null ? exp.toFixed(1) : dot}</DTCell>
                        <DTCell>{e.birthday ? fmtDate(e.birthday) : dot}</DTCell>
                        <DTCell className={`${calc} font-mono`}>{age ?? dot}</DTCell>
                        <DTCell className="font-mono">{e.phone || dot}</DTCell>
                        <DTCell className="max-w-[120px] truncate" title={e.job_description ?? ""}>{e.job_description || dot}</DTCell>
                        <DTCell className="max-w-[120px] truncate" title={e.general_details ?? ""}>{e.general_details || dot}</DTCell>
                        <DTCell>{yesNo(e.intro_to_work)}</DTCell>
                        <DTCell>{yesNo(e.staff_rules_acknowledged)}</DTCell>
                        <DTCell>{yesNo(e.disciplinary_acknowledged)}</DTCell>
                        <DTCell>{yesNo(e.confidentiality_agreement)}</DTCell>
                        <DTCell>{e.contract_start ? fmtDate(e.contract_start) : dot}</DTCell>
                        <DTCell>{e.contract_end ? fmtDate(e.contract_end) : dot}</DTCell>
                        <DTCell className={calc}>{monthLabel(e.contract_end) ?? dot}</DTCell>
                        <DTCell numeric className="font-mono">{Number(e.annual_leave_earned) || 0}</DTCell>
                        <DTCell numeric className="font-mono">{Number(e.annual_leave_used) || 0}</DTCell>
                        <DTCell numeric className="font-mono">{Number(e.annual_leave_sold) || 0}</DTCell>
                        <DTCell className="max-w-[140px] truncate" title={e.corporate_mail ?? ""}>{e.corporate_mail || dot}</DTCell>
                        <DTCell>{e.gender || dot}</DTCell>
                        <DTCell>{e.nationality || dot}</DTCell>
                        <DTCell>{e.license_type || dot}</DTCell>
                        <DTCell>{yesNo(e.license_available)}</DTCell>
                        <DTCell>{e.license_pass_date ? fmtDate(e.license_pass_date) : dot}</DTCell>
                        <DTCell className={`${calc} font-mono`}>{signedDays(renew)}</DTCell>
                        <DTCell>{yesNo(e.uniform_issued)}</DTCell>
                        <DTCell>
                          {canEdit && (
                            <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                        </DTCell>
                      </DTRow>
                    );
                  });
                  return rows;
                })}
              </DTBody>
            </DataTable>
          </div>
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
  ) : dot;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">{title}</div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
);

const EmployeeEditorDialog = ({ value, onClose }: { value: Partial<Employee>; onClose: () => void }) => {
  const [v, setV] = useState<any>({ ...value, bank: value.bank || {} });
  const upsert = useUpsertEmployee();
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }));
  const setBank = (k: string, val: any) => setV((s: any) => ({ ...s, bank: { ...s.bank, [k]: val } }));
  const isPit = v.department === "Pit";
  const remain = (Number(v.annual_leave_earned) || 0) - (Number(v.annual_leave_used) || 0) - (Number(v.annual_leave_sold) || 0);
  const save = async () => {
    if (!v.full_name?.trim()) { toast.error("Name is required"); return; }
    await upsert.mutateAsync(v);
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{v.id ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
        <div className="space-y-5 py-2">
          <Section title="Identity">
            <Field label="Full Name *" v={v.full_name} onChange={x => set("full_name", x)} />
            <Select label="Gender" v={v.gender ?? ""} onChange={x => set("gender", x || null)} options={["", "M", "F"]} />
            <Field label="Birthday" type="date" v={v.birthday ?? ""} onChange={x => set("birthday", x || null)} />
            <Field label="Nationality" v={v.nationality ?? ""} onChange={x => set("nationality", x)} />
            <Field label="Phone" v={v.phone ?? ""} onChange={x => set("phone", x)} />
            <Field label="Corporate Mail" v={v.corporate_mail ?? ""} onChange={x => set("corporate_mail", x)} />
          </Section>

          <Section title="Position">
            <Field label="Department (Pit/Floor/Security/Office)" v={v.department} onChange={x => set("department", x)} />
            <Field label="Position" v={v.position} onChange={x => set("position", x)} />
            <Field label="Contract Type (PM/FT/PT)" v={v.contract_type ?? ""} onChange={x => set("contract_type", x)} />
            <Select label="Status" v={v.payroll_status ?? "active"} onChange={x => set("payroll_status", x)} options={["active", "inactive"]} />
            {isPit && (
              <>
                <Field label="Dealer Category (dealer/inspector/trainee)" v={v.dealer_category ?? ""} onChange={x => set("dealer_category", x || null)} />
                <Select label="Pit Boss" v={v.is_pit_boss ? "yes" : "no"} onChange={x => set("is_pit_boss", x === "yes")} options={["no", "yes"]} />
              </>
            )}
          </Section>

          <Section title="Contract & Salary">
            <Field label="Joining Date" type="date" v={v.onboarding_date ?? ""} onChange={x => set("onboarding_date", x || null)} />
            <Field label="Basic Salary (TZS)" type="number" v={v.basic_salary ?? 0} onChange={x => set("basic_salary", Number(x) || 0)} />
            <Field label="Contract Start" type="date" v={v.contract_start ?? ""} onChange={x => set("contract_start", x || null)} />
            <Field label="Contract End" type="date" v={v.contract_end ?? ""} onChange={x => set("contract_end", x || null)} />
          </Section>

          <Section title="Annual Leave (days)">
            <Field label="Earned" type="number" v={v.annual_leave_earned ?? 0} onChange={x => set("annual_leave_earned", Number(x) || 0)} />
            <Field label="Used" type="number" v={v.annual_leave_used ?? 0} onChange={x => set("annual_leave_used", Number(x) || 0)} />
            <Field label="Sold" type="number" v={v.annual_leave_sold ?? 0} onChange={x => set("annual_leave_sold", Number(x) || 0)} />
            <div className="space-y-1 text-xs">
              <span className="text-muted-foreground">Remain (calc)</span>
              <div className={`h-9 rounded-md border border-input bg-muted px-3 flex items-center font-mono ${remain < 0 ? "text-destructive" : "text-emerald-600"}`}>{remain}</div>
            </div>
          </Section>

          <Section title="Compliance & Other">
            <Check label="Introduction to Work" v={v.intro_to_work} onChange={x => set("intro_to_work", x)} />
            <Check label="Staff Rules Acknowledged" v={v.staff_rules_acknowledged} onChange={x => set("staff_rules_acknowledged", x)} />
            <Check label="Disciplinary Procedure" v={v.disciplinary_acknowledged} onChange={x => set("disciplinary_acknowledged", x)} />
            <Check label="Confidentiality Agreement" v={v.confidentiality_agreement} onChange={x => set("confidentiality_agreement", x)} />
            <Field label="License Type" v={v.license_type ?? ""} onChange={x => set("license_type", x)} />
            <Check label="License Available" v={v.license_available} onChange={x => set("license_available", x)} />
            <Field label="Pass Date (license)" type="date" v={v.license_pass_date ?? ""} onChange={x => set("license_pass_date", x || null)} />
            <Check label="Uniform Issued" v={v.uniform_issued} onChange={x => set("uniform_issued", x)} />
            <div className="col-span-2">
              <label className="space-y-1 text-xs block">
                <span className="text-muted-foreground">Job Description</span>
                <Textarea rows={2} value={v.job_description ?? ""} onChange={e => set("job_description", e.target.value)} />
              </label>
            </div>
            <div className="col-span-2">
              <label className="space-y-1 text-xs block">
                <span className="text-muted-foreground">General Details</span>
                <Textarea rows={2} value={v.general_details ?? ""} onChange={e => set("general_details", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="Bank & Tax">
            <Field label="NSSF Number" v={v.nssf_number ?? ""} onChange={x => set("nssf_number", x)} />
            <Field label="Tax ID" v={v.tax_id ?? ""} onChange={x => set("tax_id", x)} />
            <Field label="GEPF Number" v={v.gepf_number ?? ""} onChange={x => set("gepf_number", x)} />
            <div />
            <Field label="Bank Name" v={v.bank?.bank_name ?? ""} onChange={x => setBank("bank_name", x)} />
            <Field label="Bank Code" v={v.bank?.bank_code ?? ""} onChange={x => setBank("bank_code", x)} />
            <Field label="Branch Code" v={v.bank?.branch_code ?? ""} onChange={x => setBank("branch_code", x)} />
            <Field label="Account Number" v={v.bank?.account_number ?? ""} onChange={x => setBank("account_number", x)} />
          </Section>
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

const Select = ({ label, v, onChange, options }: { label: string; v: string; onChange: (x: string) => void; options: string[] }) => (
  <label className="space-y-1 text-xs flex flex-col">
    <span className="text-muted-foreground">{label}</span>
    <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={v} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o || "—"}</option>)}
    </select>
  </label>
);

const Check = ({ label, v, onChange }: { label: string; v: boolean; onChange: (x: boolean) => void }) => (
  <label className="flex items-center gap-2 text-xs h-9 px-1">
    <Checkbox checked={!!v} onCheckedChange={(c) => onChange(!!c)} />
    <span>{label}</span>
  </label>
);

export default StaffMaster;
