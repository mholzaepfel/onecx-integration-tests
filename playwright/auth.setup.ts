import { test as setup, expect } from "@playwright/test";
import { OneCxKeycloakLoginHarness } from "./harnesses/onecx-keycloak-login.harness";

const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const baseUrl =
    process.env.BASE_URL || "http://local-proxy/onecx-shell/admin/";
  const username = process.env.USERNAME || "onecx";
  const password = process.env.PASSWORD || "onecx";

  const keycloak = new OneCxKeycloakLoginHarness(page, baseUrl);
  await keycloak.gotoLogin();
  await keycloak.login({ username, password });
  await keycloak.expectLoggedIn();

  // Log the URL after login to help debug
  console.log("Logged in, current URL:", page.url());

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
