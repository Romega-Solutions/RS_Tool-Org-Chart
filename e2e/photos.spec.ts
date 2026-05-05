import { test, expect } from "@playwright/test";

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

// Helper: login via API and inject cookie into browser context
async function loginAsEditor(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status()}): ${body}`);
  }
  // Extract Set-Cookie and inject into browser context
  const setCookie = res.headers()["set-cookie"];
  if (setCookie) {
    const match = setCookie.match(/orgchart_token=([^;]+)/);
    if (match) {
      await page.context().addCookies([{
        name: "orgchart_token",
        value: match[1],
        domain: "localhost",
        path: "/",
      }]);
    }
  }
}

async function loginAsViewer(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { username: "viewer", password: "viewer123" },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Viewer login failed (${res.status()}): ${body}`);
  }
  const setCookie = res.headers()["set-cookie"];
  if (setCookie) {
    const match = setCookie.match(/orgchart_token=([^;]+)/);
    if (match) {
      await page.context().addCookies([{
        name: "orgchart_token",
        value: match[1],
        domain: "localhost",
        path: "/",
      }]);
    }
  }
}

async function uploadQaPhoto(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/upload", {
    multipart: {
      file: {
        name: `qa-gallery-${Date.now()}.png`,
        mimeType: "image/png",
        buffer: png1x1,
      },
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.url as string;
}

async function createQaPerson(page: import("@playwright/test").Page, photoUrl?: string | null) {
  const departmentsRes = await page.request.get("/api/departments");
  expect(departmentsRes.ok()).toBeTruthy();
  const departments = await departmentsRes.json();
  expect(departments.length).toBeGreaterThan(0);

  const name = `QA Gallery ${Date.now()}`;
  const createRes = await page.request.post("/api/people", {
    data: {
      name,
      title: "QA Gallery Tester",
      departmentId: departments[0].id,
      reportsTo: null,
      photoUrl: photoUrl ?? null,
      displayOrder: 9999,
    },
  });
  expect(createRes.status()).toBe(201);
  const person = await createRes.json();
  return { id: person.id as number, name };
}

async function deleteQaPhoto(page: import("@playwright/test").Page, photoUrl: string | null) {
  const filename = photoUrl?.split("/").pop();
  if (filename) {
    await page.request.delete(`/api/photos/${encodeURIComponent(filename)}`).catch(() => undefined);
  }
}

// --- API Tests ---

test.describe("GET /api/photos", () => {
  test("returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/photos");
    expect(res.status()).toBe(401);
  });

  test("returns JSON array when authenticated", async ({ page }) => {
    await loginAsEditor(page);
    const res = await page.request.get("/api/photos");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("each photo entry has filename, url, and usedBy fields", async ({ page }) => {
    await loginAsEditor(page);
    const res = await page.request.get("/api/photos");
    const photos = await res.json();
    for (const photo of photos) {
      expect(photo).toHaveProperty("filename");
      expect(photo).toHaveProperty("url");
      expect(photo).toHaveProperty("usedBy");
      expect(photo.url).toContain("/uploads/photos/");
    }
  });
});

test.describe("DELETE /api/photos/[filename]", () => {
  test("rejects path traversal", async ({ page }) => {
    await loginAsEditor(page);
    const res = await page.request.delete("/api/photos/..%2F..%2Fetc%2Fpasswd");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid filename");
  });

  test("returns 404 for non-existent file", async ({ page }) => {
    await loginAsEditor(page);
    const res = await page.request.delete("/api/photos/nonexistent-file-12345.jpg");
    expect(res.status()).toBe(404);
  });

  test("returns 401 without auth", async ({ request }) => {
    const res = await request.delete("/api/photos/test.jpg");
    expect(res.status()).toBe(401);
  });
});

// --- UI Tests ---

test.describe("Photos page — Editor", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEditor(page);
    await page.goto("/admin/photos");
  });

  test("renders page heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Photos", exact: true, level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Manage uploaded profile photos.")).toBeVisible();
  });

  test("shows Refresh and Upload Photo buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload Photo/i }).first()).toBeVisible();
  });

  test("displays stats bar after loading", async ({ page }) => {
    await expect(page.getByText("Total Photos")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^Assigned$/ })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^Unused$/ })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^Missing$/ })).toBeVisible();
    await expect(page.getByText("Photo coverage")).toBeVisible();
  });

  test("Missing stat card opens dialog with team members", async ({ page }) => {
    const missingCard = page.locator("button").filter({ hasText: /^Missing/ });
    await expect(missingCard).toBeVisible();
    await missingCard.click();

    await expect(page.getByRole("heading", { name: /Missing Photos/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by name/i)).toBeVisible();
    await expect(
      page.getByText("Click any person to upload and assign")
    ).toBeVisible();
  });

  test("Refresh button triggers reload", async ({ page }) => {
    await expect(page.getByText("Total Photos")).toBeVisible();
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await refreshBtn.click();
    await expect(page.getByText("Total Photos")).toBeVisible();
  });

  test("delete button opens confirm dialog on photo card hover", async ({ page }) => {
    const uploadedPhotoUrl = await uploadQaPhoto(page);
    await page.goto("/admin/photos");

    const uploadedCard = page.locator("[data-slot='card']").filter({ hasText: uploadedPhotoUrl.split("/").pop()! });
    await uploadedCard.hover();
    const deleteBtn = uploadedCard.getByRole("button", { name: /Delete/i });
    await deleteBtn.click();

    await expect(page.getByText("Delete photo?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

    await page.keyboard.press("Escape");
    await deleteQaPhoto(page, uploadedPhotoUrl);
  });
});

test.describe("Assign photo from gallery", () => {
  let personId: number | null = null;
  let photoUrl: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsEditor(page);
  });

  test.afterEach(async ({ page }) => {
    if (personId) {
      await page.request.delete(`/api/people/${personId}`).catch(() => undefined);
      personId = null;
    }
    await deleteQaPhoto(page, photoUrl);
    photoUrl = null;
  });

  test("unused photo card shows Assign button on hover", async ({ page }) => {
    photoUrl = await uploadQaPhoto(page);
    await page.goto("/admin/photos");

    const unusedCard = page.locator("[data-slot='card']").filter({ hasText: photoUrl.split("/").pop()! });
    await unusedCard.hover();
    await expect(unusedCard.getByRole("button", { name: /Assign/i })).toBeVisible();
  });

  test("Assign button opens person picker dialog", async ({ page }) => {
    photoUrl = await uploadQaPhoto(page);
    const person = await createQaPerson(page);
    personId = person.id;
    await page.goto("/admin/photos");

    const unusedCard = page.locator("[data-slot='card']").filter({ hasText: photoUrl.split("/").pop()! });
    await unusedCard.hover();
    await unusedCard.getByRole("button", { name: /Assign/i }).click();

    await expect(page.getByRole("heading", { name: "Assign Photo" })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(person.name) })).toBeVisible();
  });

  test("person picker dialog has searchable list", async ({ page }) => {
    photoUrl = await uploadQaPhoto(page);
    const person = await createQaPerson(page);
    personId = person.id;
    await page.goto("/admin/photos");

    const unusedCard = page.locator("[data-slot='card']").filter({ hasText: photoUrl.split("/").pop()! });
    await unusedCard.hover();
    await unusedCard.getByRole("button", { name: /Assign/i }).click();

    await expect(page.getByRole("heading", { name: "Assign Photo" })).toBeVisible();

    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill("zzzznonexistent");
    await expect(page.getByText("No matching team members found.")).toBeVisible();

    await searchInput.clear();
    await searchInput.fill(person.name);
    await expect(page.getByRole("button", { name: new RegExp(person.name) })).toBeVisible();
  });

  test("assigned photo card does not show Assign button", async ({ page }) => {
    photoUrl = await uploadQaPhoto(page);
    const person = await createQaPerson(page, photoUrl);
    personId = person.id;
    await page.goto("/admin/photos");

    const assignedCard = page.locator("[data-slot='card']").filter({ hasText: person.name }).first();
    await assignedCard.hover();
    await expect(assignedCard.getByRole("button", { name: /Delete/i })).toBeVisible();
    await expect(assignedCard.getByRole("button", { name: /Assign/i })).not.toBeVisible();
  });
});

test.describe("Photos page — Viewer", () => {
  test("viewer is blocked from /admin/photos (requireEditor)", async ({ page }) => {
    await loginAsViewer(page);
    await page.goto("/admin/photos");
    await expect(
      page.getByRole("heading", { name: "Photos", exact: true, level: 1 })
    ).not.toBeVisible();
  });
});

test.describe("Sidebar navigation", () => {
  test("Photos link is visible in admin sidebar", async ({ page }) => {
    await loginAsEditor(page);
    await page.goto("/admin");
    const photosLink = page.getByRole("link", { name: "Photos" });
    await expect(photosLink).toBeVisible();
  });

  test("Photos link navigates to /admin/photos", async ({ page }) => {
    await loginAsEditor(page);
    await page.goto("/admin");
    await page.getByRole("link", { name: "Photos" }).click();
    await expect(page).toHaveURL(/\/admin\/photos/);
  });
});
