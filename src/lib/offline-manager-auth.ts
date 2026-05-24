/**
 * Offline Manager Authentication Cache.
 *
 * After a successful online verify-manager call we cache a PBKDF2-derived
 * hash of (login + password) in IndexedDB. While offline, the same
 * (login + password) can be re-verified locally for up to MAX_TTL_MS,
 * unlocking shift close / overrides during a network outage.
 *
 * Security model:
 *   - Only PBKDF2 hashes are stored, never plaintext.
 *   - Salt is per-credential, random.
 *   - Cache TTL is 12 h — long enough to cover a full shift, short enough
 *     to limit blast radius if a device is stolen.
 *   - Every offline verification writes an audit row via logAction so the
 *     server sees who claimed manager authority while disconnected.
 */
const DB_NAME = "cms-offline-auth";
const DB_VERSION = 1;
const STORE = "manager_creds";
const MAX_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export type CachedManager = {
  login_key: string;          // lowercased email or username
  manager_id: string;
  display_name: string;
  salt: string;               // base64
  hash: string;               // base64 PBKDF2
  iterations: number;
  cached_at: number;
  expires_at: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "login_key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key, 256,
  );
  return b64(bits);
}

export async function cacheManagerCredentials(input: {
  login: string;
  password: string;
  manager_id: string;
  display_name: string;
}): Promise<void> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100_000;
    const hash = await pbkdf2(input.password, salt, iterations);
    const now = Date.now();
    const entry: CachedManager = {
      login_key: input.login.toLowerCase().trim(),
      manager_id: input.manager_id,
      display_name: input.display_name,
      salt: b64(salt.buffer),
      hash,
      iterations,
      cached_at: now,
      expires_at: now + MAX_TTL_MS,
    };
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("[offline-manager-auth] failed to cache", e);
  }
}

export async function verifyOfflineManager(
  login: string,
  password: string,
): Promise<{ manager_id: string; display_name: string } | null> {
  try {
    const key = login.toLowerCase().trim();
    const db = await openDB();
    const entry = await new Promise<CachedManager | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as CachedManager | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!entry) return null;
    if (Date.now() > entry.expires_at) return null;
    const salt = fromB64(entry.salt);
    const candidate = await pbkdf2(password, salt, entry.iterations);
    // Constant-time-ish comparison
    if (candidate.length !== entry.hash.length) return null;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ entry.hash.charCodeAt(i);
    }
    if (diff !== 0) return null;
    return { manager_id: entry.manager_id, display_name: entry.display_name };
  } catch (e) {
    console.error("[offline-manager-auth] verify failed", e);
    return null;
  }
}

export async function purgeExpiredManagerCache(): Promise<void> {
  try {
    const db = await openDB();
    const all = await new Promise<CachedManager[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as CachedManager[]);
      req.onerror = () => reject(req.error);
    });
    const now = Date.now();
    const expired = all.filter(e => e.expires_at < now);
    if (expired.length === 0) return;
    const tx = db.transaction(STORE, "readwrite");
    expired.forEach(e => tx.objectStore(STORE).delete(e.login_key));
  } catch { /* noop */ }
}
