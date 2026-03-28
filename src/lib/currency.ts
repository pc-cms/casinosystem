// Central currency & chip configuration
export const CURRENCY = "TZS";
export const CURRENCY_SYMBOL = "TZS";

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

export const formatCurrency = (amount: number): string => {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString()}`;
};
