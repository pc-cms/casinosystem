/**
 * Player card IDs are now plain digit strings in DB (e.g. "000312").
 * These helpers keep backward-compat for any legacy cached value that
 * still has the old "CMS…+" wrapper (offline cache, sync log, etc).
 */
export function formatCardNumber(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/^CMS/i, "").replace(/\+$/, "");
}

export function formatCardId(raw?: string | null): string {
  const v = formatCardNumber(raw);
  return v ? `ID: ${v}` : "";
}
