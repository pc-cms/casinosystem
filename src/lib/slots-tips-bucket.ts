/**
 * Cage Slots — Tips CD shift bucket.
 *
 * Day shift     : 13:00 ≤ t ≤ 21:10 EAT
 * Evening shift : 21:11 ≤ t < 05:00 EAT (next day)
 * Anything outside (05:00–12:59) defaults to "day" (cage is normally closed
 * then; falls in with the upcoming day shift).
 *
 * EAT = Africa/Dar_es_Salaam = UTC+3, no DST.
 */
export type TipsBucket = "day" | "evening";

const eatMinutesOfDay = (iso: string): number => {
  const d = new Date(iso);
  // UTC minutes + 180 (UTC+3), wrapped to [0..1440)
  const m = d.getUTCHours() * 60 + d.getUTCMinutes() + 180;
  return ((m % 1440) + 1440) % 1440;
};

export const tipsBucketOf = (createdAt: string): TipsBucket => {
  const m = eatMinutesOfDay(createdAt);
  const DAY_FROM = 13 * 60;          // 13:00
  const DAY_TO   = 21 * 60 + 10;     // 21:10 inclusive
  if (m >= DAY_FROM && m <= DAY_TO) return "day";
  return "evening";
};

export const TIPS_BUCKET_LABEL: Record<TipsBucket, string> = {
  day: "Day (13:00–21:10)",
  evening: "Evening (21:11–05:00)",
};
