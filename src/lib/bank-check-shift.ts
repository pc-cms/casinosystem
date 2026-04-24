/**
 * Bank check shift logic.
 * A "shift" runs from 12:00 of day D to 06:00 of day D+1.
 * Anything between 00:00 and 06:00 belongs to the previous business day's shift.
 * Anything between 06:00 and 12:00 has no active shift (early morning gap) — assigned to that day.
 */

export const COMMISSION_RATE = 0.03;

/** Strip 3% commission: real = check / 1.03 */
export const stripCommission = (amount: number): number => amount / (1 + COMMISSION_RATE);

/**
 * Determine the business shift date for a check based on its date + time.
 * Time format: "HH:MM" or "HH:MM:SS" or null.
 * Rule: if time < 06:00, belongs to previous day's shift; otherwise to current date.
 */
export function getShiftDate(checkDate: string, checkTime: string | null): string {
  if (!checkTime) return checkDate;
  const [hStr] = checkTime.split(":");
  const h = Number(hStr);
  if (Number.isFinite(h) && h < 6) {
    // belongs to previous day's shift
    const d = new Date(checkDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return checkDate;
}

export const fmtShiftLabel = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
