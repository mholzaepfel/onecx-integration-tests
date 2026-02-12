import { Page, Locator } from '@playwright/test'

/**
 * Harness für die OneCX Workspace Search Seite
 * Basiert auf der ocx-workspace-component Struktur
 */
export class WorkspaceSearchHarness {
  readonly page: Page

  // Main Container
  readonly workspaceComponent: Locator
  readonly portalPage: Locator

  // Page Header Elemente
  readonly pageHeader: Locator
  readonly pageHeaderWrapper: Locator
  readonly pageTitle: Locator
  readonly pageSubtitle: Locator
  readonly titleSection: Locator

  // Breadcrumb
  readonly breadcrumb: Locator
  readonly breadcrumbHome: Locator
  readonly breadcrumbItems: Locator

  // Action Buttons (Toolbar)
  readonly toolbar: Locator
  readonly actionButtons: Locator

  // DataView / Search Results
  readonly dataView: Locator
  readonly dataViewControls: Locator
  readonly searchResults: Locator
  readonly workspaceCards: Locator

  // Paginator
  readonly paginator: Locator
  readonly paginatorInfo: Locator
  readonly paginatorFirstButton: Locator
  readonly paginatorPrevButton: Locator
  readonly paginatorNextButton: Locator
  readonly paginatorLastButton: Locator

  // Search Input
  readonly searchInput: Locator

  // Dialogs
  readonly createDialog: Locator
  readonly importDialog: Locator

  constructor(page: Page) {
    this.page = page

    // Main Container
    this.workspaceComponent = page.locator('ocx-workspace-component')
    this.portalPage = page.locator('ocx-portal-page')

    // Page Header
    this.pageHeader = page.locator('ocx-page-header')
    this.pageHeaderWrapper = page.locator('[name="ocx-page-header-wrapper"]')
    this.pageTitle = page.locator('#page-header')
    this.pageSubtitle = page.locator('#page-subheader')
    this.titleSection = page.locator('section.header[aria-label="Page Header"]')

    // Breadcrumb
    this.breadcrumb = page.locator('p-breadcrumb')
    this.breadcrumbHome = page.locator('.p-breadcrumb-home')
    this.breadcrumbItems = page.locator('.p-breadcrumb-list li.p-element')

    // Toolbar / Actions
    this.toolbar = page.locator('.toolbar')
    this.actionButtons = page.locator('.action-button')

    // DataView
    this.dataView = page.locator('#ws_search_dataview')
    this.dataViewControls = page.locator('ocx-data-view-controls')
    this.searchResults = page.locator('section[aria-label="Suchergebnisse: Workspaces"]')
    this.workspaceCards = page.locator('article[aria-label^="Workspace:"]')

    // Paginator
    this.paginator = page.locator('p-paginator')
    this.paginatorInfo = page.locator('.p-paginator-current')
    this.paginatorFirstButton = page.locator('.p-paginator-first')
    this.paginatorPrevButton = page.locator('.p-paginator-prev')
    this.paginatorNextButton = page.locator('.p-paginator-next')
    this.paginatorLastButton = page.locator('.p-paginator-last')

    // Search
    this.searchInput = page.locator('.p-inputgroup input[type="text"]')

    // Dialogs
    this.createDialog = page.locator('app-workspace-create p-dialog')
    this.importDialog = page.locator('app-workspace-import p-dialog')
  }

  /**
   * Prüft ob die Workspace-Seite geladen ist
   */
  async isVisible(): Promise<boolean> {
    return this.workspaceComponent.isVisible()
  }

  /**
   * Wartet auf die Workspace-Seite
   */
  async waitForPage(): Promise<void> {
    // Reduzierter Timeout für schnelleres Feedback
    await this.workspaceComponent.waitFor({ state: 'visible', timeout: 15000 })
    await this.pageHeader.waitFor({ state: 'visible', timeout: 10000 })
  }

  /**
   * Holt den Seitentitel
   */
  async getPageTitle(): Promise<string> {
    return this.pageTitle.innerText()
  }

  /**
   * Holt den Seiten-Untertitel
   */
  async getPageSubtitle(): Promise<string> {
    return this.pageSubtitle.innerText()
  }

  /**
   * Prüft ob der Header korrekt angezeigt wird
   */
  async isHeaderVisible(): Promise<boolean> {
    return this.pageHeader.isVisible()
  }

  /**
   * Holt die Breadcrumb-Elemente als Array
   */
  async getBreadcrumbItems(): Promise<string[]> {
    const items = await this.breadcrumbItems.allInnerTexts()
    return items.filter((item) => item.trim().length > 0)
  }

  /**
   * Holt die Anzahl der angezeigten Workspace-Karten
   */
  async getWorkspaceCardCount(): Promise<number> {
    return this.workspaceCards.count()
  }

  /**
   * Holt alle Workspace-Namen aus den Karten
   */
  async getWorkspaceNames(): Promise<string[]> {
    const cards = await this.workspaceCards.all()
    const names: string[] = []
    for (const card of cards) {
      const ariaLabel = await card.getAttribute('aria-label')
      if (ariaLabel) {
        // Format: "Workspace: OneCX Admin"
        const name = ariaLabel.replace('Workspace: ', '')
        names.push(name)
      }
    }
    return names
  }

  /**
   * Klickt auf einen Workspace anhand des Namens
   */
  async clickWorkspace(name: string): Promise<void> {
    const card = this.page.locator(`article[aria-label="Workspace: ${name}"]`)
    await card.click()
  }

  /**
   * Holt die Paginator-Info (z.B. "1 - 1 von 1")
   */
  async getPaginatorInfo(): Promise<string> {
    return this.paginatorInfo.innerText()
  }

  /**
   * Prüft ob der Paginator sichtbar ist
   */
  async isPaginatorVisible(): Promise<boolean> {
    return this.paginator.isVisible()
  }

  /**
   * Holt die Anzahl der Action Buttons in der Toolbar
   */
  async getActionButtonCount(): Promise<number> {
    return this.actionButtons.count()
  }

  /**
   * Klickt auf den ersten Action Button (normalerweise "Neuer Workspace")
   */
  async clickFirstActionButton(): Promise<void> {
    await this.actionButtons.first().click()
  }

  /**
   * Sucht nach Workspaces
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query)
    // Trigger search (Enter oder automatisch)
    await this.searchInput.press('Enter')
  }

  /**
   * Prüft ob der DataView geladen ist
   */
  async isDataViewVisible(): Promise<boolean> {
    return this.dataView.isVisible()
  }

  /**
   * Wartet auf Suchergebnisse
   */
  async waitForSearchResults(): Promise<void> {
    await this.searchResults.waitFor({ state: 'visible', timeout: 30000 })
  }
}
