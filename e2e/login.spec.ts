import { test, expect } from "../playwright-fixture";

test.describe("Login Flow", () => {
  test("shows login page with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passInput = page.locator('input[type="password"]');
    await emailInput.fill("invalid@test.com");
    await passInput.fill("wrongpassword");
    await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first().click();
    // Should show some error feedback
    await expect(page.locator("text=/invalid|error|incorrect|denied/i")).toBeVisible({ timeout: 10000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
