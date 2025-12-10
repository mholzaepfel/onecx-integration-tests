import { Page, expect } from "@playwright/test";

export type KeycloakCredentials = { username: string; password: string };

export class OneCxKeycloakLoginHarness {
  constructor(private page: Page, private baseUrl: string) {}

  async gotoLogin() {
    await this.page.goto(this.baseUrl);
  }

  async login(creds: KeycloakCredentials) {
    // Wait for Keycloak login page
    await expect(this.page.getByText("OneCX Realm")).toBeVisible();

    // Fill username
    const usernameInput = this.page.getByRole("textbox", { name: /username/i });
    await usernameInput.fill(creds.username);

    // Fill password
    const passwordInput = this.page.getByRole("textbox", { name: /password/i });
    await passwordInput.fill(creds.password);

    // Click Sign In - the redirect happens automatically
    await this.page.getByRole("button", { name: /Sign In|Anmelden/i }).click();
    
    // Wait for redirect back to shell (URL changes away from keycloak)
    await this.page.waitForURL((url) => !url.href.includes('keycloak'), { 
      timeout: 30000 
    });
  }

  async expectLoggedIn() {
    // Verify the Workspace Management page header is visible after login
    // Increase timeout for slow redirects/loading
    await expect(
      this.page.getByRole("heading", { name: "Workspace Management" })
    ).toBeVisible({ timeout: 30000 });
  }
}
