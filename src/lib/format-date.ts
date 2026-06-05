/**
 * Global unified date display helpers.
 * All output is in Africa/Dar_es_Salaam (EAT, UTC+3).
 * Format: DD/MM/YYYY (with optional HH:mm).
 *
 * Inputs accepted:
 *  - ISO date string ("2025-11-30")
 *  - ISO datetime string ("2025-11-30T20:15:00Z")
 *  - Date object
 *  - null / undefined / "" → returns "—" (never throws)
 */

const TZ = "Africa/Dar_es_Salaam";
const PLACEHOLDER = "—";

type DateInput = string | Date | null | undefined;

const toDate = (input: DateInput): Date | null => {
  if (input == null || input === "") return null;
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return d;
};

const parts = (input: DateInput) => {
  const d = toDate(input);
  if (!d) return null;
  const date = d.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { d, date, time };
};

/** "30/11/2025" — DD/MM/YYYY (project-wide standard) */
export const fmtDate = (input: DateInput): string => {
  const p = parts(input);
  if (!p) return PLACEHOLDER;
  const [y, m, d] = p.date.split("-");
  return `${d}/${m}/${y}`;
};

/** "30/11/2025 20:15" */
export const fmtDateTime = (input: DateInput): string => {
  const p = parts(input);
  if (!p) return PLACEHOLDER;
  const [y, m, d] = p.date.split("-");
  return `${d}/${m}/${y} ${p.time}`;
};

/** "30/11/2025" from a plain ISO date string ("YYYY-MM-DD") without TZ shift. */
export const fmtDateOnly = (ymd: string | null | undefined): string => {
  if (!ymd || ymd.length < 10) return PLACEHOLDER;
  const [y, m, d] = ymd.slice(0, 10).split("-");
  if (!y || !m || !d) return PLACEHOLDER;
  return `${d}/${m}/${y}`;
};

/** "20:15" — EAT */
export const fmtTime = (input: DateInput): string => {
  const p = parts(input);
  return p ? p.time : PLACEHOLDER;
};

/** Short weekday in EAT, e.g. "Sun" */
export const fmtWeekdayShort = (input: DateInput): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
};

/** "30 Nov" — day + short month, in EAT */
export const fmtDayMonth = (input: DateInput): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short" });
};

/** "30/11 20:15" — day/month + time, in EAT */
export const fmtDayMonthTime = (input: DateInput): string => {
  const p = parts(input);
  if (!p) return PLACEHOLDER;
  const [, m, d] = p.date.split("-");
  return `${d}/${m} ${p.time}`;
};

/** "Nov 2025" — short month + year, in EAT */
export const fmtMonthYear = (input: DateInput): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return d.toLocaleDateString("en-GB", { timeZone: TZ, month: "short", year: "numeric" });
};

/** "30 Nov 2025" — long-ish date, in EAT */
export const fmtDateLong = (input: DateInput): string => {
  const d = toDate(input);
  if (!d) return PLACEHOLDER;
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
};
