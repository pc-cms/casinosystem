/**
 * Format a stored card_number (e.g. "CMS000312+") for display as "ID: 000312".
 * Strips legacy "CMS" prefix and trailing "+".
 */
export function formatCardNumber(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/^CMS/i, "").replace(/\+$/, "");
}

export function formatCardId(raw?: string | null): string {
  const v = formatCardNumber(raw);
  return v ? `ID: ${v}` : "";
}
