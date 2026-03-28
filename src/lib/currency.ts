// Central currency & chip configuration
export const CURRENCY = "TZS";
export const CURRENCY_SYMBOL = "TZS";

// Supported currencies
export const CURRENCIES = ["TZS", "USD", "EUR"] as const;
export type SupportedCurrency = typeof CURRENCIES[number];

// Default exchange rates (TZS per 1 unit)
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 2500,
  EUR: 2700,
};

// Cash denominations per currency
export const CASH_DENOMS: Record<string, number[]> = {
  TZS: [500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200, 500],
};

export const CHIP_DENOMS = [500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000] as const;

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

export const formatCurrency = (amount: number, currency: string = "TZS"): string => {
  if (currency === "USD") return `$ ${amount.toLocaleString()}`;
  if (currency === "EUR") return `€ ${amount.toLocaleString()}`;
  return `TZS ${amount.toLocaleString()}`;
};

// ============ TABLE STRUCTURE ============
export interface TableConfig {
  name: string;
  game: string;
  roles: string[];
  chipCount: number; // chips per denomination at start
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
  card: 20,     // P1-P5, BJ1: 20 chips per denomination
  roulette: 40, // AR1-AR3: 40 chips per denomination
  cashier: 50,  // Cashier float: 50 per denomination
  safe: 100,    // Manager safe: 100 per denomination
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
  // Replace generic role prefix with table-specific prefix
  return baseRoles.map(role => {
    // Roles are already generic (P, Pi, BJ, BJi, AR, ARi, ARc)
    return role;
  });
};
