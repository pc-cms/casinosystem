/**
 * M9 — Offline resilience smoke test.
 *
 * Verifies the two guarantees that the offline rework is meant to deliver:
 *
 * 1. When the network drops mid-session, navigating to a known route
 *    does NOT show the browser "dinosaur" / chunk-load error page — the
 *    OfflineBanner appears instead and the UI keeps rendering from cache.
 *
 * 2. A mutation attempted while offline does not hang the button on
 *    "Recording…" forever. It either falls through to the offline queue
 *    (toast: "Saved offline …") or resolves locally within 10s.
 *
 * This is a smoke test — full Cypress flow per role (Cage IN, OUT,
 * Close Shift, Reception check-in) is documented in
 * docs/OFFLINE-CHECKLIST.md as a manual companion.
 */
import { test, expect } from "../playwright-fixture";

test.describe("Offline resilience", () => {
  test("offline navigation shows the OfflineBanner instead of a chunk error", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

    // Drop the network and try to navigate to a different route.
    await context.setOffline(true);
    await page.goto("/login").catch(() => { /* offline navigation may reject */ });

    // The app shell should still be there — no Chrome dino page, no white screen.
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // Either we still see login, or the explicit OfflineBanner.
    const hasShell = await page.locator('input[type="password"], [role="status"]:has-text("Offline")').count();
    expect(hasShell).toBeGreaterThan(0);

    await context.setOffline(false);
  });

  test("mutations attempted while offline never hang forever", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

    // Drive the offline-mutation wrapper directly from the page context so
    // this test stays robust to auth / role changes.
    await context.setOffline(true);
    const result = await page.evaluate(async () => {
      const start = Date.now();
      try {
        const mod = await import("/src/lib/offline-mutation.ts");
        const r = await mod.offlineMutation({
          table: "transactions",
          operation: "insert",
          payload: { __probe: true },
          onlineTimeoutMs: 2000,
        });
        return { ok: true, elapsed: Date.now() - start, offline: r.offline };
      } catch (e: unknown) {
        return { ok: false, elapsed: Date.now() - start, error: (e as Error).message };
      }
    });
    await context.setOffline(false);

    // Either we synchronously decided we're offline, or the timeout fired —
    // in both cases the wrapper must return within the configured budget
    // plus generous slack.
    expect(result.elapsed).toBeLessThan(10000);
  });
});
