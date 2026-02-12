import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Konfiguration für OneCX E2E Tests
 *
 * Environment Variables:
 * - BASE_URL: Ziel-URL der Anwendung (z.B. http://proxy.localhost/onecx-shell/admin/)
 * - KEYCLOAK_USER: Benutzername für Keycloak Login (default: admin)
 * - KEYCLOAK_PASSWORD: Passwort für Keycloak Login (default: admin)
 * - OUTPUT_DIR: Verzeichnis für Test-Ergebnisse (default: /e2e-results)
 */

const baseURL = process.env.BASE_URL || 'http://proxy.localhost/onecx-shell/admin/'
const outputDir = process.env.OUTPUT_DIR || '/e2e-results'

export default defineConfig({
  // Test-Verzeichnis
  testDir: './tests',

  // Globales Setup für Authentication
  globalSetup: undefined,

  // Parallele Ausführung deaktivieren für stabile Tests
  fullyParallel: false,
  workers: 1,

  // Retry bei Fehlern
  retries: process.env.CI ? 2 : 0,

  // Reporter für Ausgabe
  reporter: [
    ['html', { outputFolder: `${outputDir}/playwright-report`, open: 'never' }],
    ['json', { outputFile: `${outputDir}/test-results.json` }],
    ['list'],
  ],

  // Globale Timeouts
  timeout: 30000, // 30 Sekunden pro Test
  expect: {
    timeout: 5000, // 5 Sekunden für Assertions
  },

  // Output-Verzeichnis für Traces, Screenshots, Videos
  outputDir: `${outputDir}/test-artifacts`,

  // Gemeinsame Einstellungen für alle Projekte
  use: {
    // Base URL
    baseURL,

    // Tracing aktivieren (on-first-retry oder always)
    trace: 'on',

    // Screenshots bei Fehlern
    screenshot: 'on',

    // Video-Aufnahme
    video: 'on',

    // Network-Logs sammeln (HAR-Datei)
    // HAR wird durch trace bereits erfasst

    // Viewport
    viewport: { width: 1920, height: 1080 },

    // Navigation Timeout
    navigationTimeout: 15000,

    // Action Timeout
    actionTimeout: 10000,

    // Ignoriere HTTPS-Fehler (für lokale Entwicklung)
    ignoreHTTPSErrors: true,

    // Locale für Tests
    locale: 'de-DE',

    // Timezone
    timezoneId: 'Europe/Berlin',
  },

  // Projekte / Browser
  projects: [
    // Setup-Projekt für Authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Hauptprojekt mit Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Authentication State von Setup verwenden
        storageState: `${outputDir}/.auth/user.json`,
      },
      dependencies: ['setup'],
    },
  ],

  // Web Server nicht starten (wird extern bereitgestellt)
  webServer: undefined,
})
