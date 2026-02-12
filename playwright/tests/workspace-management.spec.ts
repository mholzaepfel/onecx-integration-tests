import { test, expect } from '@playwright/test'
import { WorkspaceSearchHarness } from '../harnesses'

/**
 * E2E Tests für Workspace Management
 *
 * Diese Tests prüfen die Workspace-Verwaltungsseite:
 * - Seitenlayout und Header
 * - Breadcrumb-Navigation
 * - Workspace-Suche und -Liste
 * - Pagination
 */

test.describe('Workspace Management', () => {
  let workspaceHarness: WorkspaceSearchHarness

  test.beforeEach(async ({ page }) => {
    workspaceHarness = new WorkspaceSearchHarness(page)

    // Navigiere zur Workspace-Seite (volle URL verwenden)
    const baseUrl = process.env.BASE_URL || 'http://proxy.localhost/onecx-shell/admin/'
    await page.goto(`${baseUrl}admin`)

    // Warte auf domcontentloaded erst
    await page.waitForLoadState('domcontentloaded')

    // Falls wir zu Keycloak weitergeleitet wurden, ist die Auth fehlgeschlagen
    const currentUrl = page.url()
    if (currentUrl.includes('/realms/')) {
      throw new Error(`Auth fehlgeschlagen - wurde zu Keycloak geleitet: ${currentUrl}`)
    }

    // Warte auf die Seite mit reduziertem Timeout
    await workspaceHarness.waitForPage()
  })

  test.describe('Page Header', () => {
    test('sollte den korrekten Seitentitel anzeigen', async ({ page }) => {
      const title = await workspaceHarness.getPageTitle()
      expect(title).toBe('Workspace Verwaltung')
    })

    test('sollte den korrekten Untertitel anzeigen', async ({ page }) => {
      const subtitle = await workspaceHarness.getPageSubtitle()
      expect(subtitle).toBe('Erstellung und Bearbeitung von Workspaces')
    })

    test('sollte den Header sichtbar anzeigen', async ({ page }) => {
      const isVisible = await workspaceHarness.isHeaderVisible()
      expect(isVisible).toBe(true)
    })

    test('sollte Action-Buttons in der Toolbar haben', async ({ page }) => {
      const buttonCount = await workspaceHarness.getActionButtonCount()
      expect(buttonCount).toBeGreaterThan(0)
    })
  })

  test.describe('Breadcrumb Navigation', () => {
    test('sollte Breadcrumb anzeigen', async ({ page }) => {
      const isVisible = await workspaceHarness.breadcrumb.isVisible()
      expect(isVisible).toBe(true)
    })

    test('sollte Home-Link im Breadcrumb haben', async ({ page }) => {
      const isVisible = await workspaceHarness.breadcrumbHome.isVisible()
      expect(isVisible).toBe(true)
    })
  })

  test.describe('Workspace Liste', () => {
    test('sollte den DataView anzeigen', async ({ page }) => {
      const isVisible = await workspaceHarness.isDataViewVisible()
      expect(isVisible).toBe(true)
    })

    test('sollte mindestens einen Workspace anzeigen', async ({ page }) => {
      await workspaceHarness.waitForSearchResults()
      const count = await workspaceHarness.getWorkspaceCardCount()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('sollte Workspace-Namen anzeigen', async ({ page }) => {
      await workspaceHarness.waitForSearchResults()
      const names = await workspaceHarness.getWorkspaceNames()
      expect(names.length).toBeGreaterThan(0)
      console.log('Gefundene Workspaces:', names)
    })
  })

  test.describe('Pagination', () => {
    test('sollte Paginator anzeigen', async ({ page }) => {
      const isVisible = await workspaceHarness.isPaginatorVisible()
      expect(isVisible).toBe(true)
    })

    test('sollte Paginator-Info anzeigen', async ({ page }) => {
      const info = await workspaceHarness.getPaginatorInfo()
      expect(info).toMatch(/\d+\s*-\s*\d+\s*von\s*\d+/)
    })
  })

  test.describe('Screenshots und Dokumentation', () => {
    test('sollte Screenshot der Workspace-Seite erstellen', async ({ page }) => {
      // Warte auf vollständiges Laden
      await page.waitForLoadState('networkidle')
      await workspaceHarness.waitForSearchResults()

      // Screenshot erstellen
      await page.screenshot({
        path: `${process.env.OUTPUT_DIR || '/e2e-results'}/screenshots/workspace-search-page.png`,
        fullPage: true,
      })
    })

    test('sollte Screenshot des Headers erstellen', async ({ page }) => {
      const header = workspaceHarness.pageHeader
      await header.screenshot({
        path: `${process.env.OUTPUT_DIR || '/e2e-results'}/screenshots/workspace-header.png`,
      })
    })
  })
})
