import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";
process.env.API_KEY ??= "playwright-orgchart-api-key";
process.env.ORGCHART_API_KEY ??= process.env.API_KEY;

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
    command: "pnpm dev",
    port,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
