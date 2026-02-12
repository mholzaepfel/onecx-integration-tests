import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import { KeycloakLoginHarness } from '../harnesses'

/**
 * Authentication Setup für OneCX Tests
 *
 * Dieser Setup-Test loggt sich über Keycloak ein und speichert den
 * Authentication State für nachfolgende Tests.
 *
 * Environment Variables:
 * - KEYCLOAK_USER: Benutzername (default: admin)
 * - KEYCLOAK_PASSWORD: Passwort (default: admin)
 * - OUTPUT_DIR: Verzeichnis für Auth-State (default: /e2e-results)
 */

const artefactsRoot = process.env.artefacts_ROOT || './artefacts'
const runId = process.env.RUN_ID || 'local'
const outputDir = process.env.OUTPUT_DIR || `${artefactsRoot}/runs/${runId}/e2e-results`
const authFile = `${outputDir}/.auth/user.json`

fs.mkdirSync(`${outputDir}/.auth`, { recursive: true })

setup('Keycloak Authentication', async ({ page }) => {
  const username = process.env.KEYCLOAK_USER || 'onecx'
  const password = process.env.KEYCLOAK_PASSWORD || 'onecx'
  const baseURL = process.env.BASE_URL || 'http://proxy.localhost/onecx-shell/admin/'

  console.log(`[Auth Setup] Navigiere zu: ${baseURL}`)
  console.log(`[Auth Setup] Benutzer: ${username}`)

  // Navigiere zur Anwendung - wird zu Keycloak weitergeleitet
  await page.goto(baseURL)

  // Warte auf Keycloak Login-Seite
  const keycloakHarness = new KeycloakLoginHarness(page)

  // Prüfe ob wir auf der Keycloak-Seite sind
  try {
    await keycloakHarness.waitForPage()
    console.log('[Auth Setup] Keycloak Login-Seite geladen')

    // Realm-Name loggen
    const realmName = await keycloakHarness.getRealmName()
    console.log(`[Auth Setup] Realm: ${realmName}`)

    // Login durchführen
    console.log('[Auth Setup] Führe Login durch...')
    await keycloakHarness.login(username, password)

    // Warte auf Weiterleitung zur Anwendung
    // Nach erfolgreichem Login sollte die URL nicht mehr Keycloak enthalten
    await page.waitForURL((url) => !url.href.includes('/realms/'), {
      timeout: 30000,
    })

    console.log(`[Auth Setup] Redirect erfolgt, URL: ${page.url()}`)

    // WICHTIG: Warte bis die App den OAuth-Code verarbeitet hat
    // Die URL enthält noch #code=... - warte bis das Fragment weg ist oder die App geladen ist
    await page.waitForFunction(
      () => {
        // Prüfe ob die App geladen ist (kein code im Hash oder App-Element sichtbar)
        const hash = window.location.hash
        const hasCode = hash.includes('code=')
        const appLoaded = document.querySelector('ocx-shell') || document.querySelector('app-root')
        return !hasCode || appLoaded
      },
      { timeout: 15000 }
    )

    // Warte auf vollständiges Laden
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Kurze Pause für SPA-Initialisierung

    console.log(`[Auth Setup] Login erfolgreich, finale URL: ${page.url()}`)
  } catch (error) {
    // Falls wir bereits eingeloggt sind (kein Keycloak-Redirect)
    console.log('[Auth Setup] Kein Keycloak-Login erforderlich oder bereits eingeloggt')
    console.log(`[Auth Setup] Error: ${error}`)
  }

  // Warte auf domcontentloaded (networkidle kann bei Polling/WebSockets hängen)
  await page.waitForLoadState('domcontentloaded')

  // Zusätzliche Wartezeit für finale Initialisierung
  await page.waitForTimeout(3000)

  // Speichere den Authentication State
  await page.context().storageState({ path: authFile })
  console.log(`[Auth Setup] Auth-State gespeichert: ${authFile}`)
})
