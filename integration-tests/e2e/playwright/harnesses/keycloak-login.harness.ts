import { Page, Locator } from '@playwright/test'

/**
 * Harness für die Keycloak Login-Seite
 * Basiert auf der Keycloak PF5 Login-Template Struktur
 */
export class KeycloakLoginHarness {
  readonly page: Page

  // Header Elemente
  readonly header: Locator
  readonly headerWrapper: Locator

  // Form Elemente
  readonly loginForm: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly signInButton: Locator
  readonly showPasswordButton: Locator

  // Labels
  readonly usernameLabel: Locator
  readonly passwordLabel: Locator

  // Error Container
  readonly usernameErrorContainer: Locator
  readonly passwordErrorContainer: Locator

  // Page Title
  readonly pageTitle: Locator

  constructor(page: Page) {
    this.page = page

    // Header
    this.header = page.locator('#kc-header')
    this.headerWrapper = page.locator('#kc-header-wrapper')

    // Form
    this.loginForm = page.locator('#kc-form-login')
    this.usernameInput = page.locator('#username')
    this.passwordInput = page.locator('#password')
    this.signInButton = page.locator('#kc-login')
    this.showPasswordButton = page.locator('[data-password-toggle]')

    // Labels
    this.usernameLabel = page.locator('label[for="username"]')
    this.passwordLabel = page.locator('label[for="password"]')

    // Error Containers
    this.usernameErrorContainer = page.locator('#input-error-container-username')
    this.passwordErrorContainer = page.locator('#input-error-container-password')

    // Page Title
    this.pageTitle = page.locator('#kc-page-title')
  }

  /**
   * Prüft ob die Keycloak Login-Seite angezeigt wird
   */
  async isVisible(): Promise<boolean> {
    return this.loginForm.isVisible()
  }

  /**
   * Wartet auf die Keycloak Login-Seite
   */
  async waitForPage(): Promise<void> {
    await this.loginForm.waitFor({ state: 'visible', timeout: 30000 })
  }

  /**
   * Führt den Login durch
   * @param username Benutzername oder E-Mail
   * @param password Passwort
   */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.signInButton.click()
  }

  /**
   * Holt den aktuellen Header-Text (Realm-Name)
   */
  async getRealmName(): Promise<string> {
    return this.headerWrapper.innerText()
  }

  /**
   * Holt den Seitentitel
   */
  async getPageTitle(): Promise<string> {
    return this.pageTitle.innerText()
  }

  /**
   * Prüft ob Fehler-Meldungen für Username angezeigt werden
   */
  async hasUsernameError(): Promise<boolean> {
    const content = await this.usernameErrorContainer.textContent()
    return content !== null && content.trim().length > 0
  }

  /**
   * Prüft ob Fehler-Meldungen für Password angezeigt werden
   */
  async hasPasswordError(): Promise<boolean> {
    const content = await this.passwordErrorContainer.textContent()
    return content !== null && content.trim().length > 0
  }

  /**
   * Togglet die Passwort-Sichtbarkeit
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.showPasswordButton.click()
  }

  /**
   * Prüft ob das Passwort sichtbar ist (type="text" statt type="password")
   */
  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute('type')
    return type === 'text'
  }
}
