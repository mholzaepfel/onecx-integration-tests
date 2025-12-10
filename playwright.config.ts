import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, ".env") });

export default defineConfig({
  testDir: "./playwright/tests",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  reporter: [["line"]],
  use: {
    baseURL: process.env.BASE_URL || "http://local-proxy/onecx-shell/admin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    navigationTimeout: 30_000,
    // Slow down by 500ms per action (remove for CI/normal runs)
    // launchOptions: { slowMo: 500 },
  },
  projects: [
    // Setup project for authentication
    {
      name: "setup",
      testMatch: /.*\.setup\.ts$/,
      testDir: "./playwright",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use authenticated state from setup
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
