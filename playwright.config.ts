import { defineConfig } from "@playwright/test";

// Runs against the dev database with seeded fake data: `npm run db:seed` first.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100", trace: "off" },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { DEV_LOGIN: "1" },
  },
});
