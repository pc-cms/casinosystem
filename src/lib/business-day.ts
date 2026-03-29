/**
 * Casino business day logic.
 * A shift runs 18:00–05:00, so between midnight and 05:00
 * the "business date" is still the previous calendar day.
 */
export function getBusinessDate(now = new Date()): string {
  const h = now.getHours();
  // Before 05:00 → still "yesterday" in business terms
  const d = h < 5 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
  return d.toISOString().split("T")[0];
}

/**
 * Check if a given date string matches the current business day.
 */
export function isBusinessToday(date: string): boolean {
  return date === getBusinessDate();
}
