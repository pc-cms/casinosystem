/**
 * Payroll module hooks — employees master, periods, entries, approvals.
 * Data flow: HR edits drafts → HR Approve → Manager (Finance) Approve = locked.
 * All financial computations live in DB triggers; UI sends raw inputs only.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { toast } from "sonner";

// ============= EMPLOYEES =============
export interface Employee {
  id: string;
  casino_id: string;
  staff_member_id: string | null;
  full_name: string;
  position: string;
  department: string;
  employment_date: string | null;
  photo_url: string | null;
  nssf_number: string | null;
  tax_id: string | null;
  gepf_number: string | null;
  basic_salary: number;
  payroll_status: "active" | "inactive";
  bank?: BankAccount | null;
}
export interface BankAccount {
  id: string;
  employee_id: string;
  bank_name: string;
  bank_code: string;
  branch_code: string;
  account_number: string;
  is_primary: boolean;
}

export const useEmployees = () => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["employees", activeCasinoId],
    queryFn: async (): Promise<Employee[]> => {
      let q = supabase.from("employees").select("*, employee_bank_accounts(*)").order("full_name");
      if (activeCasinoId) q = q.eq("casino_id", activeCasinoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((e: any) => ({
        ...e,
        bank: e.employee_bank_accounts?.find((b: BankAccount) => b.is_primary) ?? e.employee_bank_accounts?.[0] ?? null,
      })) as Employee[];
    },
    enabled: !!activeCasinoId,
  });
};

export const useUpsertEmployee = () => {
  const qc = useQueryClient();
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Employee> & { bank?: Partial<BankAccount> | null }) => {
      const { bank, ...emp } = input as any;
      let employeeId = emp.id as string | undefined;
      if (employeeId) {
        const { error } = await supabase.from("employees").update({
          full_name: emp.full_name, position: emp.position, department: emp.department,
          employment_date: emp.employment_date, photo_url: emp.photo_url,
          nssf_number: emp.nssf_number, tax_id: emp.tax_id, gepf_number: emp.gepf_number,
          basic_salary: emp.basic_salary ?? 0, payroll_status: emp.payroll_status ?? "active",
        }).eq("id", employeeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("employees").insert({
          casino_id: activeCasinoId, full_name: emp.full_name, position: emp.position ?? "",
          department: emp.department ?? "", employment_date: emp.employment_date,
          nssf_number: emp.nssf_number, tax_id: emp.tax_id, gepf_number: emp.gepf_number,
          basic_salary: emp.basic_salary ?? 0, payroll_status: emp.payroll_status ?? "active",
          created_by: user?.id, photo_url: emp.photo_url,
        }).select("id").single();
        if (error) throw error;
        employeeId = data.id;
      }
      if (bank && employeeId) {
        if (bank.id) {
          const { error } = await supabase.from("employee_bank_accounts").update({
            bank_name: bank.bank_name ?? "", bank_code: bank.bank_code ?? "",
            branch_code: bank.branch_code ?? "", account_number: bank.account_number ?? "",
          }).eq("id", bank.id);
          if (error) throw error;
        } else if (bank.account_number || bank.bank_name) {
          const { error } = await supabase.from("employee_bank_accounts").insert({
            employee_id: employeeId, bank_name: bank.bank_name ?? "",
            bank_code: bank.bank_code ?? "", branch_code: bank.branch_code ?? "",
            account_number: bank.account_number ?? "", is_primary: true,
          });
          if (error) throw error;
        }
      }
      return employeeId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============= PERIODS =============
export interface PayrollPeriod {
  id: string;
  casino_id: string;
  year: number;
  month: number;
  status: "draft" | "hr_approved" | "locked";
  hr_approved_by: string | null;
  hr_approved_at: string | null;
  manager_approved_by: string | null;
  manager_approved_at: string | null;
  locked_at: string | null;
}

export const usePayrollPeriods = () => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["payroll_periods", activeCasinoId],
    queryFn: async (): Promise<PayrollPeriod[]> => {
      let q = supabase.from("payroll_periods").select("*").order("year", { ascending: false }).order("month", { ascending: false });
      if (activeCasinoId) q = q.eq("casino_id", activeCasinoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PayrollPeriod[];
    },
    enabled: !!activeCasinoId,
  });
};

export const usePayrollPeriod = (id: string | undefined) =>
  useQuery({
    queryKey: ["payroll_period", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_periods").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as PayrollPeriod;
    },
    enabled: !!id,
  });

export const useCreatePayrollPeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const { data, error } = await supabase.rpc("payroll_create_period", { _year: year, _month: month });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_periods"] }); toast.success("Period created"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDuplicatePayrollPeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, year, month }: { source: string; year: number; month: number }) => {
      const { data, error } = await supabase.rpc("payroll_duplicate_period", {
        _source_period_id: source, _year: year, _month: month,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_periods"] }); toast.success("Period duplicated"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============= ENTRIES =============
export interface PayrollEntry {
  id: string;
  period_id: string;
  employee_id: string;
  casino_id: string;
  snapshot_full_name: string;
  snapshot_position: string;
  snapshot_basic_salary: number;
  snapshot_account_number: string;
  snapshot_bank_code: string;
  snapshot_branch_code: string;
  public_holiday_worked: number;
  hrs_worked_on_holiday: number;
  night_days: number;
  off_days: number;
  off_days_hours: number;
  cash_shortage: number;
  salary_advances: number;
  missing_days: number;
  gepf_loan: number;
  // computed
  public_holiday_earned: number;
  night_allowance_hours: number;
  night_allowance: number;
  off_days_total: number;
  gross_salary: number;
  gepf_employee: number;
  nssf_employee: number;
  taxable_pay: number;
  paye: number;
  deductions_missing_days: number;
  net_salary: number;
  nssf_employer: number;
  wcf_amount: number;
  sdl_amount: number;
}

export const usePayrollEntries = (periodId: string | undefined) =>
  useQuery({
    queryKey: ["payroll_entries", periodId],
    queryFn: async (): Promise<PayrollEntry[]> => {
      const { data, error } = await supabase.from("payroll_entries").select("*").eq("period_id", periodId!).order("snapshot_full_name");
      if (error) throw error;
      return (data || []) as PayrollEntry[];
    },
    enabled: !!periodId,
  });

export const useUpdatePayrollEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PayrollEntry> & { id: string }) => {
      const { id, ...patch } = input;
      // strip computed fields
      const editable: any = {};
      const allowed = ["public_holiday_worked","hrs_worked_on_holiday","night_days","off_days","off_days_hours",
                       "cash_shortage","salary_advances","missing_days","gepf_loan"];
      for (const k of allowed) if (k in patch) editable[k] = (patch as any)[k];
      const { error } = await supabase.from("payroll_entries").update(editable).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["payroll_entries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============= APPROVALS =============
const rpcMutation = (rpc: string, success: string, withReason = false) => () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { periodId: string; reason?: string }) => {
      const params: any = { _period_id: vars.periodId };
      if (withReason) params._reason = vars.reason ?? null;
      const { error } = await supabase.rpc(rpc as any, params);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll_periods"] });
      qc.invalidateQueries({ queryKey: ["payroll_period"] });
      toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useApproveHR        = rpcMutation("payroll_approve_hr",       "HR approved");
export const useApproveManager   = rpcMutation("payroll_approve_manager",  "Manager approved — period locked");
export const useRevertToDraft    = rpcMutation("payroll_revert_to_draft",  "Reverted to draft", true);
export const useUnlockPeriod     = rpcMutation("payroll_unlock_period",    "Period unlocked",   true);

// ============= AUDIT LOG =============
export interface PayrollAuditEntry {
  id: string;
  period_id: string | null;
  casino_id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const usePayrollAuditLog = (periodId: string | undefined) =>
  useQuery({
    queryKey: ["payroll_audit", periodId],
    queryFn: async (): Promise<PayrollAuditEntry[]> => {
      const { data, error } = await supabase
        .from("payroll_audit_log")
        .select("*")
        .eq("period_id", periodId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollAuditEntry[];
    },
    enabled: !!periodId,
  });
