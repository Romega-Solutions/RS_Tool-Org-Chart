import { test, expect, type Page } from "@playwright/test";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, username: string, password: string) {
  const res = await page.request.post("/api/auth/login", { data: { username, password } });
  expect(res.ok()).toBeTruthy();
  const token = res.headers()["set-cookie"]?.match(/orgchart_token=([^;]+)/)?.[1];
  expect(token).toBeTruthy();
  await page.context().addCookies([{ name: "orgchart_token", value: token!, domain: "localhost", path: "/" }]);
}

test.describe.serial("Product QA flow", () => {
  test("covers disposable CRUD, photos, chart views, export, print, audit, permissions, and mobile smoke", async ({ page, browser }) => {
    test.setTimeout(120_000);

    const qaName = `QA Smoke ${Date.now()}`;
    const qaEditedName = `${qaName} Edited`;
    let personId: number | null = null;
    let photoUrl: string | null = null;

    await login(page, "admin", "admin123");

    try {
      const departmentsRes = await page.request.get("/api/departments");
      expect(departmentsRes.ok()).toBeTruthy();
      const departments = await departmentsRes.json();
      expect(departments.length).toBeGreaterThan(0);

      await test.step("create, edit, and assign photo", async () => {
        const createRes = await page.request.post("/api/people", {
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

        const uploadRes = await page.request.post("/api/upload", {
          multipart: {
            file: { name: "qa-avatar.png", mimeType: "image/png", buffer: png1x1 },
          },
        });
        expect(uploadRes.ok()).toBeTruthy();
        photoUrl = (await uploadRes.json()).url;
        expect(photoUrl).toMatch(/^\/uploads\/photos\/.+\.webp$/);

        const patchRes = await page.request.patch(`/api/people/${personId}`, {
          data: { name: qaEditedName, title: "QA Lead", photoUrl, isActive: true },
        });
        expect(patchRes.ok()).toBeTruthy();
      });

      await test.step("verify admin table and gallery display", async () => {
        await page.goto("/admin/team");
        await page.getByPlaceholder("Search by name, title, or department...").fill(qaEditedName);
        const row = page.locator("tbody tr").filter({ hasText: qaEditedName });
        await expect(row).toBeVisible();
        await expect(row).toContainText("QA Lead");
        await expect(row.locator(`img[src="${photoUrl}"]`).first()).toBeVisible();

        await page.goto("/admin/photos");
        await expect(page.getByRole("heading", { name: "Photos", exact: true })).toBeVisible();
        await expect(page.locator("[data-slot='card']").filter({ hasText: qaEditedName })).toBeVisible();
      });

      await test.step("verify chart search and view modes", async () => {
        await page.goto("/chart");
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
        await page.goto("/chart");
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

        await page.goto("/chart/print");
        await expect(page.getByText("Print-ready org chart")).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(qaEditedName).first()).toBeVisible();
      });

      await test.step("verify mobile layout smoke", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/chart");
        await expect(page.getByText(qaEditedName).first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("button", { name: "Search people" })).toBeVisible();

        await page.goto("/admin/photos");
        await expect(page.getByRole("heading", { name: "Photos", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Upload Photo/i }).first()).toBeVisible();
      });

      await test.step("verify viewer cannot mutate editor resources", async () => {
        const viewerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
        const viewerPage = await viewerContext.newPage();
        await login(viewerPage, "viewer", "viewer123");

        await viewerPage.goto("/admin/photos");
        await expect(viewerPage.getByRole("heading", { name: "Photos", exact: true })).not.toBeVisible();
        const forbiddenPatch = await viewerPage.request.patch(`/api/people/${personId}`, {
          data: { title: "Viewer Should Not Edit" },
        });
        expect(forbiddenPatch.status()).toBe(403);
        await viewerContext.close();
      });

      await test.step("delete disposable person and verify audit entries", async () => {
        const deleteRes = await page.request.delete(`/api/people/${personId}`);
        expect(deleteRes.ok()).toBeTruthy();
        personId = null;

        const auditRes = await page.request.get("/api/audit?limit=25");
        expect(auditRes.ok()).toBeTruthy();
        const audit = await auditRes.json();
        const entries = audit.entries ?? audit;
        expect(entries.some((entry: { action: string; entityName: string | null }) => entry.action === "created" && entry.entityName === qaName)).toBeTruthy();
        expect(entries.some((entry: { action: string; entityName: string | null }) => entry.action === "updated" && entry.entityName === qaEditedName)).toBeTruthy();
        expect(entries.some((entry: { action: string; entityName: string | null }) => entry.action === "deleted" && entry.entityName === qaEditedName)).toBeTruthy();
      });
    } finally {
      if (personId) {
        await page.request.delete(`/api/people/${personId}`).catch(() => undefined);
      }
      if (photoUrl) {
        const filename = photoUrl.split("/").pop();
        if (filename) await page.request.delete(`/api/photos/${encodeURIComponent(filename)}`).catch(() => undefined);
      }
    }
  });
});
