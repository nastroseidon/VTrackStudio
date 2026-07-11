import { expect, test } from "./fixtures";

test("renders the CourseForge application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "CourseForge", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Search provider courses")).toBeVisible();
  await expect(page.getByLabel("Map editing workspace")).toBeVisible();
});

test("searches and imports deterministic mock provider data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByLabel("Provider search results")
    .getByRole("button", { name: /Cherry Hill Golf Club/ })
    .click();

  await expect(page.getByLabel("Selected imported course details")).toContainText("18");
  await page.getByRole("button", { name: "Use Imported Course" }).click();
  await expect(page.getByLabel("Selected course summary")).toContainText("Provider import");
  await expect(page.getByRole("button", { name: "Confirm Location" })).toBeVisible();
});
