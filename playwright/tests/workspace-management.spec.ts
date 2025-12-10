import { test, expect } from "@playwright/test";

test("should be logged in and see workspace management", async ({ page }) => {
  // Session is already authenticated via setup
  await page.goto("http://local-proxy/onecx-shell/admin/workspace");

  // Wait for the page to fully load and "Workspace Management" heading to appear
  await expect(
    page.getByRole("heading", { name: "Workspace Management" })
  ).toBeVisible();
});
