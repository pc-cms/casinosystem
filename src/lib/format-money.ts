/**
 * Number formatting helpers shared by tables and money cells.
 * Full format uses SPACE as thousand separator (project rule).
 * Compact format collapses to K / M / B for dense tables.
 */

export type MoneyDisplayMode = "full" | "compact";

export const formatMoneyFull = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return sign + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const trimZero = (s: string) => s.replace(/\.0$/, "");

export const formatMoneyCompact = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1_000) return sign + Math.round(abs).toString();
  if (abs < 1_000_000) return sign + trimZero((abs / 1_000).toFixed(1)) + "K";
  if (abs < 1_000_000_000) return sign + trimZero((abs / 1_000_000).toFixed(1)) + "M";
  return sign + trimZero((abs / 1_000_000_000).toFixed(1)) + "B";
};

export const formatMoney = (
  n: number | null | undefined,
  mode: MoneyDisplayMode = "full",
): string => (mode === "compact" ? formatMoneyCompact(n) : formatMoneyFull(n));

// localStorage key for per-table mode toggle
export const moneyModeKey = (tableId: string) => `money-mode:${tableId}`;

export const readMoneyMode = (tableId: string): MoneyDisplayMode => {
  if (typeof window === "undefined") return "full";
  const v = window.localStorage.getItem(moneyModeKey(tableId));
  return v === "compact" ? "compact" : "full";
};

export const writeMoneyMode = (tableId: string, mode: MoneyDisplayMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(moneyModeKey(tableId), mode);
};
