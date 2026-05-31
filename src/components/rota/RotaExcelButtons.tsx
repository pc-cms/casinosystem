import { useRef } from "react";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

export interface RotaEmployee {
  id: string;
  name: string;
  department?: string | null;
}

interface RotaExcelButtonsProps {
  /** e.g. "live-game", "floor", "security", "office" — used in filename only */
  scope: string;
  /** "YYYY-MM" */
  month: string;
  /** human label for the sheet, e.g. "Live Game Rota — January 2025" */
  title: string;
  employees: RotaEmployee[];
  /** Map key `${employeeId}|${YYYY-MM-DD}` → shift letter */
  existing: Map<string, string>;
  /** Allowed shift codes (uppercase). Cells with other values are skipped on import. */
  allowedShifts: readonly string[];
  /** code → human label, used in the legend row */
  shiftLabels: Record<string, string>;
  /** Called once per (employeeId, date) for cells whose value differs from existing. */
  onSetCell: (employeeId: string, date: string, shift: string) => Promise<void> | void;
  disabled?: boolean;
}

const ymd = (year: number, monthIdx0: number, day: number) =>
  `${year}-${String(monthIdx0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const daysInMonth = (year: number, monthIdx0: number) =>
  new Date(year, monthIdx0 + 1, 0).getDate();

export default function RotaExcelButtons({
  scope, month, title, employees, existing, allowedShifts, shiftLabels, onSetCell, disabled,
}: RotaExcelButtonsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [y, m] = month.split("-").map(Number);
  const monthIdx0 = m - 1;
  const ndays = daysInMonth(y, monthIdx0);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rota", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });

    // Row 1: title
    ws.mergeCells(1, 1, 1, 2 + ndays);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = { bold: true, size: 14 };
    t.alignment = { horizontal: "center", vertical: "middle" };

    // Row 2: legend
    ws.mergeCells(2, 1, 2, 2 + ndays);
    const legend = ws.getCell(2, 1);
    legend.value = "Legend: " + allowedShifts.map(s => `${s}=${shiftLabels[s] || s}`).join("  •  ") +
      "    |    Leave a cell blank to keep its current value. Edit only what you want to change.";
    legend.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    legend.font = { italic: true, size: 10, color: { argb: "FF555555" } };
    ws.getRow(2).height = 28;

    // Row 3: spacer with allowed-codes hint
    ws.mergeCells(3, 1, 3, 2 + ndays);
    const hint = ws.getCell(3, 1);
    hint.value = `Allowed codes: ${allowedShifts.join(", ")}`;
    hint.font = { size: 9, color: { argb: "FF888888" } };

    // Row 4: header
    const header = ["Employee ID", "Name"];
    const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    for (let d = 1; d <= ndays; d++) {
      const wd = weekdays[new Date(y, monthIdx0, d).getDay()];
      header.push(`${String(d).padStart(2, "0")}\n${wd}`);
    }
    const headerRow = ws.getRow(4);
    headerRow.values = header;
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFBBBBBB" } },
        bottom: { style: "thin", color: { argb: "FFBBBBBB" } },
        left: { style: "thin", color: { argb: "FFBBBBBB" } },
        right: { style: "thin", color: { argb: "FFBBBBBB" } },
      };
    });

    // Column widths
    ws.getColumn(1).width = 38;
    ws.getColumn(2).width = 26;
    for (let c = 3; c <= 2 + ndays; c++) ws.getColumn(c).width = 5;

    // Data rows
    employees.forEach((emp, i) => {
      const row = ws.getRow(5 + i);
      row.getCell(1).value = emp.id;
      row.getCell(2).value = emp.name + (emp.department ? `  (${emp.department})` : "");
      row.getCell(1).font = { color: { argb: "FF999999" }, size: 9 };
      row.getCell(2).alignment = { vertical: "middle" };
      for (let d = 1; d <= ndays; d++) {
        const cell = row.getCell(2 + d);
        const cur = existing.get(`${emp.id}|${ymd(y, monthIdx0, d)}`) || "";
        cell.value = cur;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Consolas", size: 11, bold: true };
        // weekend tint
        const wd = new Date(y, monthIdx0, d).getDay();
        if (wd === 0 || wd === 6) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
        }
      }
      // Data validation across the day cells: any of allowedShifts or blank
      const firstCol = colLetter(3);
      const lastCol = colLetter(2 + ndays);
      const rowNum = 5 + i;
      ws.dataValidations.add(`${firstCol}${rowNum}:${lastCol}${rowNum}`, {
        type: "list",
        allowBlank: true,
        formulae: [`"${allowedShifts.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid shift",
        error: `Allowed: ${allowedShifts.join(", ")}`,
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-${scope}-${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Template downloaded (${employees.length} employees, ${ndays} days)`);
  };

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("No sheet");

      const allowed = new Set(allowedShifts.map(s => s.toUpperCase()));
      const empById = new Map(employees.map(e => [e.id, e] as const));
      const empByName = new Map(employees.map(e => [e.name.trim().toLowerCase(), e] as const));

      let updates = 0;
      let skipped = 0;
      const tasks: Array<Promise<unknown> | void> = [];

      // Data starts at row 5
      ws.eachRow((row, rowNum) => {
        if (rowNum < 5) return;
        const idCell = row.getCell(1).value;
        const nameCell = row.getCell(2).value;
        const id = typeof idCell === "string" ? idCell.trim() : "";
        const nameRaw = typeof nameCell === "string" ? nameCell : (nameCell?.toString() || "");
        // Strip "(department)" suffix
        const name = nameRaw.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
        const emp = (id && empById.get(id)) || (name && empByName.get(name));
        if (!emp) { skipped++; return; }

        for (let d = 1; d <= ndays; d++) {
          const v = row.getCell(2 + d).value;
          if (v === null || v === undefined || v === "") continue;
          const code = String(v).trim().toUpperCase();
          if (!allowed.has(code)) { skipped++; continue; }
          const date = ymd(y, monthIdx0, d);
          if ((existing.get(`${emp.id}|${date}`) || "") === code) continue;
          updates++;
          const r = onSetCell(emp.id, date, code);
          if (r && typeof (r as Promise<unknown>).then === "function") tasks.push(r);
        }
      });

      if (tasks.length) await Promise.allSettled(tasks);
      toast.success(`Imported: ${updates} cell${updates === 1 ? "" : "s"} updated${skipped ? `, ${skipped} skipped` : ""}`);
    } catch (e: any) {
      toast.error(`Import failed: ${e?.message || String(e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1 text-xs"
        onClick={downloadTemplate}
        disabled={disabled || employees.length === 0}
        title="Download Excel template pre-filled with current rota"
      >
        <Download className="w-3.5 h-3.5" /> Template
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1 text-xs"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        title="Import filled Excel template"
      >
        <Upload className="w-3.5 h-3.5" /> Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
        }}
      />
    </>
  );
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
