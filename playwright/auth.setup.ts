import { test as setup, expect } from '@playwright/test'
import { OneCXKeycloakLoginHarness } from './harnesses/onecx-keycloak-login.harness'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const loginHarness = new OneCXKeycloakLoginHarness(page)

  // Navigate to login page
  await loginHarness.gotoLogin()

  // Perform login with credentials from environment or defaults
  const username = process.env.KEYCLOAK_USERNAME || 'onecx'
  const password = process.env.KEYCLOAK_PASSWORD || 'onecx'

  await loginHarness.login(username, password)

  // Verify login was successful
  await loginHarness.expectLoggedIn()

  // Save authentication state
  await page.context().storageState({ path: authFile })
})
