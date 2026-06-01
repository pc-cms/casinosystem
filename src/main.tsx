import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./lib/pwa-register";
import { installChunkRecovery } from "./lib/chunk-recovery";
import { initAuthLeaderElection } from "./lib/auth-leader";
import { installAuthThrottle } from "./lib/auth-throttle";
import { getRuntimeConfig } from "./lib/runtime-config";

// Install BEFORE rendering so we catch chunk errors during initial route load.
installChunkRecovery();

// Preload runtime-config.json (local on-prem casinoSlug/casinoId) so that
// synchronous slug detection in casino-context can pick it up on first render.
// Fire-and-forget kicks off the fetch immediately; we also await it before
// mounting so on local installs the UI doesn't flash an empty/landing state.
const runtimeReady = getRuntimeConfig().catch(() => null);

// Patch window.fetch to throttle /auth/v1/token requests. Must run BEFORE any
// Supabase client call. Protects shared-IP networks (5-10 casino devices behind
// one public IP) from triggering Supabase's per-IP rate limit on /token.
installAuthThrottle();

// Elect a single tab/PWA per device to own the Supabase token refresh loop.
// Prevents refresh-token storms (HTTP 429) when one account is open in
// multiple tabs/windows on the same device.
initAuthLeaderElection();

// One-time per-version cache buster: if the app version changed since the last
// boot, purge all SW caches and unregister service workers BEFORE rendering.
// Fixes "force update didn't pull new code" — guarantees a clean reload on
// every version bump without manual user action.
declare const __APP_VERSION__: string;
const versionBuster = (async () => {
  try {
    const KEY = "cms:app-version";
    const prev = localStorage.getItem(KEY);
    const curr = __APP_VERSION__;
    if (prev && prev !== curr) {
      const cacheNames = await caches.keys().catch(() => [] as string[]);
      await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));
      const regs = await navigator.serviceWorker?.getRegistrations?.().catch(() => []);
      if (regs) await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      localStorage.setItem(KEY, curr);
      // Hard reload from network so the freshly-fetched HTML/JS replaces the stale shell.
      window.location.reload();
      // Block app boot until reload kicks in.
      await new Promise(() => {});
    }
    localStorage.setItem(KEY, curr);
  } catch { /* ignore */ }
})();

// Safety net: mount React no later than 5s even if runtimeReady/versionBuster
// stall (e.g. dead network right after Force Update / cache reset). Prevents
// the multi-minute white screen seen on slow / flaky connections.
const bootDeadline = new Promise((resolve) => setTimeout(resolve, 5000));
Promise.race([Promise.all([runtimeReady, versionBuster]), bootDeadline]).finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
  // Register PWA service worker (no-op in editor preview / iframe / dev)
  setupPWA();
});

