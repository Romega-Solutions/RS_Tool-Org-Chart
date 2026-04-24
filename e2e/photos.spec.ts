import { test, expect } from "@playwright/test";

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
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    if (photoList.length === 0) {
      test.skip();
      return;
    }

    const firstCard = page.locator("[data-slot='card']").first();
    await firstCard.hover();
    const deleteBtn = firstCard.getByRole("button", { name: /Delete/i });
    await deleteBtn.click();

    await expect(page.getByText("Delete photo?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  });
});

test.describe("Assign photo from gallery", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEditor(page);
    await page.goto("/admin/photos");
  });

  test("unused photo card shows Assign button on hover", async ({ page }) => {
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    const unusedPhoto = photoList.find((p: PhotoEntry) => !p.usedBy);
    if (!unusedPhoto) {
      test.skip();
      return;
    }

    const unusedCard = page.locator("[data-slot='card']").filter({ hasText: "Unused" }).first();
    await unusedCard.hover();
    await expect(unusedCard.getByRole("button", { name: /Assign/i })).toBeVisible();
  });

  test("Assign button opens person picker dialog", async ({ page }) => {
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    const unusedPhoto = photoList.find((p: PhotoEntry) => !p.usedBy);
    if (!unusedPhoto) {
      test.skip();
      return;
    }

    const unusedCard = page.locator("[data-slot='card']").filter({ hasText: "Unused" }).first();
    await unusedCard.hover();
    await unusedCard.getByRole("button", { name: /Assign/i }).click();

    await expect(page.getByRole("heading", { name: "Assign Photo" })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by name/i)).toBeVisible();
  });

  test("person picker dialog has searchable list", async ({ page }) => {
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    const unusedPhoto = photoList.find((p: PhotoEntry) => !p.usedBy);
    if (!unusedPhoto) {
      test.skip();
      return;
    }

    const unusedCard = page.locator("[data-slot='card']").filter({ hasText: "Unused" }).first();
    await unusedCard.hover();
    await unusedCard.getByRole("button", { name: /Assign/i }).click();

    await expect(page.getByRole("heading", { name: "Assign Photo" })).toBeVisible();

    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill("zzzznonexistent");
    await expect(page.getByText("No matching team members found.")).toBeVisible();

    await searchInput.clear();
    const personButtons = page.locator("[role='dialog'] button[type='button']").filter({ hasNotText: /close/i });
    await expect(personButtons.first()).toBeVisible();
  });

  test("assigned photo card does not show Assign button", async ({ page }) => {
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    const assignedPhoto = photoList.find((p: PhotoEntry) => p.usedBy);
    if (!assignedPhoto) {
      test.skip();
      return;
    }

    const assignedCard = page.locator("[data-slot='card']").filter({ hasText: assignedPhoto.usedBy.name }).first();
    await assignedCard.hover();
    await expect(assignedCard.getByRole("button", { name: /Delete/i })).toBeVisible();
    await expect(assignedCard.getByRole("button", { name: /Assign/i })).not.toBeVisible();
  });
});

type PhotoEntry = { filename: string; url: string; usedBy: { id: number; name: string } | null };

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
