/**
 * Helpers for converting stored storage references (raw paths OR public/sign
 * URLs from the Supabase Storage API) into a `{ bucket, path }` pair that can
 * be re-signed on the fly.
 *
 * We keep the legacy column shape (`photo_url`) as-is: existing rows store the
 * full publicUrl, new rows can store either publicUrl or a raw path. The hook
 * extracts the path and signs it with a short-lived token before rendering.
 */
const URL_RE =
  /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/;

export function parseStorageRef(
  value: string | null | undefined,
  fallbackBucket?: string,
): { bucket: string; path: string } | null {
  if (!value) return null;
  const m = value.match(URL_RE);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  // raw path (no leading slash, no scheme) — needs a known bucket
  if (
    fallbackBucket &&
    !value.startsWith("http") &&
    !value.startsWith("/") &&
    !value.includes("://")
  ) {
    return { bucket: fallbackBucket, path: value };
  }
  return null;
}
