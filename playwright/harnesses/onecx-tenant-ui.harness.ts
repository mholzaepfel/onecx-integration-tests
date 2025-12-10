import { Page, expect } from '@playwright/test';

export class OneCxTenantUiHarness {
  constructor(private page: Page, private baseUrl: string) {}

  async openHome() {
    await this.page.goto(this.baseUrl + '/');
    await expect(this.page).toHaveTitle(/onecx|tenant|portal/i);
  }

  async openHeader() {
    // Adjust to actual route if different
    await this.page.goto(this.baseUrl + '/');
    await expect(this.page.getByRole('banner')).toBeVisible();
  }
}
