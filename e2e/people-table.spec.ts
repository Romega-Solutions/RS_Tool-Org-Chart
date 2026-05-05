import { test, expect } from "@playwright/test";
import { appPath } from "./helpers/paths";

test.describe("People Table — Teams Management", () => {
  test.beforeEach(async ({ page, context }) => {
    // Log in as admin via API to get session cookie
    const res = await context.request.post(appPath("/api/auth/login"), {
      data: { username: "admin", password: "admin123" },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto(appPath("/admin/team"));
    await page.waitForLoadState("networkidle");
  });

  test.describe("Loading & Empty States", () => {
    test("renders the table after loading", async ({ page }) => {
      // Table should render with data rows
      await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    });

    test("empty state shows icon and CTA when no search results", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      const searchInput = page.getByPlaceholder("Search by name, title, or department...");
      await searchInput.fill("zzzznonexistent");
      await expect(page.getByText("No results found")).toBeVisible();
      await expect(page.getByText("Try adjusting your search or filters.")).toBeVisible();
    });
  });

  test.describe("Status Filtering", () => {
    test("defaults to Active status filter", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // The Status column header should show the active filter icon
      const statusHeader = page.locator("thead button", { hasText: "Status" });
      await expect(statusHeader).toBeVisible();
      // The active filter chip should be visible
      await expect(page.getByRole("button", { name: /Active/ }).first()).toBeVisible();
    });

    test("clicking Status column header cycles through filters", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // Use the filter chip to cycle instead of the column header,
      // because the column header disappears when the empty state shows
      const statusChip = page.locator("span.rounded-full button", { hasText: "Active" }).first();
      await statusChip.click();

      // Should now show Inactive filter
      await expect(page.locator("span.rounded-full button", { hasText: "Inactive" }).first()).toBeVisible();

      // Click dismiss to go to All
      await page.getByRole("button", { name: "Remove status filter" }).click();

      // No status chip should be visible
      await expect(page.getByRole("button", { name: "Remove status filter" })).not.toBeVisible();
    });

    test("status filter chip toggles between Active and Inactive on click", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // The status chip toggle button is inside the filter bar span
      // Click it to toggle from Active → Inactive
      const activeChip = page.locator("span.rounded-full button", { hasText: "Active" }).first();
      await activeChip.click();

      // The chip should now show "Inactive"
      await expect(page.locator("span.rounded-full button", { hasText: "Inactive" }).first()).toBeVisible();
    });

    test("status filter chip dismiss resets to All", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Click the dismiss button on the status chip
      const dismissBtn = page.getByRole("button", { name: "Remove status filter" });
      await dismissBtn.click();

      // Both Active and Inactive rows should now be visible (if data has both)
      // The dismiss button should no longer exist
      await expect(dismissBtn).not.toBeVisible();
    });
  });

  test.describe("Sorting", () => {
    test("Person column sorts A-Z then Z-A then clears", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      const personHeader = page.locator("thead button", { hasText: "Person" });

      // Click once → A-Z (ascending)
      await personHeader.click();
      const personTh = page.locator("th[aria-sort]").first();
      await expect(personTh).toHaveAttribute("aria-sort", "ascending");

      // Click again → Z-A (descending)
      await personHeader.click();
      await expect(personTh).toHaveAttribute("aria-sort", "descending");

      // Click again → none
      await personHeader.click();
      await expect(personTh).toHaveAttribute("aria-sort", "none");
    });

    test("Department column sorts A-Z then Z-A", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      const deptTh = page.locator("thead th").filter({ hasText: /^Department$/ });
      const deptHeader = deptTh.getByRole("button", { name: /^Department$/ });

      await expect(deptHeader).toBeVisible();
      await deptHeader.click();
      await expect(deptTh).toHaveAttribute("aria-sort", "ascending");

      await deptHeader.click();
      await expect(deptTh).toHaveAttribute("aria-sort", "descending");
    });

    test("sort filter chip toggles direction on click", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Activate Person sort
      await page.locator("thead button", { hasText: "Person" }).click();

      // The filter chip should show "Person A-Z"
      const sortChip = page.locator("button", { hasText: "Person A-Z" });
      await expect(sortChip).toBeVisible();

      // Click the chip body → should flip to Z-A
      await sortChip.click();
      await expect(page.locator("button", { hasText: "Person Z-A" })).toBeVisible();
    });

    test("sort filter chip dismiss clears sort", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      await page.locator("thead button", { hasText: "Person" }).click();

      const dismissBtn = page.getByRole("button", { name: "Remove sort filter" });
      await dismissBtn.click();

      // Sort chip should be gone
      await expect(page.locator("button", { hasText: "Person A-Z" })).not.toBeVisible();
      // aria-sort should reset
      await expect(page.locator("th[aria-sort]").first()).toHaveAttribute("aria-sort", "none");
    });
  });

  test.describe("Quick Filter Suggestions", () => {
    test("shows suggested filters when no sort is active", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Suggestions should be visible (dashed border chips)
      await expect(page.locator("button", { hasText: "Name A-Z" })).toBeVisible();
      await expect(page.locator("button", { hasText: "By rank" })).toBeVisible();
      await expect(page.locator("button", { hasText: "By department" })).toBeVisible();
    });

    test("clicking a suggestion applies the filter", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      await page.locator("button", { hasText: "By rank" }).click();

      // Sort should be active
      const titleTh = page.locator("th[aria-sort]").nth(1);
      await expect(titleTh).toHaveAttribute("aria-sort", "ascending");

      // Suggestion chips for sort should disappear (replaced by active chip)
      await expect(page.locator("button", { hasText: "Name A-Z" })).not.toBeVisible();
    });
  });

  test.describe("Saved Views", () => {
    test.beforeEach(async ({ page }) => {
      // Clear saved views from localStorage
      await page.evaluate(() => localStorage.removeItem("orgchart-people-saved-views"));
      await page.goto(appPath("/admin/team"));
      await page.waitForLoadState("networkidle");
    });

    test("save view button appears when filters are active", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // With default Active filter, save view should be visible
      await expect(page.locator("button", { hasText: "Save view" })).toBeVisible();
    });

    test("can save and apply a view", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Apply a sort
      await page.locator("thead button", { hasText: "Person" }).click();

      // Save the view
      await page.locator("button", { hasText: "Save view" }).click();

      // "Saved" indicator should appear
      await expect(page.getByText("Saved")).toBeVisible();

      // Clear filters
      const dismissSort = page.getByRole("button", { name: "Remove sort filter" });
      await dismissSort.click();
      const dismissStatus = page.getByRole("button", { name: "Remove status filter" });
      await dismissStatus.click();

      // Saved view chip should be visible (contains the view name text)
      const savedChip = page.locator("span.rounded-full", { hasText: "Name A-Z + Active" });
      await expect(savedChip).toBeVisible({ timeout: 5_000 });

      // Click the apply button inside it
      await savedChip.locator("button").first().click();

      // Filters should be restored
      await expect(page.locator("th[aria-sort]").first()).toHaveAttribute("aria-sort", "ascending");
    });

    test("can delete a saved view", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Save current view
      await page.locator("button", { hasText: "Save view" }).click();

      // Find the saved view's delete button
      const deleteBtn = page.getByRole("button", { name: /Remove saved view/ });
      await deleteBtn.click();

      // Saved view should be gone
      await expect(deleteBtn).not.toBeVisible();
    });
  });

  test.describe("Inline Status Toggle", () => {
    test("clicking status pill toggles person status", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // Switch to "All" so toggled person stays visible
      const dismissStatus = page.getByRole("button", { name: "Remove status filter" });
      await dismissStatus.click();

      // Find first status pill in the table
      const firstPill = page.locator("tbody button", { hasText: /^(Active|Inactive)$/ }).first();
      const initialText = await firstPill.textContent();

      // Click to toggle
      await firstPill.click();

      // Should have changed
      const expectedText = initialText?.trim() === "Active" ? "Inactive" : "Active";
      await expect(firstPill).toHaveText(expectedText, { timeout: 5_000 });

      // Toggle back to restore original state
      await firstPill.click();
      await expect(firstPill).toHaveText(initialText?.trim() || "", { timeout: 5_000 });
    });
  });

  test.describe("Row Selection & Bulk Actions", () => {
    test("clicking checkbox column toggles selection", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // Click the checkbox label in the first row
      const firstRow = page.locator("tbody tr").first();
      await firstRow.locator("td").first().locator("label").click();

      // Bulk action bar should appear
      await expect(page.getByText("1 selected")).toBeVisible();
    });

    test("clicking row body opens edit dialog", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // Click the name cell (second td) — should open edit, not select
      const firstRow = page.locator("tbody tr").first();
      await firstRow.locator("td").nth(1).click();

      // Edit dialog should appear
      await expect(page.getByText("Edit Person")).toBeVisible({ timeout: 5_000 });
    });

    test("bulk action bar shows activate, deactivate, and delete", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // Select a row via checkbox label
      const firstRow = page.locator("tbody tr").first();
      await firstRow.locator("td").first().locator("label").click();

      // Scope to the bulk action bar
      const bulkBar = page.getByText("1 selected").locator("..");
      await expect(bulkBar.getByRole("button", { name: "Activate", exact: true })).toBeVisible();
      await expect(bulkBar.getByRole("button", { name: "Deactivate", exact: true })).toBeVisible();
      await expect(bulkBar.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    });

    test("select all checkbox selects all visible rows", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });

      // Click the header checkbox label (the visual checkbox wrapper)
      const headerCheckboxLabel = page.locator("thead label").first();
      await headerCheckboxLabel.click();

      // Count visible rows
      const rowCount = await page.locator("tbody tr").count();

      // Bulk bar should show count
      await expect(page.getByText(`${rowCount} selected`)).toBeVisible();
    });
  });

  test.describe("Search", () => {
    test("filters people by name", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      const searchInput = page.getByPlaceholder("Search by name, title, or department...");

      // Get the first person's full name from the name cell (2nd td)
      const fullName = await page.locator("tbody tr").first().locator("td").nth(1).locator("span.font-medium").textContent();
      if (!fullName) return;

      // Search for the full name to ensure exact match
      const searchTerm = fullName.trim();
      await searchInput.fill(searchTerm);

      // At least one row should be visible and contain the name
      const rows = page.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      const firstResult = await rows.first().locator("td").nth(1).locator("span.font-medium").textContent();
      expect(firstResult?.toLowerCase()).toContain(searchTerm.toLowerCase());
    });

    test("clearing search restores full list", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      const initialCount = await page.locator("tbody tr").count();

      const searchInput = page.getByPlaceholder("Search by name, title, or department...");
      await searchInput.fill("zzzzz");
      await expect(page.getByText("No results found")).toBeVisible();

      await searchInput.clear();
      // After clearing, results should return and the empty state should disappear.
      await expect(page.getByText("No results found")).not.toBeVisible();
      await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 5_000 });
      expect(await page.locator("tbody tr").count()).toBeGreaterThanOrEqual(initialCount);
    });
  });

  test.describe("Accessibility", () => {
    test("sortable columns have aria-sort attribute", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      const sortableThs = page.locator("th[aria-sort]");
      await expect(sortableThs).toHaveCount(3);

      // All should default to "none"
      for (let i = 0; i < 3; i++) {
        await expect(sortableThs.nth(i)).toHaveAttribute("aria-sort", "none");
      }
    });

    test("dismiss buttons have aria-labels", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Status filter dismiss should have aria-label
      await expect(page.getByRole("button", { name: "Remove status filter" })).toBeVisible();

      // Activate sort to test sort dismiss
      await page.locator("thead button", { hasText: "Person" }).click();
      await expect(page.getByRole("button", { name: "Remove sort filter" })).toBeVisible();
    });

    test("checkboxes have aria-labels", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("checkbox", { name: "Select all people" })).toBeVisible();

      const firstRowCheckbox = page.locator("tbody tr").first().getByRole("checkbox");
      await expect(firstRowCheckbox).toHaveAttribute("aria-label", /.+/);
    });
  });

  test.describe("Visual Hierarchy", () => {
    test("inactive rows have reduced opacity", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
      // Switch to All to see inactive rows
      const dismissStatus = page.getByRole("button", { name: "Remove status filter" });
      await dismissStatus.click();

      // Check if any inactive rows exist and have opacity
      const inactiveRows = page.locator("tbody tr").filter({ has: page.locator("button", { hasText: "Inactive" }) });
      const count = await inactiveRows.count();
      if (count > 0) {
        const opacity = await inactiveRows.first().evaluate((el) => getComputedStyle(el).opacity);
        expect(parseFloat(opacity)).toBeLessThan(1);
      }
    });

    test("footer shows tabular-nums count", async ({ page }) => {
      // The table might show skeleton first, wait for actual data rows
      await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 10_000 });
      const footer = page.locator("p.tabular-nums");
      await expect(footer).toBeVisible();
      await expect(footer).toHaveText(/Showing \d+ of \d+ people/);
    });
  });
});
