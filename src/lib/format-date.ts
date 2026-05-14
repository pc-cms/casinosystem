/**
 * Global unified date display helpers.
 * All output is in Africa/Dar_es_Salaam (EAT, UTC+3).
 * Format: YYYY.MM.DD (with optional HH:mm).
 *
 * Inputs accepted:
 *  - ISO date string ("2025-11-30")
 *  - ISO datetime string ("2025-11-30T20:15:00Z")
 *  - Date object
 */

const TZ = "Africa/Dar_es_Salaam";

const parts = (input: string | Date) => {
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;
  // en-CA gives YYYY-MM-DD, easy to split
  const date = d.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date, time };
};

/** "30/11/2025" — DD/MM/YYYY (project-wide standard) */
export const fmtDate = (input: string | Date): string => {
  const { date } = parts(input);
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
};

/** "30/11/2025 20:15" */
export const fmtDateTime = (input: string | Date): string => {
  const { time } = parts(input);
  return `${fmtDate(input)} ${time}`;
};

/** "30/11/2025" from a plain ISO date string ("YYYY-MM-DD") without TZ shift. */
export const fmtDateOnly = (ymd: string): string => {
  if (!ymd || ymd.length < 10) return ymd;
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** "20:15" — EAT */
export const fmtTime = (input: string | Date): string => parts(input).time;

/** Short weekday in EAT, e.g. "Sun" */
export const fmtWeekdayShort = (input: string | Date): string => {
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;
  return d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
};

/** "30 Nov" — day + short month, in EAT */
export const fmtDayMonth = (input: string | Date): string => {
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short" });
};

/** "30/11 20:15" — day/month + time, in EAT */
export const fmtDayMonthTime = (input: string | Date): string => {
  const { date, time } = parts(input);
  const [, m, d] = date.split("-");
  return `${d}/${m} ${time}`;
};

/** "Nov 2025" — short month + year, in EAT */
export const fmtMonthYear = (input: string | Date): string => {
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;
  return d.toLocaleDateString("en-GB", { timeZone: TZ, month: "short", year: "numeric" });
};

/** "30 Nov 2025" — long-ish date, in EAT */
export const fmtDateLong = (input: string | Date): string => {
  const d = typeof input === "string"
    ? (input.length === 10 ? new Date(input + "T12:00:00Z") : new Date(input))
    : input;
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
};
