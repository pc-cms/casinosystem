/**
 * Helpers for "Import Daily Reports" feature.
 *
 * Numbers are stored in UI as space-separated strings ("35 660 000").
 * Database stores as numeric.
 */

export const FIXED_TABLE_NAMES = [
  "AR1", "AR2", "AR3", "BJ", "OP1", "OP2", "OP3", "OP4", "OP5", "Total",
] as const;

export type FixedTableName = (typeof FIXED_TABLE_NAMES)[number];

/** OP1..OP5 → P1..P5; BJ → BJ1; AR* unchanged. Total is not mapped. */
export const mapOcrNameToDbName = (ocrName: string): string | null => {
  const n = ocrName.trim().toUpperCase();
  if (n === "TOTAL") return null;
  if (n === "BJ") return "BJ1";
  const op = n.match(/^OP(\d)$/);
  if (op) return `P${op[1]}`;
  return n; // AR1, AR2, AR3
};

/** Format raw digits to space-separated string. Negative supported. */
export const formatSpaced = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) return "0";
  let s = String(raw).replace(/[^0-9-]/g, "");
  if (!s || s === "-") return "0";
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  s = s.replace(/^0+(?=\d)/, "") || "0";
  const spaced = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return neg ? `-${spaced}` : spaced;
};

/** Parse space-separated string to numeric. */
export const parseSpaced = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val).replace(/\s/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export type OcrRow = {
  table: string;
  open: string;
  fill: string;
  credit: string;
  close: string;
  drop: string;
  result: string;
};

export type ImportDay = {
  date: string; // YYYY-MM-DD
  rows: OcrRow[];
  confirmed: boolean;
  locked: boolean;
};
