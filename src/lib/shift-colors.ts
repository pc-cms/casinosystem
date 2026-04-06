// Unified shift & attendance color palette used across Dealer Rota, Staff Rota, Breaklist & Attendance grids.
// M (Middle/Morning) and D (Day) share the same color since they represent the "day" shift in their respective systems.

export const UNIFIED_SHIFT_COLORS: Record<string, string> = {
  // Day shifts — amber
  M: "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300 font-bold",
  D: "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300 font-bold",
  // Night — sky blue
  N: "bg-sky-100 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300 font-bold",
  // Leave — emerald
  L: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 font-bold",
  // Extra — purple
  E: "bg-purple-100 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 font-bold",
  // Off — muted
  O: "bg-muted/30 text-muted-foreground",
};

export const UNIFIED_ATT_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300",
  S: "bg-orange-100 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300",
};

// Lighter tint for scheduled-but-empty rota cells
export const UNIFIED_SHIFT_TINTS: Record<string, string> = {
  M: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  D: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  N: "bg-sky-50 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400",
  L: "bg-purple-50 text-purple-500 dark:bg-purple-500/10 dark:text-purple-400",
  E: "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400",
};
