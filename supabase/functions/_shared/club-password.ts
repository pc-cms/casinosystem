// PBKDF2-SHA256 password hashing. Format: pbkdf2$<iter>$<saltB64>$<hashB64>
const ITER = 100_000;
const KEYLEN = 32;

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    key,
    KEYLEN * 8,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITER);
  return `pbkdf2$${ITER}$${b64(salt.buffer)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== "pbkdf2") return false;
    const iter = Number(iterStr);
    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);
    const computed = new Uint8Array(await pbkdf2(password, salt, iter));
    if (computed.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export function validatePasswordStrength(p: string): string | null {
  if (typeof p !== "string" || p.length < 8) return "Password must be at least 8 characters.";
  if (p.length > 200) return "Password too long.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password must include letters and numbers.";
  return null;
}
