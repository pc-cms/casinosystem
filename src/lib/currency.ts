// Central currency & chip configuration
export const CURRENCY = "TZS";
export const CURRENCY_SYMBOL = "TZS";

// Supported currencies
export const CURRENCIES = ["TZS", "USD", "EUR", "GBP", "KES"] as const;
export type SupportedCurrency = typeof CURRENCIES[number];

// Currency symbols for display
export const CURRENCY_SYMBOLS: Record<string, string> = {
  TZS: "TZS",
  USD: "$",
  EUR: "€",
  GBP: "£",
  KES: "KSh",
};

// Default exchange rates (TZS per 1 unit)
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 2500,
  EUR: 2700,
  GBP: 3200,
  KES: 18,
};

// Cash denominations per currency
export const CASH_DENOMS: Record<string, number[]> = {
  TZS: [10_000, 5_000, 2_000, 1_000],
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  GBP: [50, 20, 10, 5],
  KES: [1000, 500, 200, 100, 50],
};

// Non-TZS currencies (for exchange rate inputs)
export const FOREIGN_CURRENCIES = CURRENCIES.filter(c => c !== "TZS");

export const CHIP_DENOMS = [5_000_000, 1_000_000, 500_000, 100_000, 50_000, 25_000, 10_000, 5_000, 2_000, 1_000, 500] as const;

export const CHIP_COLORS: Record<number, string> = {
  500: "bg-red-600 text-white",
  1_000: "bg-blue-600 text-white",
  2_000: "bg-green-600 text-white",
  5_000: "bg-purple-600 text-white",
  10_000: "bg-yellow-500 text-black",
  25_000: "bg-orange-500 text-white",
  50_000: "bg-pink-600 text-white",
  100_000: "bg-black text-white border border-white/20",
  500_000: "bg-teal-600 text-white",
  1_000_000: "bg-amber-400 text-black",
  5_000_000: "bg-rose-700 text-white",
};

export const formatChipLabel = (value: number): string => {
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1_000) return `${value / 1_000}K`;
  return String(value);
};

// Format a cash denomination label (e.g. "$100", "€50", "50K" for TZS)
export const formatCashDenomLabel = (denom: number, currency: string): string => {
  if (currency === "TZS") return formatChipLabel(denom);
  const sym = CURRENCY_SYMBOLS[currency] || "";
  if (denom >= 1000) return `${sym}${denom / 1000}K`;
  return `${sym}${denom}`;
};

// Format number with space-separated thousands (global rule: no commas or dots)
export const formatNumberSpaces = (num: number): string => {
  if (num === 0) return "0";
  const isNeg = num < 0;
  const abs = Math.abs(Math.round(num));
  const str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return isNeg ? `-${str}` : str;
};

export const formatCurrency = (amount: number, currency: string = "TZS"): string => {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym} ${formatNumberSpaces(amount)}`;
};

// Parse a space-formatted string back to number
export const parseSpacedNumber = (str: string): number => {
  return Number(str.replace(/\s/g, "")) || 0;
};

// Format an input value with spaces as user types
export const formatInputWithSpaces = (value: string): string => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// ============ TABLE STRUCTURE ============
export interface TableConfig {
  name: string;
  game: string;
  roles: string[];
  chipCount: number;
}

// Table roles by game type
export const TABLE_ROLES: Record<string, string[]> = {
  "Texas Holdem": ["P", "Pi"],
  "Blackjack": ["BJ", "BJi"],
  "American Roulette": ["AR", "ARi", "ARc"],
};

// All possible breaklist roles (BR = break, S = sick — fills until shift end)
export const ALL_ROLES = ["P", "Pi", "BJ", "BJi", "AR", "ARi", "ARc", "BR", "S"] as const;

// Chip distribution per location type
export const CHIP_DISTRIBUTION = {
  card: 20,
  roulette: 40,
  cashier: 50,
  safe: 100,
} as const;

// Role display colors — light mode uses solid pastels, dark mode uses semi-transparent
export const ROLE_COLORS: Record<string, string> = {
  P: "bg-violet-100 text-violet-800 dark:bg-violet-600/25 dark:text-violet-300",
  Pi: "bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  BJ: "bg-sky-100 text-sky-800 dark:bg-sky-600/25 dark:text-sky-300",
  BJi: "bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  AR: "bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:text-emerald-400",
  ARi: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ARc: "bg-teal-50 text-teal-700 dark:bg-emerald-400/15 dark:text-emerald-200",
  BR: "bg-muted text-muted-foreground",
  // Sick — neutral slate, not used by any other role/category
  S: "bg-slate-200 text-slate-700 dark:bg-slate-600/30 dark:text-slate-300",
};

// Get roles available for a specific table
export const getRolesForTable = (tableName: string, game: string): string[] => {
  const baseRoles = TABLE_ROLES[game] || [];
  return baseRoles.map(role => role);
};
