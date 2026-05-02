// Unified shift & attendance color palette used across Dealer Rota, Staff Rota, Breaklist & Attendance grids.
// D = Day (amber), M = Mid/Afternoon (teal), N = Night (sky), G = Graveyard (indigo)

export const UNIFIED_SHIFT_COLORS: Record<string, string> = {
  // Day — amber (saturated for clear day/night contrast in light mode)
  D: "bg-amber-300 text-amber-950 dark:bg-amber-500/25 dark:text-amber-300 font-bold",
  // Mid/Afternoon — teal (distinct from D for Security where both coexist)
  M: "bg-teal-200 text-teal-900 dark:bg-teal-500/25 dark:text-teal-300 font-bold",
  // Night — deep blue (clearly distinct from Day)
  N: "bg-blue-700 text-white dark:bg-sky-500/25 dark:text-sky-300 font-bold",
  // Guard — indigo (security overnight)
  G: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300 font-bold",
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
  D: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  M: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  N: "bg-sky-50 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400",
  G: "bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400",
  L: "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400",
  E: "bg-purple-50 text-purple-500 dark:bg-purple-500/10 dark:text-purple-400",
};
