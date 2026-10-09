import { test, expect, type Page } from "@playwright/test";
import { appPath } from "./helpers/paths";

async function login(page: Page, username: string, password: string) {
  const res = await page.request.post(appPath("/api/auth/login"), { data: { username, password } });
  expect(res.ok()).toBeTruthy();
  const token = res.headers()["set-cookie"]?.match(/orgchart_token=([^;]+)/)?.[1];
  expect(token).toBeTruthy();
  await page.context().addCookies([{ name: "orgchart_token", value: token!, domain: "localhost", path: "/" }]);
}

function integrationHeaders() {
  const apiKey = process.env.API_KEY ?? process.env.ORGCHART_API_KEY;
  expect(apiKey).toBeTruthy();
  return { "X-API-Key": apiKey! };
}

function treeHasEmailField(nodes: unknown[]): boolean {
  const queue = [...nodes];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    const entry = current as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(entry, "email")) return true;
    const children = entry.children;
    if (Array.isArray(children)) queue.push(...children);
  }
  return false;
}

type HeadlessPerson = { id: number; name: string; email: string | null };
const origin = `http://localhost:${process.env.PORT ?? 3000}`;

async function headlessPeople(response: { json(): Promise<unknown> }): Promise<HeadlessPerson[]> {
  const body = await response.json();
  expect(body).toEqual(expect.objectContaining({ people: expect.any(Array) }));
  return (body as { people: HeadlessPerson[] }).people;
}

test.describe.serial("Product QA flow", () => {
  test("base path chart route redirects to login without duplicating the app prefix", async ({ page }) => {
    await page.goto(appPath("/chart"));

    await expect(page).toHaveURL(/\/org-chart\/login\?next=%2Fchart$/);
    expect(page.url()).not.toContain("/org-chart/org-chart/");
  });

  test("tools domain root renders the shared tools directory", async ({ page }) => {
    const headResponse = await page.request.get(`${origin}/`, { maxRedirects: 0 });
    expect(headResponse.status()).toBe(200);
    expect(headResponse.headers().location).toBeUndefined();

    const response = await page.goto(`${origin}/`);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Internal Tools" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configured Next" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Org Chart/ })).toHaveAttribute("href", "/org-chart/chart");
    await expect(page.getByRole("link", { name: /Email Signature/ })).toHaveAttribute("href", "/email-signature");

    const oldToolsPath = await page.request.get(`${origin}/org-chart/tools`, { maxRedirects: 0 });
    expect(oldToolsPath.status()).toBe(307);
    expect(oldToolsPath.headers().location).toBe("/");
  });

  test("reserved tool slugs route to configured production tools", async ({ page }) => {
    const expectedRoutes = [
      ["/ats", "https://rs-tool-ats.vercel.app/"],
      ["/certificate-creator", "https://rs-tool-romega-certificate-creator.vercel.app/"],
      ["/job-scraper", "https://rs-tool-job-scraper.vercel.app/"],
      ["/portal", "https://portal.romega-solutions.com/"],
      ["/ticketing", "https://portal.romega-solutions.com/"],
    ] as const;

    for (const [path, location] of expectedRoutes) {
      const response = await page.request.get(`${origin}${path}`, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toBe(location);
    }
  });

  test("email signature custom route proxies the Email Signature app without leaving tools domain", async ({ page }) => {
    const pageResponse = await page.goto("/email-signature");
    expect(pageResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/email-signature$/);
    expect(new URL(page.url()).pathname).toBe("/email-signature");

    const html = await page.content();
    const assetPaths = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
      .map((match) => match[1])
      .filter((path) => path.startsWith("/_astro/") || ["/romega-logo.svg", "/address.svg", "/fav-icon.ico"].includes(path));
    expect(assetPaths.length).toBeGreaterThan(0);

    for (const assetPath of assetPaths.slice(0, 4)) {
      const assetResponse = await page.request.get(assetPath);
      expect(assetResponse.status(), assetPath).toBe(200);
    }

    for (const path of ["/email-signature/api/health", "/api/signature/schema"]) {
      const response = await page.request.get(path);

      expect(response.status()).toBe(200);
      await expect(response).toBeOK();

      const body = await response.json();
      expect(body).toEqual(
        expect.objectContaining({
          ok: true,
          service: "email-signature",
        })
      );
    }
  });

  test("login form redirects without duplicating the app prefix", async ({ page }) => {
    const user = { username: "admin", name: "Admin", role: "editor" };

    await page.route("**/org-chart/api/auth/login", (route) => {
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "orgchart_token=test-token; Path=/; HttpOnly; SameSite=Lax",
        },
        body: JSON.stringify(user),
      });
    });

    await page.goto(appPath("/login?next=/view"));
    await page.getByLabel("Username").fill("admin");
    await page.getByRole("textbox", { name: "Password" }).fill("deterministic-test-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/org-chart\/view$/, { timeout: 15_000 });
    expect(page.url()).not.toContain("/org-chart/org-chart/");
  });

  test("login page offers a temporary view-only visitor prompt", async ({ page }) => {
    await page.goto(appPath("/login"));

    const prompt = page.getByRole("status", { name: "View-only visitor access" });
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText("New to Romega?");
    await expect(prompt).toContainText("Use view-only access for onboarding.");

    await expect(prompt).toBeHidden({ timeout: 12_000 });

    await page.goto(appPath("/login"));
    await page.getByRole("button", { name: "Use view-only access" }).click();

    await expect(page.getByLabel("Username")).toHaveValue("visitor");
    await expect(page.getByRole("textbox", { name: "Password" })).toHaveValue("");

    const help = page.getByRole("button", { name: "Where do I get the password?" });
    await help.hover();
    await expect(page.getByText("Message the onboarding team if the password is not yet known.")).toBeVisible();
  });

  test("API key can read chart and staff integration endpoints", async ({ page }) => {
    const headers = integrationHeaders();

    const chartRes = await page.request.get(appPath("/api/chart-data"), { headers });
    expect(chartRes.ok()).toBeTruthy();
    const chartData = await chartRes.json();
    expect(chartData.tree.length).toBeGreaterThan(0);
    expect(chartData.departments.length).toBeGreaterThan(0);

    const headlessRes = await page.request.get(appPath("/api/people/headless"), { headers });
    expect(headlessRes.ok()).toBeTruthy();
    expect((await headlessPeople(headlessRes)).length).toBeGreaterThan(0);
  });

  test("people editing endpoints are gone because the portal is the source of truth", async ({ page }) => {
    const headers = integrationHeaders();

    for (const [method, path] of [
      ["POST", "/api/people"],
      ["PATCH", "/api/people/1"],
      ["DELETE", "/api/people/1"],
      ["PATCH", "/api/people/reassign"],
      ["GET", "/api/departments"],
      ["POST", "/api/import"],
      ["POST", "/api/sync"],
      ["GET", "/api/audit"],
    ] as const) {
      const response = await page.request.fetch(appPath(path), { method, headers });
      expect(response.status(), `${method} ${path}`).toBe(404);
    }
  });

  test("visitor account can view the chart but cannot change settings", async ({ page }) => {
    await login(page, "visitor", "HelloRomega321");

    const meRes = await page.request.get(appPath("/api/auth/me"));
    expect(meRes.ok()).toBeTruthy();
    await expect(meRes.json()).resolves.toEqual({
      username: "visitor",
      name: "Visitor",
      role: "viewer",
    });

    const chartRes = await page.request.get(appPath("/api/chart-data"));
    expect(chartRes.ok()).toBeTruthy();

    const forbiddenSettings = await page.request.patch(appPath("/api/settings"), {
      data: { chart_title: "Visitor Should Not Save" },
    });
    expect(forbiddenSettings.status()).toBe(403);

    await page.goto(appPath("/admin/settings"));
    await expect(page).toHaveURL(/\/org-chart\/chart$/);
    await expect(page.getByRole("heading", { name: "Settings" })).not.toBeVisible();
  });

  test("headless people API exposes email while chart-data omits it", async ({ page }) => {
    const headers = integrationHeaders();

    const headlessRes = await page.request.get(appPath("/api/people/headless"), { headers });
    expect(headlessRes.ok()).toBeTruthy();
    const people = await headlessPeople(headlessRes);
    expect(people.length).toBeGreaterThan(0);
    expect(people.every((person) => Object.prototype.hasOwnProperty.call(person, "email"))).toBe(true);

    const chartRes = await page.request.get(appPath("/api/chart-data"), { headers });
    expect(chartRes.ok()).toBeTruthy();
    const chartData = await chartRes.json();
    expect(treeHasEmailField(chartData.tree)).toBe(false);
  });

  test("admin can rotate a generated public view link for login-free chart access", async ({ page }) => {
    await login(page, "admin", "admin123");

    const linkRes = await page.request.get(appPath("/api/public-view-link"));
    expect(linkRes.ok()).toBeTruthy();
    const linkInfo = await linkRes.json();
    expect(linkInfo.code).toMatch(/^[A-Z0-9]{16}$/);
    expect(linkInfo.url).toContain(`/org-chart/view?public=${linkInfo.code}`);
    expect(new Date(linkInfo.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const publicDataRes = await page.request.get(appPath(`/api/public-chart-data?code=${linkInfo.code}`));
    expect(publicDataRes.ok()).toBeTruthy();
    const publicData = await publicDataRes.json();
    expect(publicData.tree.length).toBeGreaterThan(0);

    const invalidRes = await page.request.get(appPath("/api/public-chart-data?code=BADCODE123"));
    expect(invalidRes.status()).toBe(403);

    const rotateRes = await page.request.post(appPath("/api/public-view-link/rotate"));
    expect(rotateRes.ok()).toBeTruthy();
    const rotated = await rotateRes.json();
    expect(rotated.code).toMatch(/^[A-Z0-9]{16}$/);
    expect(rotated.code).not.toBe(linkInfo.code);

    const oldCodeRes = await page.request.get(appPath(`/api/public-chart-data?code=${linkInfo.code}`));
    expect(oldCodeRes.status()).toBe(403);

    const newCodeRes = await page.request.get(appPath(`/api/public-chart-data?code=${rotated.code}`));
    expect(newCodeRes.ok()).toBeTruthy();

    await page.goto(appPath("/admin/settings"));
    await expect(page.getByText("Public View Link")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rotate Link" })).toBeVisible();
  });

  test("public view link APIs use the forwarded public origin instead of the internal service host", async ({ page }) => {
    await login(page, "admin", "admin123");

    const forwardedHeaders = {
      Host: "6682740c7a55:80",
      "X-Forwarded-Host": "tools.romega-solutions.com",
      "X-Forwarded-Proto": "https",
    };

    const linkRes = await page.request.get(appPath("/api/public-view-link"), { headers: forwardedHeaders });
    expect(linkRes.ok()).toBeTruthy();
    const linkInfo = await linkRes.json();
    expect(linkInfo.url).toMatch(/^https:\/\/tools\.romega-solutions\.com\/org-chart\/view\?public=/);
    expect(linkInfo.url).not.toContain("6682740c7a55");

    const rotateRes = await page.request.post(appPath("/api/public-view-link/rotate"), { headers: forwardedHeaders });
    expect(rotateRes.ok()).toBeTruthy();
    const rotated = await rotateRes.json();
    expect(rotated.url).toMatch(/^https:\/\/tools\.romega-solutions\.com\/org-chart\/view\?public=/);
    expect(rotated.url).not.toContain("6682740c7a55");
  });

  test("public view link renders chart without login and offers login prompt", async ({ page }) => {
    await login(page, "admin", "admin123");
    const rotateRes = await page.request.post(appPath("/api/public-view-link/rotate"));
    expect(rotateRes.ok()).toBeTruthy();
    const { code } = await rotateRes.json();

    await page.context().clearCookies();
    await page.goto(appPath(`/view?public=${code}`));

    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/org-chart\/login$/);
  });

  test("settings generated snippets and endpoint labels honor the app base path", async ({ page }) => {
    await login(page, "admin", "admin123");
    await page.goto(appPath("/admin/settings"));

    const origin = await page.evaluate(() => window.location.origin);
    await expect(page.getByText(`src="${origin}${appPath("/view")}"`)).toBeVisible();
    await expect(page.getByText(`curl ${origin}${appPath("/api/chart-data")} -H "X-API-Key: YOUR_KEY"`)).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: "/api/chart-data" }).filter({ hasText: "Auth" })).toBeVisible();
  });

  test("covers read-only chart views, search, export, print, permissions, and mobile smoke", async ({ page, browser }) => {
    test.setTimeout(120_000);

    await login(page, "admin", "admin123");

    const chartRes = await page.request.get(appPath("/api/chart-data"));
    expect(chartRes.ok()).toBeTruthy();
    const chartData = await chartRes.json();
    const rootName: string = chartData.tree[0].name;

    await test.step("chart has no editing controls", async () => {
      await page.goto(appPath("/chart"));
      await expect(page.getByText(rootName).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Photos" })).toHaveCount(0);
    });

    await test.step("verify chart search and view modes", async () => {
      await page.getByRole("button", { name: "Search people" }).click();
      await page.getByPlaceholder("Search by name or title...").fill(rootName);
      await expect(page.getByRole("option", { name: new RegExp(rootName) })).toBeVisible();
      await page.keyboard.press("Escape");

      for (const option of [/Horizontal Tree/, /Department Grid/]) {
        await page.getByLabel("Chart view").click();
        await page.getByRole("option", { name: option }).click();
        await expect(page.getByText(rootName).first()).toBeVisible();
      }
    });

    await test.step("verify export and print output", async () => {
      await page.goto(appPath("/chart"));
      await page.getByRole("button", { name: "Open export options" }).click();
      const [excelDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("menuitem", { name: /Export Excel/ }).click(),
      ]);
      expect(excelDownload.suggestedFilename()).toMatch(/org-chart-.+\.xlsx$/);

      await page.getByRole("button", { name: "Open export options" }).click();
      const [pngDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("menuitem", { name: /PNG Image/ }).click(),
      ]);
      expect(pngDownload.suggestedFilename()).toMatch(/org-chart-.+\.png$/);

      await page.goto(appPath("/chart/print"));
      await expect(page.getByText("Print-ready org chart")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(rootName).first()).toBeVisible();
    });

    await test.step("verify mobile layout smoke", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(appPath("/chart"));
      await expect(page.getByText(rootName).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Search people" })).toBeVisible();
    });

    await test.step("verify viewer cannot reach admin pages", async () => {
      const viewerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
      const viewerPage = await viewerContext.newPage();
      await login(viewerPage, "viewer", "viewer123");

      await viewerPage.goto(appPath("/admin/settings"));
      await expect(viewerPage.getByRole("heading", { name: "Settings" })).not.toBeVisible();
      await viewerContext.close();
    });
  });
});
