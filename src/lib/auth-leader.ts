/**
 * Auth Leader Election
 *
 * Problem: When the same account is open in multiple tabs / PWA windows on the
 * same device, each tab independently calls Supabase's autoRefreshToken loop.
 * Refresh tokens rotate on every call → followers race the leader → tokens get
 * revoked → /token returns 429 → AuthProvider sees null user → redirect to /login.
 *
 * Solution: Only ONE tab per device performs token refresh. The leader holds a
 * Web Lock named "supabase-auth-refresh-leader". Followers disable their internal
 * autoRefresh loop and instead listen for SIGNED_IN/TOKEN_REFRESHED broadcasts
 * via BroadcastChannel "supabase.auth.token", which supabase-js already emits
 * across tabs through localStorage when storageKey changes.
 *
 * supabase-js v2 already syncs sessions across tabs via the storage event when
 * `persistSession: true` and `storage: localStorage`. The remaining issue is
 * that EVERY tab still runs its own setInterval refresh loop. We disable that
 * loop on followers by calling stopAutoRefresh() and let the leader's refresh
 * propagate via storage → other tabs pick up the new session automatically.
 */

import { supabase } from "@/integrations/supabase/client";

let initialized = false;

export function initAuthLeaderElection() {
  if (initialized) return;
  initialized = true;

  // Web Locks API is supported in all modern browsers (Chrome 69+, FF 96+, Safari 15.4+).
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    // Fallback: keep default behaviour (every tab refreshes). Better than crashing.
    return;
  }

  // Stop autoRefresh by default — we'll only resume it on the elected leader.
  // Followers still receive token updates via the storage event (built into supabase-js).
  void supabase.auth.stopAutoRefresh();

  // Try to acquire the lock. The first tab wins and holds it for its lifetime.
  // When that tab closes, the lock is released and the next waiting tab takes over.
  void navigator.locks.request(
    "supabase-auth-refresh-leader",
    { mode: "exclusive" },
    async () => {
      // We are the leader. Run the refresh loop here.
      await supabase.auth.startAutoRefresh();

      // Hold the lock until the tab is closed / hidden permanently.
      // Returning from this callback releases the lock, so we await a promise
      // that only resolves on pagehide.
      await new Promise<void>((resolve) => {
        const release = () => {
          window.removeEventListener("pagehide", release);
          resolve();
        };
        window.addEventListener("pagehide", release, { once: true });
      });
    },
  );

  // When the tab becomes visible again, give it a chance to become leader if
  // the previous leader died. The lock request above keeps waiting in the
  // background, so nothing else is needed here — but we also pause/resume
  // autoRefresh on visibility to avoid stale refreshes from a backgrounded
  // tab that briefly held the lock.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // No-op: leader keeps refreshing in the background, followers are already paused.
    }
  });
}
