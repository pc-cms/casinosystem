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
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          setInterval(() => {
            registration.update().catch(() => {});
          }, UPDATE_CHECK_INTERVAL_MS);
        }
      },
      onOfflineReady() {
        console.log("[PWA] App ready for offline use");
      },
      onNeedRefresh() {
        console.log("[PWA] New version available");

        // Persistent toast with explicit "Update" action
        const toastId = toast("Доступна новая версия", {
          description: "Нажмите «Обновить», чтобы загрузить последнюю версию.",
          duration: Infinity,
          action: {
            label: "Обновить",
            onClick: () => {
              updateSW(true);
            },
          },
          cancel: {
            label: "Позже",
            onClick: () => {},
          },
        });

        // Auto-reload when user is idle and app is not busy.
        const tryAutoReload = () => {
          const idleFor = Date.now() - lastInteraction;
          if (idleFor >= IDLE_AUTO_RELOAD_MS && !isAppBusy()) {
            toast.dismiss(toastId);
            updateSW(true);
            return;
          }
          setTimeout(tryAutoReload, 30 * 1000);
        };
        setTimeout(tryAutoReload, IDLE_AUTO_RELOAD_MS);
      },
    });
  } catch (e) {
    console.warn("[PWA] Registration failed:", e);
  }
}

/**
 * Manually clear all SW caches and reload. Used by Admin "Reset cache" button.
 */
export async function resetPWACache(): Promise<void> {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((n) => caches.delete(n)));
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) {
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) {
    console.warn("[PWA] reset failed:", e);
  } finally {
    window.location.reload();
  }
}
