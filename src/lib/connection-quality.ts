/**
 * Connection quality detection for wired/LAN environment.
 * Primary concern: brief disconnections and packet loss on 100Mbps cable.
 * No mobile tiers — just online/offline.
 */

export type ConnectionTier = "fast" | "offline";

export function getConnectionTier(): ConnectionTier {
  return navigator.onLine ? "fast" : "offline";
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

  window.addEventListener("online", () => {
    listeners.forEach(fn => fn("fast"));
  });

  window.addEventListener("offline", () => {
    listeners.forEach(fn => fn("offline"));
  });
}
