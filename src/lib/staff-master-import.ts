/**
 * Staff Master XLSX importer.
 *
 * Parses the 32-column HR template (template-2.xlsx) and returns rows ready
 * for bulk insert into the `employees` table. Calculated columns (S/N, Remain
 * Days, Experience-YY, Ages, Contract End Month, To Renew Days) are ignored
 * — the database/UI computes them from the raw inputs.
 */
import ExcelJS from "exceljs";

export type ParsedStaffRow = {
  full_name: string;
  department: string | null;
  position: string | null;
  contract_type: string | null;
  basic_salary: number;
  onboarding_date: string | null;
  birthday: string | null;
  phone: string | null;
  job_description: string | null;
  general_details: string | null;
  intro_to_work: boolean;
  staff_rules_acknowledged: boolean;
  disciplinary_acknowledged: boolean;
  confidentiality_agreement: boolean;
  contract_start: string | null;
  contract_end: string | null;
  annual_leave_earned: number;
  annual_leave_used: number;
  annual_leave_sold: number;
  corporate_mail: string | null;
  gender: string | null;
  nationality: string | null;
  license_type: string | null;
  license_available: boolean;
  license_pass_date: string | null;
  uniform_issued: boolean;
};

const isYes = (v: unknown) => typeof v === "string" && v.trim().toLowerCase() === "yes";

const toStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(typeof v === "string" ? v.replace(/\s/g, "") : v);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // Format as YYYY-MM-DD (UTC to avoid timezone drift on date-only fields)
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toDate(d);
};

const cleanPhone = (v: unknown): string | null => {
  const s = toStr(v);
  if (!s) return null;
  return s.replace(/^\/+/, "").trim() || null;
};

// Column indices (1-based, matches ExcelJS getCell)
const COL = {
  name: 2,
  department: 4,
  position: 5,
  contract_type: 6,
  basic_salary: 7,
  joining: 8,
  birthday: 10,
  phone: 12,
  job_desc: 13,
  general: 14,
  intro: 15,
  rules: 16,
  discip: 17,
  confid: 18,
  contract_start: 19,
  contract_end: 20,
  al_earn: 22,
  al_used: 23,
  al_sold: 24,
  corp_mail: 25,
  gender: 26,
  nationality: 27,
  license_type: 28,
  license_avail: 29,
  pass_date: 30,
  uniform: 32,
};

export async function parseStaffMasterXlsx(file: File): Promise<ParsedStaffRow[]> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Workbook has no sheets");

  const out: ParsedStaffRow[] = [];
  const lastRow = ws.actualRowCount || ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const name = toStr(row.getCell(COL.name).value);
    if (!name) continue;

    out.push({
      full_name: name,
      department: toStr(row.getCell(COL.department).value),
      position: toStr(row.getCell(COL.position).value),
      contract_type: toStr(row.getCell(COL.contract_type).value),
      basic_salary: toNum(row.getCell(COL.basic_salary).value),
      onboarding_date: toDate(row.getCell(COL.joining).value),
      birthday: toDate(row.getCell(COL.birthday).value),
      phone: cleanPhone(row.getCell(COL.phone).value),
      job_description: toStr(row.getCell(COL.job_desc).value),
      general_details: toStr(row.getCell(COL.general).value),
      intro_to_work: isYes(row.getCell(COL.intro).value),
      staff_rules_acknowledged: isYes(row.getCell(COL.rules).value),
      disciplinary_acknowledged: isYes(row.getCell(COL.discip).value),
      confidentiality_agreement: isYes(row.getCell(COL.confid).value),
      contract_start: toDate(row.getCell(COL.contract_start).value),
      contract_end: toDate(row.getCell(COL.contract_end).value),
      annual_leave_earned: toNum(row.getCell(COL.al_earn).value),
      annual_leave_used: toNum(row.getCell(COL.al_used).value),
      annual_leave_sold: toNum(row.getCell(COL.al_sold).value),
      corporate_mail: toStr(row.getCell(COL.corp_mail).value),
      gender: toStr(row.getCell(COL.gender).value),
      nationality: toStr(row.getCell(COL.nationality).value),
      license_type: toStr(row.getCell(COL.license_type).value),
      license_available: isYes(row.getCell(COL.license_avail).value),
      license_pass_date: toDate(row.getCell(COL.pass_date).value),
      uniform_issued: isYes(row.getCell(COL.uniform).value),
    });
  }
  return out;
}
