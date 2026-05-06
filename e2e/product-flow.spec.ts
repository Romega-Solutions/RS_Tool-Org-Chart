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

test.describe.serial("Product QA flow", () => {
  test("base path root redirects to chart without duplicating the app prefix", async ({ page }) => {
    await page.goto(appPath("/"));

    await expect(page).toHaveURL(/\/org-chart\/login\?next=%2Fchart$/);
    expect(page.url()).not.toContain("/org-chart/org-chart/");
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
