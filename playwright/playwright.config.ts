import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// Load .env file for local development (Docker sets env vars directly)
if (!process.env.CI) {
  require('dotenv').config()
}

const baseURL = process.env.BASE_URL || 'http://proxy.localhost/onecx-shell/admin/'
const authFile = path.join(__dirname, '.auth/user.json')

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/*.test.ts', '**/node_modules/**', '**/src/**'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000, // 60s per test
  globalTimeout: 600000, // 10min for entire test suite
  reporter: [
    ['html', { outputFolder: 'playwright-output/html', open: 'never' }],
    ['junit', { outputFile: 'playwright-output/junit.xml' }],
    ['list'],
  ],
  outputDir: 'playwright-output/artifacts',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000, // 15s per action
    navigationTimeout: 30000, // 30s for navigation
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: '.',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
})
