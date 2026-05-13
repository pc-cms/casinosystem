import ExcelJS from "exceljs";

export const downloadXlsx = async (
  filename: string,
  sheets: { name: string; rows: (string | number | null)[][] }[],
) => {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet((s.name || "Sheet").slice(0, 31));
    s.rows.forEach((r) => ws.addRow(r));
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
