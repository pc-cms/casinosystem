import * as XLSX from "xlsx";

export const downloadXlsx = (
  filename: string,
  sheets: { name: string; rows: (string | number | null)[][] }[],
) => {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || "Sheet");
  }
  XLSX.writeFile(wb, filename);
};
