import { test, expect } from "@playwright/test";

// Helper: login as editor via API and set cookie
async function loginAsEditor(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  expect(res.ok()).toBeTruthy();
}

async function loginAsViewer(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { username: "viewer", password: "viewer123" },
  });
  expect(res.ok()).toBeTruthy();
}

// --- API Tests ---

test.describe("GET /api/photos", () => {
  test("returns JSON array", async ({ request }) => {
    const res = await request.get("/api/photos");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("each photo entry has filename, url, and usedBy fields", async ({ request }) => {
    const res = await request.get("/api/photos");
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
  test("rejects path traversal", async ({ request }) => {
    const res = await request.delete("/api/photos/..%2F..%2Fetc%2Fpasswd");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid filename");
  });

  test("returns 404 for non-existent file", async ({ page, request }) => {
    await loginAsEditor(page);
    const res = await request.delete("/api/photos/nonexistent-file-12345.jpg");
    expect(res.status()).toBe(404);
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
    await expect(page.getByRole("button", { name: /Upload Photo/i })).toBeVisible();
  });

  test("displays stats bar after loading", async ({ page }) => {
    await expect(page.getByText("Total Photos")).toBeVisible();
    // Use exact match to avoid collision with "Assigned" badge on photo cards
    await expect(page.locator("p").filter({ hasText: /^Assigned$/ })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^Unused$/ })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^Missing$/ })).toBeVisible();
    await expect(page.getByText("Photo coverage")).toBeVisible();
  });

  test("shows Missing Photos panel when team members lack photos", async ({ page }) => {
    const panel = page.getByRole("button", { name: /Missing Photos/i });
    await expect(panel).toBeVisible();
    // Expand the panel
    await panel.click();
    // Should show the helper text after expanding
    await expect(
      page.getByText("Click any card to upload and assign")
    ).toBeVisible();
  });

  test("Missing Photos panel collapses and expands", async ({ page }) => {
    const panelToggle = page.getByRole("button", { name: /Missing Photos/i });
    await expect(panelToggle).toBeVisible();

    // Expand
    await panelToggle.click();
    await expect(panelToggle).toHaveAttribute("aria-expanded", "true");

    // Collapse
    await panelToggle.click();
    await expect(panelToggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Refresh button triggers reload", async ({ page }) => {
    // Wait for initial load to complete
    await expect(page.getByText("Total Photos")).toBeVisible();
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await refreshBtn.click();
    // After refresh, stats should still be visible
    await expect(page.getByText("Total Photos")).toBeVisible();
  });

  test("delete button opens confirm dialog on photo card hover", async ({ page }) => {
    // Check if there are any photos
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    if (photoList.length === 0) {
      test.skip();
      return;
    }

    // Hover over first photo card to reveal delete button
    const firstCard = page.locator("[data-slot='card']").first();
    await firstCard.hover();
    const deleteBtn = firstCard.getByRole("button", { name: /Delete/i });
    await deleteBtn.click();

    // Confirm dialog should appear
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
    // Find an unused photo
    const photos = await page.request.get("/api/photos");
    const photoList = await photos.json();
    const unusedPhoto = photoList.find((p: PhotoEntry) => !p.usedBy);
    if (!unusedPhoto) {
      test.skip();
      return;
    }

    // Hover over the unused card (find by the "Unused" badge)
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

    // Dialog should open with heading and search
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

    // Should show people without photos
    await expect(page.getByRole("heading", { name: "Assign Photo" })).toBeVisible();

    // Type a search query — should filter the list
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill("zzzznonexistent");
    await expect(page.getByText("No matching team members found.")).toBeVisible();

    // Clear search — list should return
    await searchInput.clear();
    // Should have at least one person button in the dialog
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

    // Find card by person name badge
    const assignedCard = page.locator("[data-slot='card']").filter({ hasText: assignedPhoto.usedBy.name }).first();
    await assignedCard.hover();
    // Should show Delete but NOT Assign
    await expect(assignedCard.getByRole("button", { name: /Delete/i })).toBeVisible();
    await expect(assignedCard.getByRole("button", { name: /Assign/i })).not.toBeVisible();
  });
});

type PhotoEntry = { filename: string; url: string; usedBy: { id: number; name: string } | null };

test.describe("Photos page — Viewer", () => {
  test("viewer is blocked from /admin/photos (requireEditor)", async ({ page }) => {
    await loginAsViewer(page);
    await page.goto("/admin/photos");
    // Admin layout has requireEditor — viewer should not see the photos page
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
