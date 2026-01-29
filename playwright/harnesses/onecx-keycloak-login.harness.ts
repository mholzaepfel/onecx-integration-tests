import { Page, expect } from '@playwright/test'

export class OneCXKeycloakLoginHarness {
  constructor(private page: Page) {}

  async gotoLogin() {
    console.log('[Login] Navigating to application...')
    // Navigate to baseURL (configured in playwright.config.ts)
    // Using empty string navigates to the exact baseURL
    await this.page.goto('')

    // Wait for either the login page or the shell to load
    try {
      // Check if we're already logged in (shell loaded)
      await this.page.waitForSelector('ocx-shell-root', { timeout: 5000 })
      console.log('[Login] Already logged in - shell is visible')
      return
    } catch {
      console.log('[Login] Not logged in, waiting for Keycloak...')
    }

    // Wait for Keycloak login page - check for the form
    await this.page.waitForSelector('#kc-form-login', { timeout: 30000 })
    console.log('[Login] Keycloak login page loaded')

    // Verify we're on the OneCX Realm
    await expect(this.page.locator('#kc-header-wrapper')).toContainText('OneCX Realm')
  }

  async login(username: string, password: string) {
    console.log(`[Login] Attempting login as ${username}...`)

    // Check if already logged in
    const isLoggedIn = await this.page
      .locator('ocx-shell-root')
      .isVisible()
      .catch(() => false)
    if (isLoggedIn) {
      console.log('[Login] Already logged in, skipping login')
      return
    }

    // Wait for the login form
    await this.page.waitForSelector('#kc-form-login', { timeout: 30000 })

    // Fill username field
    const usernameField = this.page.locator('#username')
    await usernameField.waitFor({ state: 'visible', timeout: 10000 })
    await usernameField.fill(username)
    console.log('[Login] Username filled')

    // Fill password field
    const passwordField = this.page.locator('#password')
    await passwordField.waitFor({ state: 'visible', timeout: 10000 })
    await passwordField.fill(password)
    console.log('[Login] Password filled')

    // Click Sign In button
    const loginButton = this.page.locator('#kc-login')
    await loginButton.click()
    console.log('[Login] Sign In button clicked')

    // Wait for successful login - shell should appear
    await this.page.waitForSelector('ocx-shell-root', { timeout: 60000 })
    console.log('[Login] Shell loaded - login successful')
  }

  async expectLoggedIn() {
    // Verify shell is loaded
    await expect(this.page.locator('ocx-shell-root')).toBeVisible({ timeout: 30000 })

    // Verify user avatar is visible
    await expect(this.page.locator('#ocx_topbar_action_user_avatar_menu')).toBeVisible()

    // Verify username is displayed
    await expect(this.page.locator('ocx-username-component')).toBeVisible()

    console.log('[Login] Login verification passed')
  }

  async expectLoginPage() {
    // Verify we're on Keycloak login page
    await expect(this.page.locator('#kc-form-login')).toBeVisible({ timeout: 30000 })
    await expect(this.page.locator('#kc-header-wrapper')).toContainText('OneCX Realm')
    await expect(this.page.locator('#kc-page-title')).toContainText('Sign in to your account')
  }

  async logout() {
    console.log('[Logout] Starting logout...')

    // Click user avatar to open menu
    await this.page.locator('#ocx_topbar_action_user_avatar_menu').click()

    // Wait for menu to be visible - use Playwright's locator approach
    const userMenu = this.page.locator('#ws_user_avatar_menu_list')
    await expect(userMenu).not.toHaveAttribute('hidden', '', { timeout: 5000 })

    // Click logout button
    await this.page.locator('#ws_user_avatar_menu_list_item_logout').click()

    // Wait for Keycloak login page
    await this.page.waitForSelector('#kc-form-login', { timeout: 30000 })
    console.log('[Logout] Logout successful')
  }
}
