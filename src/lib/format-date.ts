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

/** "2025.11.30" */
export const fmtDate = (input: string | Date): string => {
  const { date } = parts(input);
  return date.replace(/-/g, ".");
};

/** "2025.11.30 20:15" */
export const fmtDateTime = (input: string | Date): string => {
  const { date, time } = parts(input);
  return `${date.replace(/-/g, ".")} ${time}`;
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
