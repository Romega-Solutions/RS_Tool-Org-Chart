import { test, expect, type Page } from "@playwright/test";
import { appPath, assetPath } from "./helpers/paths";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

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
    const response = await page.goto(`${origin}/`);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Internal Tools" })).toBeVisible();
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

  test("API key can access protected integration endpoints", async ({ page }) => {
    const apiKey = process.env.API_KEY ?? process.env.ORGCHART_API_KEY;
    expect(apiKey).toBeTruthy();

    const headers = { "X-API-Key": apiKey! };
    const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
    expect(departmentsRes.ok()).toBeTruthy();
    const departments = await departmentsRes.json();
    expect(departments.length).toBeGreaterThan(0);

    const qaName = `API Key QA ${Date.now()}`;
    let personId: number | null = null;

    try {
      const createRes = await page.request.post(appPath("/api/people"), {
        headers,
        data: {
          name: qaName,
          title: "Integration QA",
          departmentId: departments[0].id,
          reportsTo: null,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const patchRes = await page.request.patch(appPath(`/api/people/${personId}`), {
        headers,
        data: { title: "Integration QA Edited", isActive: true },
      });
      expect(patchRes.ok()).toBeTruthy();
    } finally {
      if (personId) {
        const deleteRes = await page.request.delete(appPath(`/api/people/${personId}`), { headers });
        expect(deleteRes.ok()).toBeTruthy();
      }
    }
  });

  test("visitor account can view but cannot edit employee data", async ({ page }) => {
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

    const departmentsRes = await page.request.get(appPath("/api/departments"));
    expect(departmentsRes.ok()).toBeTruthy();
    const departments = await departmentsRes.json();
    expect(departments.length).toBeGreaterThan(0);

    const forbiddenCreate = await page.request.post(appPath("/api/people"), {
      data: {
        name: `Visitor Forbidden QA ${Date.now()}`,
        title: "Should Not Save",
        departmentId: departments[0].id,
        reportsTo: null,
        displayOrder: 9999,
      },
    });
    expect(forbiddenCreate.status()).toBe(403);

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
    const qaName = `Headless Email QA ${Date.now()}`;
    const qaEmail = `headless-${Date.now()}@example.com`;
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();

      const createRes = await page.request.post(appPath("/api/people"), {
        headers,
        data: {
          name: qaName,
          title: "Headless Email QA",
          departmentId: departments[0].id,
          reportsTo: null,
          email: qaEmail,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const headlessRes = await page.request.get(appPath("/api/people/headless"), { headers });
      expect(headlessRes.ok()).toBeTruthy();
      const people = await headlessPeople(headlessRes);
      const headlessPerson = people.find((person) => person.name === qaName);
      expect(headlessPerson?.email).toBe(qaEmail);

      const chartRes = await page.request.get(appPath("/api/chart-data"), { headers });
      expect(chartRes.ok()).toBeTruthy();
      const chartData = await chartRes.json();
      expect(treeHasEmailField(chartData.tree)).toBe(false);
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`), { headers }).catch(() => undefined);
      }
    }
  });

  test("sync validates Work Email and avoids applying invalid email values", async ({ page }) => {
    await login(page, "admin", "admin123");
    const qaName = `Sync Email QA ${Date.now()}`;
    const qaEmail = `sync-${Date.now()}@example.com`;
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Sync Email QA",
          departmentId: departments[0].id,
          reportsTo: null,
          email: qaEmail,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const invalidCsv = [
        "Name,Role/Position,Team,Work Email",
        `${qaName},Sync Email QA Updated,${departments[0].name},not-an-email`,
      ].join("\n");
      const invalidSyncRes = await page.request.post(appPath("/api/sync"), {
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(invalidCsv)}` },
      });
      expect(invalidSyncRes.ok()).toBeTruthy();
      const invalidSyncJson = await invalidSyncRes.json();
      expect(invalidSyncJson.summary.updated).toBe(1);
      expect(invalidSyncJson.changes.warnings.some(
        (warning: { name: string; message: string }) => warning.name === qaName && warning.message.includes("Invalid email")
      )).toBe(true);
      expect(invalidSyncJson.changes.email.some((entry: { name: string }) => entry.name === qaName)).toBe(false);

      const headlessRes = await page.request.get(appPath("/api/people/headless"));
      expect(headlessRes.ok()).toBeTruthy();
      const people = await headlessPeople(headlessRes);
      const updatedPerson = people.find((person) => person.id === personId);
      expect(updatedPerson?.email).toBe(qaEmail);

      const clearCsv = [
        "Name,Role/Position,Team,Work Email",
        `${qaName},Sync Email QA Cleared,${departments[0].name},`,
      ].join("\n");
      const clearSyncRes = await page.request.post(appPath("/api/sync"), {
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(clearCsv)}` },
      });
      expect(clearSyncRes.ok()).toBeTruthy();

      const clearedHeadlessRes = await page.request.get(appPath("/api/people/headless"));
      expect(clearedHeadlessRes.ok()).toBeTruthy();
      const clearedPeople = await headlessPeople(clearedHeadlessRes);
      const clearedPerson = clearedPeople.find((person) => person.id === personId);
      expect(clearedPerson?.email).toBeNull();
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
    }
  });

  test("import supports Work Email header and clears email on blank values", async ({ page }) => {
    await login(page, "admin", "admin123");
    const qaName = `Import Email QA ${Date.now()}`;
    const qaEmail = `import-${Date.now()}@example.com`;
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Import Email QA",
          departmentId: departments[0].id,
          reportsTo: null,
          email: qaEmail,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const clearCsv = `name,title,department,reports_to_name,photo_filename,Work Email\n${qaName},Import Email QA,${departments[0].name},,,`;
      const clearRes = await page.request.post(appPath("/api/import"), {
        multipart: {
          file: {
            name: `import-clear-${Date.now()}.csv`,
            mimeType: "text/csv",
            buffer: Buffer.from(clearCsv),
          },
        },
      });
      expect(clearRes.ok()).toBeTruthy();
      const clearJson = await clearRes.json();
      expect(clearJson.results.some((entry: { name: string; status: string }) => (
        entry.name === qaName && entry.status === "updated"
      ))).toBe(true);

      const clearedRes = await page.request.get(appPath("/api/people/headless"));
      expect(clearedRes.ok()).toBeTruthy();
      const clearedPeople = await headlessPeople(clearedRes);
      const clearedPersonFromImport = clearedPeople.find((person) => person.id === personId);
      expect(clearedPersonFromImport?.email).toBeNull();

      const invalidCsv = `name,title,department,Work Email\n${qaName},Import Email QA,${departments[0].name},not-an-email`;
      const invalidRes = await page.request.post(appPath("/api/import"), {
        multipart: {
          file: {
            name: `import-invalid-${Date.now()}.csv`,
            mimeType: "text/csv",
            buffer: Buffer.from(invalidCsv),
          },
        },
      });
      expect(invalidRes.ok()).toBeTruthy();
      const invalidJson = await invalidRes.json();
      expect(invalidJson.results.some((entry: { name: string; status: string; message?: string }) => (
        entry.name === qaName && entry.status === "error" && entry.message?.includes("Invalid email")
      ))).toBe(true);

      const invalidHeadlessRes = await page.request.get(appPath("/api/people/headless"));
      expect(invalidHeadlessRes.ok()).toBeTruthy();
      const invalidPeople = await headlessPeople(invalidHeadlessRes);
      const stillNullAfterInvalid = invalidPeople.find((person) => person.id === personId);
      expect(stillNullAfterInvalid?.email).toBeNull();
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
    }
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
    await expect(page.getByText(`curl ${origin}${appPath("/api/people")} -H "X-API-Key: YOUR_KEY"`)).toBeVisible();
    await expect(page.getByText(`curl ${origin}${appPath("/api/chart-data")}`)).toBeVisible();

    for (const endpoint of ["/api/departments", "/api/chart-data", "/api/audit", "/api/photos"]) {
      await expect(page.locator("tr").filter({ hasText: endpoint }).filter({ hasText: "Auth" })).toBeVisible();
    }
  });

  test("people edit form saves through the configured app base path", async ({ page }) => {
    const qaName = `Edit Base Path QA ${Date.now()}`;
    const driveShareUrl = "https://drive.google.com/file/d/1d-ittEfrRJh_C4YQXpYL2xHVX6H5Cx_y/view?usp=sharing";
    let personId: number | null = null;
    const patchUrls: string[] = [];
    const optimizedPreviewUrls: string[] = [];

    await login(page, "admin", "admin123");
    await page.route("https://drive.google.com/**", (route) => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "image/png" },
        body: png1x1,
      });
    });
    page.on("request", (request) => {
      const url = request.url();
      if (request.method() === "PATCH" && url.includes(`/api/people/${personId}`)) {
        patchUrls.push(url);
      }
      if (url.includes("/_next/image") && url.includes("drive.google.com")) {
        optimizedPreviewUrls.push(url);
      }
    });

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Base Path QA",
          departmentId: departments[0].id,
          reportsTo: null,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      await page.goto(appPath("/admin/team"));
      await page.getByPlaceholder("Search by name, title, or department...").fill(qaName);
      await page.locator("tbody tr").filter({ hasText: qaName }).first().locator("td").nth(1).click();

      const dialog = page.getByRole("dialog", { name: "Edit Person" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Title *").fill("Base Path QA Edited");
      await dialog.getByPlaceholder("or paste image / Google Drive URL").fill(driveShareUrl);
      await dialog.getByRole("button", { name: "Save" }).click();

      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
      expect(patchUrls.length).toBeGreaterThan(0);
      expect(patchUrls[0]).toContain(appPath(`/api/people/${personId}`));
      expect(patchUrls[0]).not.toContain("/org-chart/org-chart/");
      expect(optimizedPreviewUrls).toEqual([]);

      const personRes = await page.request.get(appPath(`/api/people/${personId}`));
      expect(personRes.ok()).toBeTruthy();
      const updatedPerson = await personRes.json();
      expect(updatedPerson.title).toBe("Base Path QA Edited");
      expect(updatedPerson.photoUrl).toBe("https://drive.google.com/uc?export=view&id=1d-ittEfrRJh_C4YQXpYL2xHVX6H5Cx_y");
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
    }
  });

  test("imports external sheet photos into managed photo storage", async ({ page }) => {
    const qaName = `Photo Import QA ${Date.now()}`;
    const externalPhotoUrl = `data:image/png;base64,${png1x1.toString("base64")}`;
    let personId: number | null = null;
    let importedUrl: string | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Photo Import QA",
          departmentId: departments[0].id,
          reportsTo: null,
          photoUrl: externalPhotoUrl,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const importRes = await page.request.post(appPath("/api/photos/import-external"));
      expect(importRes.ok()).toBeTruthy();
      const importJson = await importRes.json();
      expect(importJson.summary.imported).toBeGreaterThanOrEqual(1);
      expect(importJson.results.some((result: { personId: number; status: string }) => (
        result.personId === personId && result.status === "imported"
      ))).toBeTruthy();

      const personRes = await page.request.get(appPath(`/api/people/${personId}`));
      expect(personRes.ok()).toBeTruthy();
      const person = await personRes.json();
      importedUrl = person.photoUrl;
      expect(importedUrl).toMatch(/^\/uploads\/photos\/.+\.webp$/);

      const importedPhotoRes = await page.request.get(assetPath(importedUrl));
      expect(importedPhotoRes.ok()).toBeTruthy();
      expect(importedPhotoRes.headers()["content-type"]).toContain("image/webp");

      const photosRes = await page.request.get(appPath("/api/photos"));
      expect(photosRes.ok()).toBeTruthy();
      const photos = await photosRes.json();
      expect(photos.some((photo: { url: string; usedBy: { id: number } | null }) => (
        photo.url === importedUrl && photo.usedBy?.id === personId
      ))).toBeTruthy();

      await page.goto(appPath("/admin/photos"));
      await expect(page.getByRole("button", { name: /Import External/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Clean Unused/ })).toBeVisible();
      const photoCard = page.locator("[data-slot='card']").filter({ hasText: qaName });
      await expect(photoCard).toBeVisible();
      await photoCard.hover();
      await expect(photoCard.getByRole("button", { name: /Crop/ })).toBeVisible();
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
      if (importedUrl) {
        const filename = importedUrl.split("/").pop();
        if (filename) await page.request.delete(appPath(`/api/photos/${encodeURIComponent(filename)}`)).catch(() => undefined);
      }
    }
  });

  test("sync reads sheet status and deactivates resigned people", async ({ page }) => {
    const qaName = `Status Sync QA ${Date.now()}`;
    let personId: number | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Status Sync QA",
          departmentId: departments[0].id,
          reportsTo: null,
          isActive: true,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const csv = [
        "Name,Role/Position,Team,Status",
        `${qaName},Status Sync QA,${departments[0].name},Resigned`,
      ].join("\n");
      const syncRes = await page.request.post(appPath("/api/sync"), {
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
      });
      expect(syncRes.ok()).toBeTruthy();

      const personRes = await page.request.get(appPath(`/api/people/${personId}`));
      expect(personRes.ok()).toBeTruthy();
      const person = await personRes.json();
      expect(person.isActive).toBe(false);
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
    }
  });

  test("sync uses Org Chart Team when sheet Team has multiple departments", async ({ page }) => {
    const qaName = `Multi Team QA ${Date.now()}`;
    let personId: number | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      const technicalDept = departments.find((department: { name: string }) => (
        department.name.toLowerCase() === "technical" || department.name.toLowerCase() === "tech"
      ));
      expect(technicalDept).toBeTruthy();

      const csv = [
        "Name,Role/Position,Team,Org Chart Team,Status",
        `${qaName},Multi Team QA,HR/Finance & Tech,${technicalDept.name},Active`,
      ].join("\n");
      const syncRes = await page.request.post(appPath("/api/sync"), {
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
      });
      expect(syncRes.ok()).toBeTruthy();
      const syncJson = await syncRes.json();
      const result = syncJson.results.find((entry: { name: string }) => entry.name === qaName);
      expect(result?.status).toBe("created");

      const peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"));
      expect(peopleRes.ok()).toBeTruthy();
      const people = await peopleRes.json();
      const person = people.find((entry: { name: string }) => entry.name === qaName);
      personId = person?.id ?? null;
      expect(personId).toBeTruthy();
      expect(person.departmentName).toBe(technicalDept.name);
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
    }
  });

  test("sync preserves an imported local photo when sheet still has an external photo URL", async ({ page }) => {
    const qaName = `Preserve Photo QA ${Date.now()}`;
    const externalPhotoUrl = `data:image/png;base64,${png1x1.toString("base64")}`;
    let personId: number | null = null;
    let localPhotoUrl: string | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const uploadRes = await page.request.post(appPath("/api/upload"), {
        multipart: {
          file: {
            name: `preserve-photo-${Date.now()}.png`,
            mimeType: "image/png",
            buffer: png1x1,
          },
        },
      });
      expect(uploadRes.ok()).toBeTruthy();
      localPhotoUrl = (await uploadRes.json()).url;

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Preserve Photo QA",
          departmentId: departments[0].id,
          reportsTo: null,
          photoUrl: localPhotoUrl,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const csv = [
        "Name,Role/Position,Team,Photo,Status",
        `${qaName},Preserve Photo QA,${departments[0].name},"${externalPhotoUrl}",Active`,
      ].join("\n");
      const syncRes = await page.request.post(appPath("/api/sync"), {
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
      });
      expect(syncRes.ok()).toBeTruthy();

      const personRes = await page.request.get(appPath(`/api/people/${personId}`));
      expect(personRes.ok()).toBeTruthy();
      const person = await personRes.json();
      expect(person.photoUrl).toBe(localPhotoUrl);
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
      if (localPhotoUrl) {
        const filename = localPhotoUrl.split("/").pop();
        if (filename) await page.request.delete(appPath(`/api/photos/${encodeURIComponent(filename)}`)).catch(() => undefined);
      }
    }
  });

  test("sync replaces managed photo only when the sheet photo source changes", async ({ page }) => {
    const qaName = `Changed Sheet Photo QA ${Date.now()}`;
    const headers = integrationHeaders();
    const firstExternalPhotoUrl = `data:image/png;base64,${png1x1.toString("base64")}`;
    const secondExternalPhotoUrl = `data:image/png;base64,${Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACHxwTyAAAADElEQVR42mP8z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64",
    ).toString("base64")}`;
    let personId: number | null = null;
    let managedPhotoUrl: string | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const firstCsv = [
        "Name,Role/Position,Team,Photo,Status",
        `${qaName},Changed Sheet Photo QA,${departments[0].name},"${firstExternalPhotoUrl}",Active`,
      ].join("\n");
      const firstSyncRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(firstCsv)}` },
      });
      expect(firstSyncRes.ok()).toBeTruthy();

      let peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      let allPeople = await peopleRes.json();
      let person = allPeople.find((entry: { name: string }) => entry.name === qaName);
      personId = person?.id ?? null;
      expect(personId).toBeTruthy();

      const importRes = await page.request.post(appPath("/api/photos/import-external"), {
        headers,
        data: { personIds: [personId] },
      });
      expect(importRes.ok()).toBeTruthy();
      const importJson = await importRes.json();
      expect(importJson.summary.imported).toBe(1);

      peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      allPeople = await peopleRes.json();
      person = allPeople.find((entry: { name: string }) => entry.name === qaName);
      managedPhotoUrl = person.photoUrl;
      expect(managedPhotoUrl).toMatch(/^\/uploads\/photos\/.+\.webp$/);

      const samePhotoRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(firstCsv)}` },
      });
      expect(samePhotoRes.ok()).toBeTruthy();

      peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      allPeople = await peopleRes.json();
      person = allPeople.find((entry: { name: string }) => entry.name === qaName);
      expect(person.photoUrl).toBe(managedPhotoUrl);

      const changedCsv = [
        "Name,Role/Position,Team,Photo,Status",
        `${qaName},Changed Sheet Photo QA,${departments[0].name},"${secondExternalPhotoUrl}",Active`,
      ].join("\n");
      const changedSyncRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(changedCsv)}` },
      });
      expect(changedSyncRes.ok()).toBeTruthy();

      peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      allPeople = await peopleRes.json();
      person = allPeople.find((entry: { name: string }) => entry.name === qaName);
      expect(person.photoUrl).toBe(secondExternalPhotoUrl);
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`), { headers }).catch(() => undefined);
      }
      if (managedPhotoUrl) {
        const filename = managedPhotoUrl.split("/").pop();
        if (filename) await page.request.delete(appPath(`/api/photos/${encodeURIComponent(filename)}`), { headers }).catch(() => undefined);
      }
    }
  });

  test("sync preserves secondary reporting when the sheet omits the secondary column", async ({ page }) => {
    const managerName = `Secondary Manager QA ${Date.now()}`;
    const personName = `Secondary Preserve QA ${Date.now()}`;
    const headers = integrationHeaders();
    let managerId: number | null = null;
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const firstCsv = [
        "Name,Role/Position,Team,Status,Secondary Reports To",
        `${managerName},Secondary Manager QA,${departments[0].name},Active,`,
        `${personName},Secondary Preserve QA,${departments[0].name},Active,${managerName}`,
      ].join("\n");
      const firstSyncRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(firstCsv)}` },
      });
      expect(firstSyncRes.ok()).toBeTruthy();

      let peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      let allPeople = await peopleRes.json();
      const manager = allPeople.find((entry: { name: string }) => entry.name === managerName);
      let person = allPeople.find((entry: { name: string }) => entry.name === personName);
      managerId = manager?.id ?? null;
      personId = person?.id ?? null;
      expect(managerId).toBeTruthy();
      expect(personId).toBeTruthy();
      expect(JSON.parse(person.projectIds).secondaryReportsTo).toContain(managerId);

      const secondCsv = [
        "Name,Role/Position,Team,Status",
        `${managerName},Secondary Manager QA,${departments[0].name},Active`,
        `${personName},Secondary Preserve QA,${departments[0].name},Active`,
      ].join("\n");
      const secondSyncRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(secondCsv)}` },
      });
      expect(secondSyncRes.ok()).toBeTruthy();

      peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      allPeople = await peopleRes.json();
      person = allPeople.find((entry: { name: string }) => entry.name === personName);
      expect(JSON.parse(person.projectIds).secondaryReportsTo).toContain(managerId);
    } finally {
      if (personId) await page.request.delete(appPath(`/api/people/${personId}`), { headers }).catch(() => undefined);
      if (managerId) await page.request.delete(appPath(`/api/people/${managerId}`), { headers }).catch(() => undefined);
    }
  });

  test("sync maps technical team aliases to the existing technical department", async ({ page }) => {
    const qaName = `Tech Alias QA ${Date.now()}`;
    const headers = integrationHeaders();
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      const technicalDept = departments.find((department: { name: string }) => (
        ["tech", "technical"].includes(department.name.toLowerCase())
      ));
      expect(technicalDept).toBeTruthy();
      const sheetAlias = technicalDept.name.toLowerCase() === "tech" ? "Technical" : "Tech";

      const csv = [
        "Name,Role/Position,Team,Status",
        `${qaName},Tech Alias QA,${sheetAlias},Active`,
      ].join("\n");
      const syncRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
      });
      expect(syncRes.ok()).toBeTruthy();

      const peopleRes = await page.request.get(appPath("/api/people?includeInactive=true"), { headers });
      expect(peopleRes.ok()).toBeTruthy();
      const people = await peopleRes.json();
      const person = people.find((entry: { name: string }) => entry.name === qaName);
      personId = person?.id ?? null;
      expect(personId).toBeTruthy();
      expect(person.departmentName).toBe(technicalDept.name);

      const afterDepartmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      const afterDepartments = await afterDepartmentsRes.json();
      expect(afterDepartments.filter((department: { name: string }) => department.name === sheetAlias)).toHaveLength(0);
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`), { headers }).catch(() => undefined);
      }
    }
  });

  test("sync stores a visible review summary for the latest sheet changes", async ({ page }) => {
    const qaName = `Sync Review QA ${Date.now()}`;
    const headers = integrationHeaders();
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const createRes = await page.request.post(appPath("/api/people"), {
        headers,
        data: {
          name: qaName,
          title: "Sync Review QA",
          departmentId: departments[0].id,
          reportsTo: null,
          isActive: true,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const csv = [
        "Name,Role/Position,Team,Status",
        `${qaName},Sync Review QA Updated,${departments[0].name},Offboarded`,
      ].join("\n");
      const syncRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
      });
      expect(syncRes.ok()).toBeTruthy();

      const settingsRes = await page.request.get(appPath("/api/settings"), { headers });
      expect(settingsRes.ok()).toBeTruthy();
      const settings = await settingsRes.json();
      expect(settings.last_sync_summary).toBeTruthy();
      const review = JSON.parse(settings.last_sync_summary);
      expect(review.summary.total).toBe(1);
      expect(review.changes.status).toHaveLength(1);
      expect(review.changes.status[0]).toMatchObject({
        name: qaName,
        before: "Active",
        after: "Inactive",
      });

      await login(page, "admin", "admin123");
      await page.goto(appPath("/admin/settings"));
      await expect(page.getByText("Latest Sync Review")).toBeVisible();
      await expect(page.getByText("Status Changes")).toBeVisible();
      await expect(page.getByText(qaName).first()).toBeVisible();
      await expect(page.getByText("Active → Inactive")).toBeVisible();
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`), { headers }).catch(() => undefined);
      }
    }
  });

  test("sync dry run previews changes without mutating people or latest sync review", async ({ page }) => {
    const qaName = `Sync Dry Run QA ${Date.now()}`;
    const headers = integrationHeaders();
    let personId: number | null = null;

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"), { headers });
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const createRes = await page.request.post(appPath("/api/people"), {
        headers,
        data: {
          name: qaName,
          title: "Sync Dry Run QA",
          departmentId: departments[0].id,
          reportsTo: null,
          isActive: true,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const beforeSettingsRes = await page.request.get(appPath("/api/settings"), { headers });
      const beforeSettings = await beforeSettingsRes.json();
      const beforeSummary = beforeSettings.last_sync_summary ?? null;

      const csv = [
        "Name,Role/Position,Team,Status",
        `${qaName},Sync Dry Run QA Updated,${departments[0].name},Inactive`,
      ].join("\n");
      const previewRes = await page.request.post(appPath("/api/sync"), {
        headers,
        data: { dryRun: true, url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` },
      });
      expect(previewRes.ok()).toBeTruthy();
      const preview = await previewRes.json();
      expect(preview.dryRun).toBe(true);
      expect(preview.summary).toMatchObject({ created: 0, updated: 1, errors: 0, total: 1 });
      expect(preview.changes.status[0]).toMatchObject({
        name: qaName,
        before: "Active",
        after: "Inactive",
      });

      const personRes = await page.request.get(appPath(`/api/people/${personId}`), { headers });
      expect(personRes.ok()).toBeTruthy();
      const person = await personRes.json();
      expect(person.title).toBe("Sync Dry Run QA");
      expect(person.isActive).toBe(true);

      const afterSettingsRes = await page.request.get(appPath("/api/settings"), { headers });
      const afterSettings = await afterSettingsRes.json();
      expect(afterSettings.last_sync_summary ?? null).toBe(beforeSummary);

      await login(page, "admin", "admin123");
      await page.goto(appPath("/admin/settings"));
      await page.getByLabel(/Google Sheet (CSV URL|Source URL)/).fill(`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
      await page.getByRole("button", { name: "Preview Changes" }).click();
      await expect(page.getByText("Sync Preview")).toBeVisible();
      await expect(page.getByText("Preview only")).toBeVisible();
      await expect(page.getByText(qaName).first()).toBeVisible();
      await expect(page.getByText("Active → Inactive")).toBeVisible();
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`), { headers }).catch(() => undefined);
      }
    }
  });

  test("cleanup unused photos deletes only unassigned files", async ({ page }) => {
    const qaName = `Cleanup Photo QA ${Date.now()}`;
    let personId: number | null = null;
    let usedPhotoUrl: string | null = null;
    let unusedPhotoUrl: string | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      const uploadUsedRes = await page.request.post(appPath("/api/upload"), {
        multipart: {
          file: {
            name: `cleanup-used-${Date.now()}.png`,
            mimeType: "image/png",
            buffer: png1x1,
          },
        },
      });
      expect(uploadUsedRes.ok()).toBeTruthy();
      usedPhotoUrl = (await uploadUsedRes.json()).url;

      const uploadUnusedRes = await page.request.post(appPath("/api/upload"), {
        multipart: {
          file: {
            name: `cleanup-unused-${Date.now()}.png`,
            mimeType: "image/png",
            buffer: png1x1,
          },
        },
      });
      expect(uploadUnusedRes.ok()).toBeTruthy();
      unusedPhotoUrl = (await uploadUnusedRes.json()).url;

      const createRes = await page.request.post(appPath("/api/people"), {
        data: {
          name: qaName,
          title: "Cleanup Photo QA",
          departmentId: departments[0].id,
          reportsTo: null,
          photoUrl: usedPhotoUrl,
          displayOrder: 9999,
        },
      });
      expect(createRes.status()).toBe(201);
      personId = (await createRes.json()).id;

      const cleanupRes = await page.request.post(appPath("/api/photos/cleanup-unused"));
      expect(cleanupRes.ok()).toBeTruthy();
      const cleanup = await cleanupRes.json();
      expect(cleanup.deleted).toBeGreaterThanOrEqual(1);
      expect(cleanup.failed).toEqual([]);

      const photosRes = await page.request.get(appPath("/api/photos"));
      expect(photosRes.ok()).toBeTruthy();
      const photos = await photosRes.json();
      expect(photos.some((photo: { url: string; usedBy: { id: number } | null }) => (
        photo.url === usedPhotoUrl && photo.usedBy?.id === personId
      ))).toBeTruthy();
      expect(photos.some((photo: { url: string }) => photo.url === unusedPhotoUrl)).toBeFalsy();
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
      if (usedPhotoUrl) {
        const filename = usedPhotoUrl.split("/").pop();
        if (filename) await page.request.delete(appPath(`/api/photos/${encodeURIComponent(filename)}`)).catch(() => undefined);
      }
      if (unusedPhotoUrl) {
        const filename = unusedPhotoUrl.split("/").pop();
        if (filename) await page.request.delete(appPath(`/api/photos/${encodeURIComponent(filename)}`)).catch(() => undefined);
      }
    }
  });

  test("covers disposable CRUD, photos, chart views, export, print, audit, permissions, and mobile smoke", async ({ page, browser }) => {
    test.setTimeout(120_000);

    const qaName = `QA Smoke ${Date.now()}`;
    const qaEditedName = `${qaName} Edited`;
    let personId: number | null = null;
    let photoUrl: string | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get(appPath("/api/departments"));
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      await test.step("create, edit, and assign photo", async () => {
        const createRes = await page.request.post(appPath("/api/people"), {
          data: {
            name: qaName,
            title: "QA Analyst",
            departmentId: departments[0].id,
            reportsTo: null,
            displayOrder: 9999,
          },
        });
        expect(createRes.status()).toBe(201);
        personId = (await createRes.json()).id;

        const uploadRes = await page.request.post(appPath("/api/upload"), {
          multipart: {
            file: { name: "qa-avatar.png", mimeType: "image/png", buffer: png1x1 },
          },
        });
        expect(uploadRes.ok()).toBeTruthy();
        photoUrl = (await uploadRes.json()).url;
        expect(photoUrl).toMatch(/^\/uploads\/photos\/.+\.webp$/);

        const patchRes = await page.request.patch(appPath(`/api/people/${personId}`), {
          data: { name: qaEditedName, title: "QA Lead", photoUrl, isActive: true },
        });
        expect(patchRes.ok()).toBeTruthy();
      });

      await test.step("verify admin table and gallery display", async () => {
        await page.goto(appPath("/admin/team"));
        await page.getByPlaceholder("Search by name, title, or department...").fill(qaEditedName);
        const row = page.locator("tbody tr").filter({ hasText: qaEditedName });
        await expect(row).toBeVisible();
        await expect(row).toContainText("QA Lead");
        await expect(row.locator(`img[src="${assetPath(photoUrl!)}"]`).first()).toBeVisible();

        await page.goto(appPath("/admin/photos"));
        await expect(page.getByRole("heading", { name: "Photos", exact: true })).toBeVisible();
        await expect(page.locator("[data-slot='card']").filter({ hasText: qaEditedName })).toBeVisible();
      });

      await test.step("verify chart search and view modes", async () => {
        await page.goto(appPath("/chart"));
        await expect(page.getByText(qaEditedName).first()).toBeVisible({ timeout: 15_000 });
        await page.getByRole("button", { name: "Search people" }).click();
        await page.getByPlaceholder("Search by name or title...").fill(qaEditedName);
        await expect(page.getByRole("option", { name: new RegExp(qaEditedName) })).toBeVisible();
        await page.keyboard.press("Escape");

        for (const option of [/Horizontal Tree/, /Department Grid/]) {
          await page.getByLabel("Chart view").click();
          await page.getByRole("option", { name: option }).click();
          await expect(page.getByText(qaEditedName).first()).toBeVisible();
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
        await expect(page.getByText(qaEditedName).first()).toBeVisible();
      });

      await test.step("verify mobile layout smoke", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(appPath("/chart"));
        await expect(page.getByText(qaEditedName).first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("button", { name: "Search people" })).toBeVisible();

        await page.goto(appPath("/admin/photos"));
        await expect(page.getByRole("heading", { name: "Photos", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Upload Photo/i }).first()).toBeVisible();
      });

      await test.step("verify viewer cannot mutate editor resources", async () => {
        const viewerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
        const viewerPage = await viewerContext.newPage();
        await login(viewerPage, "viewer", "viewer123");

        await viewerPage.goto(appPath("/admin/photos"));
        await expect(viewerPage.getByRole("heading", { name: "Photos", exact: true })).not.toBeVisible();
        const forbiddenPatch = await viewerPage.request.patch(appPath(`/api/people/${personId}`), {
          data: { title: "Viewer Should Not Edit" },
        });
        expect(forbiddenPatch.status()).toBe(403);
        await viewerContext.close();
      });

      await test.step("delete disposable person and verify audit entries", async () => {
        const deleteRes = await page.request.delete(appPath(`/api/people/${personId}`));
        expect(deleteRes.ok()).toBeTruthy();
        personId = null;

        const auditRes = await page.request.get(appPath("/api/audit?limit=25"));
        expect(auditRes.ok()).toBeTruthy();
        const audit = await auditRes.json();
        const entries = audit.entries ?? audit;
        expect(entries.some((entry: { action: string; entityName: string | null }) => entry.action === "created" && entry.entityName === qaName)).toBeTruthy();
        expect(entries.some((entry: { action: string; entityName: string | null }) => entry.action === "updated" && entry.entityName === qaEditedName)).toBeTruthy();
        expect(entries.some((entry: { action: string; entityName: string | null }) => entry.action === "deleted" && entry.entityName === qaEditedName)).toBeTruthy();
      });
    } finally {
      if (personId) {
        await page.request.delete(appPath(`/api/people/${personId}`)).catch(() => undefined);
      }
      if (photoUrl) {
        const filename = photoUrl.split("/").pop();
        if (filename) await page.request.delete(appPath(`/api/photos/${encodeURIComponent(filename)}`)).catch(() => undefined);
      }
    }
  });
});
