/**
 * Casino business day logic.
 * All time calculations use Africa/Dar_es_Salaam (EAT, UTC+3).
 * A shift runs across midnight, so between midnight and shiftEnd
 * the "business date" is still the previous calendar day.
 */

/** Get current date/time in EAT timezone */
export function nowEAT(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam" });
  return new Date(str);
}

export function getBusinessDate(shiftEndHour = 5): string {
  const now = nowEAT();
  const h = now.getHours();
  // Before shift end → still "yesterday" in business terms
  const d = h < shiftEndHour ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
  return d.toISOString().split("T")[0];
}

/**
 * Check if a given date string matches the current business day.
 */
export function isBusinessToday(date: string, shiftEndHour = 5): boolean {
  return date === getBusinessDate(shiftEndHour);
}

/**
 * Parse a time string like "05:30" into total minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Check if the current time is past the breaklist lock time for the business day.
 * The lock time is always relative to the "next morning" (e.g., 05:30 means
 * the breaklist locks at 05:30 the morning after the shift started).
 */
export function isAfterBreaklistLock(lockTime = "05:30"): boolean {
  const now = nowEAT();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentMinutes = h * 60 + m;
  const lockMinutes = timeToMinutes(lockTime);

  // Lock time is in the early morning (< 12:00 = next-day lock)
  // If current time is between lockTime and shift start (~18:00), we're past the lock
  if (lockMinutes < 720) {
    // e.g., lock at 05:30 → locked if time is >= 05:30 AND < 18:00
    return currentMinutes >= lockMinutes && h < 18;
  }
  return false;
}
