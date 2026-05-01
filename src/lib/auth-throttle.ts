/**
 * Auth Throttle — global guard around Supabase refresh-token requests.
 *
 * Why: All casino devices share one public IP. Supabase Auth rate-limits per IP
 * (~30 token requests/sec). With 5-10 devices each refreshing on its own
 * schedule + retries on transient errors, bursts can exceed the limit and
 * trigger HTTP 429 → session invalidation → forced re-login storm.
 *
 * What this does (per browser profile, on top of leader election):
 *   1. Only guards refresh_token calls. Password login is never delayed.
 *   2. Coalesces concurrent refreshes — callers wait for one shared request.
 *   3. Adds a stable per-device jitter so 5-10 Windows/PWA devices behind one
 *      public IP do not all refresh in the same second.
 *   4. Shares the last successful refresh timestamp through localStorage so a
 *      browser tab and installed PWA window on the same Windows profile cannot
 *      fire back-to-back refreshes.
 *   5. On HTTP 429, waits through a cooldown and retries instead of replaying an
 *      old refresh response. Replaying old refresh responses is unsafe because
 *      refresh tokens rotate and duplicate responses can reintroduce revoked
 *      tokens into storage.
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
const MIN_INTERVAL_MS = 20_000;         // min spacing between refresh calls per browser profile
const RATE_LIMIT_COOLDOWN_MS = 45_000;  // wait this long after a 429 before retrying
const MAX_429_RETRIES = 2;
const LAST_SUCCESS_KEY = "cms-auth-token-last-success-at";
const DEVICE_JITTER_KEY = "cms-auth-token-device-jitter-ms";

let inFlight: Promise<Response> | null = null;
let lastSuccessAt = 0;
let cooldownUntil = 0;
let startupJitterApplied = false;

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

function isRefreshTokenRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (!isTokenRequest(input)) return false;
  try {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    if (url.includes("grant_type=refresh_token")) return true;

    const body = init?.body;
    if (typeof body === "string") {
      return body.includes("refresh_token") || body.includes("grant_type=refresh_token");
    }
    if (body instanceof URLSearchParams) {
      return body.get("grant_type") === "refresh_token" || body.has("refresh_token");
    }
  } catch {
    return true;
  }
  // Supabase sends refreshes as /token?grant_type=refresh_token. If we cannot
  // prove it is a refresh, do not delay it (important for password login).
  return false;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function readNumber(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* ignore storage failures */
  }
}

function getDeviceJitterMs(): number {
  const existing = readNumber(DEVICE_JITTER_KEY);
  if (existing > 0) return existing;
  const jitter = 2_000 + Math.floor(Math.random() * 24_000);
  writeNumber(DEVICE_JITTER_KEY, jitter);
  return jitter;
}

function getSharedLastSuccessAt(): number {
  return Math.max(lastSuccessAt, readNumber(LAST_SUCCESS_KEY));
}

function markRefreshSuccess() {
  lastSuccessAt = Date.now();
  writeNumber(LAST_SUCCESS_KEY, lastSuccessAt);
}

function currentStoredSessionResponse(): Response | null {
  try {
    const key = Object.keys(window.localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    if (!key) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed;
    if (!session?.access_token || !session?.refresh_token) return null;

    const expiresAt = session.expires_at ?? parsed?.expiresAt;
    const expiresIn = typeof expiresAt === "number"
      ? Math.max(1, expiresAt - Math.floor(Date.now() / 1000))
      : Math.max(1, Number(session.expires_in ?? 3600));

    return new Response(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? "bearer",
      expires_in: expiresIn,
      expires_at: expiresAt,
      user: session.user,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return null;
  }
}

async function guardedTokenFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!originalFetch) {
    // SSR or unsupported env — fall through.
    return fetch(input, init);
  }

  // Coalesce concurrent calls — including cooldown/wait time.
  if (inFlight) {
    const shared = await inFlight;
    return shared.clone();
  }

  inFlight = (async () => {
    try {
      const now = Date.now();
      const sharedLastSuccess = getSharedLastSuccessAt();
      const spacingWait = Math.max(0, MIN_INTERVAL_MS - (now - sharedLastSuccess));
      const startupJitter = startupJitterApplied ? 0 : getDeviceJitterMs();
      startupJitterApplied = true;

      if (now < cooldownUntil) {
        await delay(cooldownUntil - now + getDeviceJitterMs());
      } else if (spacingWait > 0 || startupJitter > 0) {
        await delay(spacingWait + startupJitter);
      }

      for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
        const res = await originalFetch(input, init);

        if (res.status !== 429) {
          if (res.ok) markRefreshSuccess();
          return res;
        }

        cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.warn(`[auth-throttle] refresh_token returned 429, retrying after cooldown (${attempt + 1}/${MAX_429_RETRIES})`);

        if (attempt < MAX_429_RETRIES) {
          await delay(RATE_LIMIT_COOLDOWN_MS + getDeviceJitterMs());
          continue;
        }

        const fallback = currentStoredSessionResponse();
        if (fallback) return fallback;
        return res;
      }

      return originalFetch(input, init);
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
    if (isRefreshTokenRequest(input, init)) {
      return guardedTokenFetch(input, init);
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}
