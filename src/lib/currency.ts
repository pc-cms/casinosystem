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
  TZS: [50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500],
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

export const formatCurrency = (amount: number, currency: string = "TZS"): string => {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym} ${amount.toLocaleString()}`;
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

// All possible breaklist roles (including BR for break)
export const ALL_ROLES = ["P", "Pi", "BJ", "BJi", "AR", "ARi", "ARc", "BR"] as const;

// Chip distribution per location type
export const CHIP_DISTRIBUTION = {
  card: 20,
  roulette: 40,
  cashier: 50,
  safe: 100,
} as const;

// Role display colors
export const ROLE_COLORS: Record<string, string> = {
  P: "bg-indigo-600/20 text-indigo-400",
  Pi: "bg-indigo-500/15 text-indigo-300",
  BJ: "bg-blue-600/20 text-blue-400",
  BJi: "bg-blue-500/15 text-blue-300",
  AR: "bg-emerald-600/20 text-emerald-400",
  ARi: "bg-emerald-500/15 text-emerald-300",
  ARc: "bg-emerald-400/15 text-emerald-200",
  BR: "bg-muted text-muted-foreground",
};

// Get roles available for a specific table
export const getRolesForTable = (tableName: string, game: string): string[] => {
  const baseRoles = TABLE_ROLES[game] || [];
  return baseRoles.map(role => role);
};
