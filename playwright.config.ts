import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "node scripts/playwright-standalone-server.mjs";
process.env.SESSION_SECRET ??= "playwright-session-secret-for-local-e2e-only";
process.env.API_KEY ??= "playwright-orgchart-api-key";
process.env.ORGCHART_API_KEY ??= process.env.API_KEY;
process.env.E2E_DISABLE_RATE_LIMIT ??= "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}${basePath}`,
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: webServerCommand,
    port,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
