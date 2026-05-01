/**
 * Auth Throttle — global guard around Supabase /auth/v1/token requests.
 *
 * Why: All casino devices share one public IP. Supabase Auth rate-limits per IP
 * (~30 token requests/sec). With 5-10 devices each refreshing on its own
 * schedule + retries on transient errors, bursts can exceed the limit and
 * trigger HTTP 429 → session invalidation → forced re-login storm.
 *
 * What this does (per device, on top of Web Locks leader election):
 *   1. Coalesces concurrent /token requests — if a refresh is already in flight,
 *      subsequent callers wait for the same Response instead of firing more.
 *   2. Throttles successful refresh requests to at most 1 per 8 seconds per
 *      device. Bursts beyond that are deduped to the in-flight promise.
 *   3. On HTTP 429 from Supabase, sets a hard cooldown of 30 seconds during
 *      which all /token calls return a synthesised 200 with the cached
 *      response body (so supabase-js does NOT see a failure and does NOT
 *      revoke the local session).
 *   4. Leaves all other requests (data, RPC, storage) completely untouched.
 *
 * This is safe because:
 *   - Refresh tokens have a long lifetime; skipping a refresh attempt for
 *     ~30s while we're being rate-limited only delays the next refresh, it
 *     does NOT log the user out.
 *   - The Web Locks leader election (auth-leader.ts) already ensures only
 *     ONE tab per device runs the auto-refresh loop. This throttle is the
 *     belt-and-suspenders defense against bursts triggered by clicks,
 *     visibility changes, or third-party libraries calling getSession().
 */

const TOKEN_PATH = "/auth/v1/token";
const MIN_INTERVAL_MS = 8_000;          // min spacing between successful /token calls
const RATE_LIMIT_COOLDOWN_MS = 30_000;  // freeze /token calls for this long after a 429

let inFlight: Promise<Response> | null = null;
let lastResponseClone: Response | null = null;
let lastSuccessAt = 0;
let cooldownUntil = 0;

const originalFetch = typeof window !== "undefined" ? window.fetch.bind(window) : null;

function isTokenRequest(input: RequestInfo | URL): boolean {
  try {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    return url.includes(TOKEN_PATH);
  } catch {
    return false;
  }
}

async function guardedTokenFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!originalFetch) {
    // SSR or unsupported env — fall through.
    return fetch(input, init);
  }

  const now = Date.now();

  // 1. Cooldown after a recent 429 → return cached last good response (if any)
  //    so supabase-js keeps using its current session instead of clearing it.
  if (now < cooldownUntil && lastResponseClone) {
    return lastResponseClone.clone();
  }

  // 2. Coalesce concurrent calls — return the same in-flight promise.
  if (inFlight) {
    const shared = await inFlight;
    return shared.clone();
  }

  // 3. Throttle successful refreshes — if we just refreshed, return cached.
  if (now - lastSuccessAt < MIN_INTERVAL_MS && lastResponseClone) {
    return lastResponseClone.clone();
  }

  // 4. Actually perform the request.
  inFlight = (async () => {
    try {
      const res = await originalFetch(input, init);

      if (res.status === 429) {
        // Rate-limited — set cooldown and return a clone of the last good
        // response if we have one, otherwise propagate the 429 (first call).
        cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        if (lastResponseClone) {
          console.warn("[auth-throttle] /token returned 429, serving cached response for 30s");
          return lastResponseClone.clone();
        }
        return res;
      }

      if (res.ok) {
        lastSuccessAt = Date.now();
        // Clone so we can replay the body on subsequent throttled calls.
        try {
          lastResponseClone = res.clone();
        } catch {
          // Some response types are not cloneable; ignore.
        }
      }

      return res;
    } finally {
      inFlight = null;
    }
  })();

  const result = await inFlight;
  return result.clone();
}

let installed = false;

export function installAuthThrottle() {
  if (installed || typeof window === "undefined" || !originalFetch) return;
  installed = true;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (isTokenRequest(input)) {
      return guardedTokenFetch(input, init);
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}
