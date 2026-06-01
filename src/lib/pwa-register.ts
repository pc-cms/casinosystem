/**
 * PWA service worker registration with strict guards + update UX.
 *
 * - Skips registration in Lovable editor preview / iframes / dev.
 * - Polls for updates every 30 minutes.
 * - When a new version is available, shows a toast asking the user to reload.
 * - If the user is idle (no input/click for 5 min) and no dialog is open, auto-reloads.
 */

import { toast } from "sonner";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = typeof window !== "undefined" ? window.location.hostname : "";
const isPreviewHost =
  host.includes("lovableproject.com") ||
  host.includes("id-preview--") ||
  host.includes("localhost") ||
  host.startsWith("127.");

const IDLE_AUTO_RELOAD_MS = 5 * 60 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

let lastInteraction = Date.now();
const bumpInteraction = () => {
  lastInteraction = Date.now();
};

const installInteractionListeners = () => {
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach((ev) =>
    window.addEventListener(ev, bumpInteraction, { passive: true }),
  );
};

const isAppBusy = () => {
  // Don't auto-reload if a modal/dialog/sheet/drawer is open or any input is focused.
  const hasOpenOverlay = !!document.querySelector(
    '[role="dialog"][data-state="open"], [data-state="open"][role="alertdialog"]',
  );
  const ae = document.activeElement;
  const isEditing =
    !!ae &&
    (ae.tagName === "INPUT" ||
      ae.tagName === "TEXTAREA" ||
      ae.tagName === "SELECT" ||
      (ae as HTMLElement).isContentEditable);
  return hasOpenOverlay || isEditing;
};

export async function setupPWA() {
  if (typeof window === "undefined") return;

  // In editor preview / iframe / dev: aggressively unregister any existing SW
  // to avoid stale caches polluting future sessions.
  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      regs?.forEach((r) => r.unregister());
    } catch {
      /* ignore */
    }
    return;
  }

  installInteractionListeners();

  // Production, top-level window, real domain — register PWA.
  try {
    const { registerSW } = await import("virtual:pwa-register");

    const updateSW = registerSW({
      immediate: true,
      async onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        // One-time cleanup: previous builds cached Supabase REST in a SW cache
        // called "supabase-api". That cache occasionally served empty/stale
        // arrays after a 5s timeout, causing the "either-or" empty-tab bug.
        // We no longer cache the API in the SW — purge any leftover entries.
        try {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((n) => n.includes("supabase-api"))
              .map((n) => caches.delete(n)),
          );
        } catch { /* ignore */ }

        // 1) Check immediately on app open (don't wait for the 30-min timer).
        registration.update().catch(() => {});

        // 2) Periodic background polling.
        setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL_MS);

        // 3) Check whenever the tab becomes visible / regains focus —
        //    covers PWAs resumed from background after hours/days.
        const checkNow = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener("visibilitychange", checkNow);
        window.addEventListener("focus", checkNow);
        window.addEventListener("online", checkNow);
      },
      onOfflineReady() {
        console.log("[PWA] App ready for offline use");
      },
      onNeedRefresh() {
        console.log("[PWA] New version available — forcing update");

        // Dispatch global event so any UI can react (blocking overlay)
        window.dispatchEvent(new CustomEvent("pwa:update-available", {
          detail: { update: updateSW },
        }));

        // Persistent toast as fallback
        const toastId = toast("Доступна новая версия", {
          description: "Приложение будет перезагружено автоматически.",
          duration: Infinity,
          action: {
            label: "Обновить сейчас",
            onClick: () => {
              updateSW(true);
            },
          },
        });

        // FORCE UPDATE: reload as soon as the app is not busy.
        // Poll every 10s — first safe moment wins. Hard cap at 2 minutes.
        const startedAt = Date.now();
        const HARD_CAP_MS = 2 * 60 * 1000;
        const tryForceReload = () => {
          const elapsed = Date.now() - startedAt;
          if (!isAppBusy() || elapsed >= HARD_CAP_MS) {
            toast.dismiss(toastId);
            console.log("[PWA] Force-reloading to apply update");
            updateSW(true);
            return;
          }
          setTimeout(tryForceReload, 10 * 1000);
        };
        setTimeout(tryForceReload, 5 * 1000);
      },

    });
  } catch (e) {
    console.warn("[PWA] Registration failed:", e);
  }
}

/**
 * Manually clear all SW caches and reload. Used by Admin "Force update" button.
 *
 * Implementation notes (why it's not just caches.delete + reload):
 *  - `location.reload()` may be intercepted by an SW that's still controlling
 *    the page (unregister completes only when all clients unload). On iOS
 *    Safari + Chrome Android this means the next page is served from the
 *    OLD precache, version doesn't change, force update appears broken.
 *  - We also bump `cms:app-version` to the current value so the in-app
 *    versionBuster in main.tsx doesn't trigger a SECOND nuke+reload right
 *    after this one (which compounds the white-screen wait).
 *  - We navigate with a cache-busting query string via `location.replace`
 *    to force a brand-new HTML fetch from the server, bypassing both HTTP
 *    cache and any lingering SW controller.
 */
export async function resetPWACache(): Promise<void> {
  try {
    // 1) Wipe every Cache Storage bucket
    const cacheNames = await caches.keys().catch(() => [] as string[]);
    await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));

    // 2) Unregister every service worker on this origin
    const regs = await navigator.serviceWorker?.getRegistrations?.().catch(() => []);
    if (regs) {
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }

    // 3) Sync the version-buster key so main.tsx doesn't loop another reload
    try {
      // @ts-expect-error injected by Vite define()
      const v = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
      if (v) localStorage.setItem("cms:app-version", v);
    } catch { /* ignore */ }

    // 4) Drop stale persisted react-query cache that might reference old chunks
    try {
      localStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
    } catch { /* ignore */ }
  } catch (e) {
    console.warn("[PWA] reset failed:", e);
  } finally {
    // 5) Hard navigation with cache-buster — bypasses HTTP cache AND any SW
    //    controller that's still claiming this page. `replace` keeps history clean.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_cb", Date.now().toString(36));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }
}
