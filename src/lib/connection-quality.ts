/**
 * Connection quality detection.
 * Uses Navigator.connection API (Network Information API)
 * to determine if we should use realtime or polling.
 */

export type ConnectionTier = "fast" | "slow" | "offline";

export function getConnectionTier(): ConnectionTier {
  if (!navigator.onLine) return "offline";

  const conn = (navigator as any).connection;
  if (!conn) return "fast"; // If API unavailable, assume fast

  const effectiveType = conn.effectiveType as string;

  // 2g, slow-2g → slow
  if (effectiveType === "slow-2g" || effectiveType === "2g") return "slow";
  // 3g → slow (in Tanzania 3g can be very unreliable)
  if (effectiveType === "3g") return "slow";
  // 4g → fast
  return "fast";
}

type ConnectionListener = (tier: ConnectionTier) => void;
const listeners = new Set<ConnectionListener>();

export function onConnectionChange(fn: ConnectionListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let initialized = false;
export function initConnectionMonitor() {
  if (initialized) return;
  initialized = true;

  const conn = (navigator as any).connection;
  if (conn) {
    conn.addEventListener("change", () => {
      const tier = getConnectionTier();
      listeners.forEach(fn => fn(tier));
    });
  }

  window.addEventListener("online", () => {
    const tier = getConnectionTier();
    listeners.forEach(fn => fn(tier));
  });

  window.addEventListener("offline", () => {
    listeners.forEach(fn => fn("offline"));
  });
}
