// Per-table color palette for the Breaklist grid.
// Each table gets a distinct hue; the role within the table (Dealer / Inspector /
// Croupier) is differentiated by contrast intensity.

// Base hues — chosen for clear separation in both light and dark modes.
const TABLE_HUES = [
  "blue",
  "emerald",
  "amber",
  "violet",
  "rose",
  "cyan",
  "orange",
  "fuchsia",
  "lime",
  "indigo",
  "teal",
  "pink",
  "yellow",
  "sky",
  "red",
] as const;

// Tailwind needs static class names — pre-build a lookup so JIT keeps them.
// Three intensities per hue:
//   D  → strongest (Dealer, the "headline" seat)
//   I  → medium    (Inspector)
//   C  → soft      (Croupier / extras)
const PALETTE: Record<string, { D: string; I: string; C: string }> = {
  blue:    { D: "bg-blue-600 text-white dark:bg-blue-500/80 dark:text-white",
             I: "bg-blue-200 text-blue-900 dark:bg-blue-500/30 dark:text-blue-200",
             C: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  emerald: { D: "bg-emerald-600 text-white dark:bg-emerald-500/80 dark:text-white",
             I: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-200",
             C: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  amber:   { D: "bg-amber-500 text-amber-950 dark:bg-amber-500/80 dark:text-amber-950",
             I: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
             C: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  violet:  { D: "bg-violet-600 text-white dark:bg-violet-500/80 dark:text-white",
             I: "bg-violet-200 text-violet-900 dark:bg-violet-500/30 dark:text-violet-200",
             C: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300" },
  rose:    { D: "bg-rose-600 text-white dark:bg-rose-500/80 dark:text-white",
             I: "bg-rose-200 text-rose-900 dark:bg-rose-500/30 dark:text-rose-200",
             C: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  cyan:    { D: "bg-cyan-600 text-white dark:bg-cyan-500/80 dark:text-white",
             I: "bg-cyan-200 text-cyan-900 dark:bg-cyan-500/30 dark:text-cyan-200",
             C: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300" },
  orange:  { D: "bg-orange-600 text-white dark:bg-orange-500/80 dark:text-white",
             I: "bg-orange-200 text-orange-900 dark:bg-orange-500/30 dark:text-orange-200",
             C: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  fuchsia: { D: "bg-fuchsia-600 text-white dark:bg-fuchsia-500/80 dark:text-white",
             I: "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-500/30 dark:text-fuchsia-200",
             C: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-300" },
  lime:    { D: "bg-lime-500 text-lime-950 dark:bg-lime-500/80 dark:text-lime-950",
             I: "bg-lime-200 text-lime-900 dark:bg-lime-500/30 dark:text-lime-200",
             C: "bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300" },
  indigo:  { D: "bg-indigo-600 text-white dark:bg-indigo-500/80 dark:text-white",
             I: "bg-indigo-200 text-indigo-900 dark:bg-indigo-500/30 dark:text-indigo-200",
             C: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300" },
  teal:    { D: "bg-teal-600 text-white dark:bg-teal-500/80 dark:text-white",
             I: "bg-teal-200 text-teal-900 dark:bg-teal-500/30 dark:text-teal-200",
             C: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300" },
  pink:    { D: "bg-pink-600 text-white dark:bg-pink-500/80 dark:text-white",
             I: "bg-pink-200 text-pink-900 dark:bg-pink-500/30 dark:text-pink-200",
             C: "bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300" },
  yellow:  { D: "bg-yellow-400 text-yellow-950 dark:bg-yellow-500/80 dark:text-yellow-950",
             I: "bg-yellow-200 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-200",
             C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300" },
  sky:     { D: "bg-sky-600 text-white dark:bg-sky-500/80 dark:text-white",
             I: "bg-sky-200 text-sky-900 dark:bg-sky-500/30 dark:text-sky-200",
             C: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  red:     { D: "bg-red-600 text-white dark:bg-red-500/80 dark:text-white",
             I: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200",
             C: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
};

// Map a stored role to a position slot.
const positionSlot = (role: string): "D" | "I" | "C" => {
  if (role === "Pi" || role === "BJi" || role === "ARi" || role === "AR1i") return "I";
  if (role === "ARc" || role === "AR1c") return "C";
  return "D"; // P, BJ, AR, AR1 (and anything else table-bound)
};

/**
 * Returns Tailwind classes for a Breaklist cell tied to a specific table.
 * Color = table identity (stable index-based hue), intensity = position (D/I/C).
 */
export const getTableCellClasses = (
  tableId: string,
  tableIndex: number,
  role: string,
): string => {
  const hue = TABLE_HUES[tableIndex % TABLE_HUES.length];
  const slot = positionSlot(role);
  return PALETTE[hue][slot];
};
