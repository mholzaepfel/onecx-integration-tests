import { test, expect } from '@playwright/test'

test.describe('Workspace Management', () => {
  test('should display workspace management page', async ({ page }) => {
    await page.goto('/workspace')

    // Wait for the page to fully load
    await expect(page.locator('#page-header')).toContainText('Workspace Verwaltung')
    await expect(page.locator('#page-subheader')).toContainText('Erstellung und Bearbeitung von Workspaces')
  })

  test('should display workspace grid with items', async ({ page }) => {
    await page.goto('/workspace')

    // Wait for dataview to load
    await expect(page.locator('#ws_search_dataview')).toBeVisible()

    // Check that at least one workspace is displayed
    await expect(page.locator('#ws_search_data_grid_row_0')).toBeVisible()
    await expect(page.locator('#ws_search_data_grid_row_0_display_name')).toContainText('OneCX Admin')
  })

  test('should have create and import buttons', async ({ page }) => {
    await page.goto('/workspace')

    // Check action buttons in header
    const createButton = page.getByRole('button', { name: /Erstellen/i })
    const importButton = page.getByRole('button', { name: /Import/i })

    await expect(createButton).toBeVisible()
    await expect(importButton).toBeVisible()
  })

  test('should switch between grid and list view', async ({ page }) => {
    await page.goto('/workspace')

    // Find view mode buttons
    const listViewButton = page.locator('[aria-labelledby="ocx-data-layout-selection-list"]')
    const gridViewButton = page.locator('[aria-labelledby="ocx-data-layout-selection-grid"]')

    // Grid should be selected by default
    await expect(gridViewButton).toHaveClass(/p-highlight/)

    // Click list view
    await listViewButton.click()
    await expect(listViewButton).toHaveClass(/p-highlight/)
  })

  test('should have filter input', async ({ page }) => {
    await page.goto('/workspace')

    const filterInput = page.locator('#data-view-control-filter')
    await expect(filterInput).toBeVisible()

    // Type in filter
    await filterInput.fill('Admin')

    // Workspace should still be visible (matches filter)
    await expect(page.locator('#ws_search_data_grid_row_0')).toBeVisible()
  })

  test('should navigate to workspace detail on click', async ({ page }) => {
    await page.goto('/workspace')

    // Click on workspace card
    await page.locator('#ws_search_data_grid_row_0').click()

    // Should navigate to workspace detail
    await expect(page).toHaveURL(/\/workspace\/ADMIN/)
  })

  test('should have menu management link', async ({ page }) => {
    await page.goto('/workspace')

    const menuLink = page.locator('#ws_search_data_grid_row_0_goto_menu')
    await expect(menuLink).toBeVisible()
    await expect(menuLink).toHaveAttribute('href', '/onecx-shell/admin/workspace/ADMIN/menu')
  })
})

test.describe('Shell Navigation', () => {
  test('should display main navigation menu', async ({ page }) => {
    await page.goto('/workspace')

    // Check main menu sections by their IDs
    await expect(page.locator('#pmm_product_store_header')).toBeVisible()
    await expect(page.locator('#pmm_welcome_header')).toBeVisible()
    await expect(page.locator('#pmm_workspace_mgmt_header')).toBeVisible()
    await expect(page.locator('#pmm_users_and_roles_header')).toBeVisible()
    await expect(page.locator('#pmm_misc_header')).toBeVisible()
    await expect(page.locator('#pmm_developer_tools_header')).toBeVisible()
  })

  test('should expand workspace submenu', async ({ page }) => {
    await page.goto('/workspace')

    // Workspace menu should be expanded (has p-highlight class)
    const workspaceHeader = page.locator('#pmm_workspace_mgmt_header')
    await expect(workspaceHeader).toHaveClass(/p-highlight/)

    // Check submenu items are visible
    await expect(page.locator('#pmm_wm_workspaces')).toBeVisible()
    await expect(page.locator('#pmm_wm_themes')).toBeVisible()
    await expect(page.locator('#pmm_wm_tenants')).toBeVisible()
  })

  test('should navigate to themes page', async ({ page }) => {
    await page.goto('/workspace')

    await page.locator('#pmm_wm_themes a').click()
    await expect(page).toHaveURL(/\/theme/)
  })

  test('should navigate to tenants page', async ({ page }) => {
    await page.goto('/workspace')

    await page.locator('#pmm_wm_tenants a').click()
    await expect(page).toHaveURL(/\/tenant/)
  })

  test('should expand Users & Permissions menu', async ({ page }) => {
    await page.goto('/workspace')

    // Click to expand
    await page.locator('#pmm_users_and_roles_header').click()

    // Wait for expansion animation
    await expect(page.locator('#pmm_users_and_roles_header')).toHaveClass(/p-highlight/)

    // Check submenu items
    await expect(page.locator('#pmm_ur_permissions')).toBeVisible()
    await expect(page.locator('#pmm_ur_iam_users_roles')).toBeVisible()
    await expect(page.locator('#pmm_ur_user_profiles')).toBeVisible()
  })
})

test.describe('Shell Header', () => {
  test('should display user avatar menu', async ({ page }) => {
    await page.goto('/workspace')

    const userAvatarButton = page.locator('#ocx_topbar_action_user_avatar_menu')
    await expect(userAvatarButton).toBeVisible()
  })

  test('should display username', async ({ page }) => {
    await page.goto('/workspace')

    // Username is displayed in header
    await expect(page.locator('ocx-username-component')).toContainText('OneCX Admin')
  })

  test('should open user menu on click', async ({ page }) => {
    await page.goto('/workspace')

    // Click user avatar
    await page.locator('#ocx_topbar_action_user_avatar_menu').click()

    // Menu should be visible
    const userMenu = page.locator('#ws_user_avatar_menu_list')
    await expect(userMenu).not.toHaveAttribute('hidden')

    // Check menu items
    await expect(page.locator('#ws_user_avatar_menu_list_item_1_text')).toContainText('Personal Info')
    await expect(page.locator('#ws_user_avatar_menu_list_item_2_text')).toContainText('Einstellungen')
    await expect(page.locator('#ws_user_avatar_menu_list_item_3_text')).toContainText('Berechtigungen')
    await expect(page.locator('#ws_user_avatar_menu_list_item_logout_text')).toContainText('Abmelden')
  })

  test('should have workspace logo', async ({ page }) => {
    await page.goto('/workspace')

    const logo = page.locator('#ws_logo_ADMIN')
    await expect(logo).toBeVisible()
  })

  test('should have menu toggle button', async ({ page }) => {
    await page.goto('/workspace')

    const toggleButton = page.locator('#ocx_vertical_menu_action_toggle')
    await expect(toggleButton).toBeVisible()
  })
})

test.describe('Breadcrumb Navigation', () => {
  test('should display breadcrumb', async ({ page }) => {
    await page.goto('/workspace')

    const breadcrumb = page.locator('p-breadcrumb')
    await expect(breadcrumb).toBeVisible()

    // Home icon should be present
    await expect(breadcrumb.locator('.pi-home')).toBeVisible()

    // Current location should be shown
    await expect(breadcrumb).toContainText('onecx-workspace')
  })
})

test.describe('Footer', () => {
  test('should display footer menu', async ({ page }) => {
    await page.goto('/workspace')

    await expect(page.locator('#ws_footer_menu_pfm_contact_link')).toContainText('Contact')
    await expect(page.locator('#ws_footer_menu_pfm_imprint_link')).toContainText('Impressum')
  })

  test('should display version info', async ({ page }) => {
    await page.goto('/workspace')

    const versionInfo = page.locator('ocx-version-info-component')
    await expect(versionInfo).toContainText('ADMIN')
  })
})
