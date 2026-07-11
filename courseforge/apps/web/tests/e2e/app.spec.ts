import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function openHoleTracingPanel(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Active Course Cherry Hill Golf Club · Location needs verification" }).click();
  await page.getByRole("button", { name: "Use Selected Demo Course" }).click();
  await page.getByRole("button", { name: "Confirm Location" }).click();
  await page.getByRole("button", { name: "Auto Boundary" }).click();
  await page.getByRole("button", { name: "Open Satellite Auto-Builder" }).click();
  await page.getByRole("button", { name: "Generate Draft Hole Plan" }).click();
  await expect(page.getByLabel("Hole tracing tools")).toBeVisible();
}

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

test("keeps the hole tracing panel within the desktop viewport", async ({ page }) => {
  await openHoleTracingPanel(page);

  const layout = await page.getByLabel("Hole tracing tools").evaluate((panel) => {
    const rect = (selector: string) => panel.querySelector(selector)?.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const title = rect(".focused-tray-header .section-label");
    const chooser = rect(".focused-tray-header .tray-status");
    const toolbar = rect(".trace-progress-line");
    const summary = rect(".trace-summary-section");
    const workspace = rect(".trace-workspace-section");
    const progress = rect(".trace-progress-section");
    const geometryHeading = document.querySelector<HTMLElement>(
      '[aria-label="Geometry preview status"] .rail-card-heading span'
    );
    const headingStyle = geometryHeading ? getComputedStyle(geometryHeading) : null;
    const statusRail = document.querySelector<HTMLElement>('[aria-label="Project actions"]');
    const centerY = (box: DOMRect | undefined) => box ? box.top + box.height / 2 : -1;

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentSize: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      },
      panel: {
        left: panelRect.left,
        right: panelRect.right,
        bottom: panelRect.bottom,
        scrollWidth: panel.scrollWidth,
        clientWidth: panel.clientWidth,
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight
      },
      headerCenters: [centerY(title), centerY(chooser), centerY(toolbar)],
      chooser: chooser ? { left: chooser.left, right: chooser.right, width: chooser.width } : null,
      sections: [summary, workspace, progress].map((box) => box ? ({
        left: box.left,
        right: box.right,
        bottom: box.bottom
      }) : null),
      geometryHeading: headingStyle ? {
        fontSize: Number.parseFloat(headingStyle.fontSize),
        fontWeight: Number.parseInt(headingStyle.fontWeight, 10)
      } : null,
      statusRail: statusRail ? {
        scrollWidth: statusRail.scrollWidth,
        clientWidth: statusRail.clientWidth,
        scrollHeight: statusRail.scrollHeight,
        clientHeight: statusRail.clientHeight
      } : null
    };
  });

  expect(layout.documentSize.width).toBeLessThanOrEqual(layout.viewport.width);
  expect(layout.documentSize.height).toBeLessThanOrEqual(layout.viewport.height);
  expect(layout.panel.scrollWidth).toBeLessThanOrEqual(layout.panel.clientWidth);
  expect(layout.panel.scrollHeight).toBeLessThanOrEqual(layout.panel.clientHeight);
  expect(layout.panel.bottom).toBeLessThanOrEqual(layout.viewport.height);
  expect(Math.max(...layout.headerCenters) - Math.min(...layout.headerCenters)).toBeLessThanOrEqual(4);
  expect(layout.chooser).not.toBeNull();
  expect(layout.chooser!.right).toBeLessThanOrEqual(layout.panel.right);
  expect(layout.chooser!.width).toBeLessThanOrEqual(100);
  expect(layout.sections.every((section) => section && section.bottom <= layout.panel.bottom)).toBe(true);
  expect(layout.sections[0]!.right).toBeLessThanOrEqual(layout.sections[1]!.left);
  expect(layout.sections[1]!.right).toBeLessThanOrEqual(layout.sections[2]!.left);
  expect(layout.geometryHeading).toEqual({ fontSize: 10.5, fontWeight: 700 });
  expect(layout.statusRail).not.toBeNull();
  expect(layout.statusRail!.scrollWidth).toBeLessThanOrEqual(layout.statusRail!.clientWidth);
  expect(layout.statusRail!.clientHeight).toBeLessThanOrEqual(layout.viewport.height);
});
