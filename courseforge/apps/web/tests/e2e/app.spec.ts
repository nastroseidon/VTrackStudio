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

const savedTrace = {
  teePoint: { latitude: 41.194, longitude: -85.048 },
  centerlinePoints: [{ latitude: 41.195, longitude: -85.047 }],
  greenPoint: { latitude: 41.196, longitude: -85.046 },
  source: "manual",
  confidence: 0.8
};

function createReadyProjectSave() {
  const generatedAt = "2026-07-11T12:00:00.000Z";
  const hole = {
    holeNumber: 1,
    par: 4,
    status: "approved",
    confidence: "low",
    trace: savedTrace
  };
  const generatedGeometry = {
    source: "trace_generated",
    generatedAt,
    holes: [{
      holeNumber: 1,
      source: "trace_generated",
      generatedAt,
      confidence: 0.45
    }]
  };

  return {
    saveVersion: "0.1.0",
    savedAt: generatedAt,
    project: {
      id: "preview-ready-course",
      name: "Preview Ready Course",
      city: "Fort Wayne",
      region: "IN",
      location: { latitude: 41.195, longitude: -85.047 },
      confidence: 0.9,
      holesCount: 1,
      status: {
        courseConfirmed: true,
        locationConfirmed: true,
        boundaryConfirmed: true,
        scorecardConfirmed: false,
        holesTraced: true,
        elevationGenerated: false,
        packageExported: false
      },
      boundary: {
        type: "Polygon",
        source: "manual",
        coordinates: [[[-85.049, 41.193], [-85.045, 41.193], [-85.045, 41.197], [-85.049, 41.197], [-85.049, 41.193]]]
      },
      generatedGeometry
    },
    selectedCourseId: "cherry-hill-fort-wayne",
    selectedImportedCourseMetadata: null,
    autoBuilderOpen: true,
    draftHolePlan: { generatedAt, source: "placeholder", holes: [hole] },
    activeTracingHoleNumber: 1,
    currentTraceDraft: savedTrace,
    traceStep: "review",
    boundaryDraftPoints: [],
    generatedGeometryVisible: true,
    generatedGeometryStale: false
  };
}

async function openProjectSave(page: Page, save: ReturnType<typeof createReadyProjectSave>) {
  await page.addInitScript((projectSave) => {
    if (!window.localStorage.getItem("courseforge.projectSave.v0")) {
      window.localStorage.setItem("courseforge.projectSave.v0", JSON.stringify(projectSave));
    }
  }, save);
  await page.goto("/");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
}

async function openSavedReviewProject(page: Page, withSavedTraces = true) {
  const holes = [
    { holeNumber: 1, status: withSavedTraces ? "trace saved" : "needs tracing", confidence: "low", trace: withSavedTraces ? savedTrace : undefined },
    { holeNumber: 2, status: "needs tracing", confidence: "low" },
    { holeNumber: 3, status: withSavedTraces ? "approved" : "needs tracing", confidence: "low", trace: withSavedTraces ? savedTrace : undefined },
    { holeNumber: 4, status: withSavedTraces ? "needs review" : "needs tracing", confidence: "low", trace: withSavedTraces ? savedTrace : undefined }
  ];
  const project = {
    id: "review-course",
    name: "Review Course",
    city: "Fort Wayne",
    region: "IN",
    location: { latitude: 41.195, longitude: -85.047 },
    confidence: 0.9,
    status: {
      courseConfirmed: true,
      locationConfirmed: true,
      boundaryConfirmed: true,
      scorecardConfirmed: false,
      holesTraced: false,
      elevationGenerated: false,
      packageExported: false
    },
    boundary: {
      type: "Polygon",
      source: "manual",
      coordinates: [[[-85.049, 41.193], [-85.045, 41.193], [-85.045, 41.197], [-85.049, 41.197], [-85.049, 41.193]]]
    }
  };
  const save = {
    saveVersion: "0.1.0",
    savedAt: "2026-07-11T12:00:00.000Z",
    project,
    selectedCourseId: "cherry-hill-fort-wayne",
    selectedImportedCourseMetadata: null,
    autoBuilderOpen: true,
    draftHolePlan: { generatedAt: "2026-07-11T12:00:00.000Z", source: "placeholder", holes },
    activeTracingHoleNumber: 1,
    currentTraceDraft: withSavedTraces ? savedTrace : { centerlinePoints: [], source: "manual", confidence: 0.35 },
    traceStep: withSavedTraces ? "review" : "tee",
    boundaryDraftPoints: [],
    generatedGeometryVisible: true,
    generatedGeometryStale: false
  };

  await page.addInitScript((projectSave) => {
    if (!window.localStorage.getItem("courseforge.projectSave.v0")) {
      window.localStorage.setItem("courseforge.projectSave.v0", JSON.stringify(projectSave));
    }
  }, save);
  await page.goto("/");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
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

test("reviews, navigates, approves, persists, and reopens saved traces", async ({ page }) => {
  await openSavedReviewProject(page);
  await page.getByRole("button", { name: "Review Hole Traces" }).click();

  await expect(page.getByText("Review mode", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Hole trace summary")).toContainText("Hole 1");
  const reviewLayout = await page.getByLabel("Hole tracing tools").evaluate((panel) => ({
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    panelScrollWidth: panel.scrollWidth,
    panelClientWidth: panel.clientWidth,
    panelScrollHeight: panel.scrollHeight,
    panelClientHeight: panel.clientHeight,
    panelBottom: panel.getBoundingClientRect().bottom
  }));
  expect(reviewLayout.documentWidth).toBeLessThanOrEqual(reviewLayout.viewportWidth);
  expect(reviewLayout.documentHeight).toBeLessThanOrEqual(reviewLayout.viewportHeight);
  expect(reviewLayout.panelScrollWidth).toBeLessThanOrEqual(reviewLayout.panelClientWidth);
  expect(reviewLayout.panelScrollHeight).toBeLessThanOrEqual(reviewLayout.panelClientHeight);
  expect(reviewLayout.panelBottom).toBeLessThanOrEqual(reviewLayout.viewportHeight);

  if (process.env.COURSEFORGE_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.COURSEFORGE_SCREENSHOT_DIR}/milestone-16-review-${reviewLayout.viewportWidth}x${reviewLayout.viewportHeight}.png`,
      fullPage: true
    });
  }

  await page.getByRole("button", { name: "Next Saved" }).click();
  await expect(page.getByLabel("Hole trace summary")).toContainText("Hole 3");
  await page.getByRole("button", { name: "Previous Saved" }).click();
  await expect(page.getByLabel("Hole trace summary")).toContainText("Hole 1");
  await page.getByRole("button", { name: "Next Needing Review" }).click();
  await expect(page.getByLabel("Hole trace summary")).toContainText("Hole 4");

  await page.getByRole("button", { name: "Approve Trace" }).click();
  await expect(page.getByLabel("Hole trace summary")).toContainText("approved");
  await expect(page.getByLabel("Project actions").getByLabel("Trace progress")).toContainText("Approved2");

  await page.waitForTimeout(450);
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByLabel("Hole trace summary")).toContainText("approved");

  await page.getByRole("button", { name: "Review Hole Traces" }).click();
  await page.getByRole("button", { name: "Reopen & Edit" }).click();
  await expect(page.getByLabel("Hole trace summary")).toContainText("needs review");
  await expect(page.getByLabel("Project actions").getByLabel("Trace progress")).toContainText("Approved1");
  await expect(page.getByRole("button", { name: "Save Trace" })).toBeVisible();
});

test("keeps review mode closed when no saved traces exist", async ({ page }) => {
  await openSavedReviewProject(page, false);
  await page.getByRole("button", { name: "Review Hole Traces" }).click();

  await expect(page.getByText("No saved hole traces are available to review yet.")).toBeVisible();
  await expect(page.getByText("Review mode", { exact: true })).toHaveCount(0);
});

test("blocks preview export with actionable coverage issues", async ({ page }) => {
  await openSavedReviewProject(page);

  const readiness = page.getByText("Preview JSON readiness").locator("..");
  await expect(readiness).toContainText("Action required");
  await expect(page.getByLabel("Preview export blocking issues")).toContainText(
    "Save complete traces for all expected holes"
  );
  await expect(page.getByLabel("Preview export blocking issues")).toContainText(
    "Review and approve every expected hole trace"
  );
  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeDisabled();
});

test("exports a fully ready neutral preview JSON and fits the desktop viewport", async ({ page }) => {
  await openProjectSave(page, createReadyProjectSave());

  const exportButton = page.getByRole("button", { name: "Export Preview JSON" });
  await expect(page.getByText("Preview JSON readiness").locator("..")).toContainText("Ready");
  await expect(page.getByText("Approved traces").locator("..")).toContainText("1/1");
  await expect(page.getByText("Current preview geometry").locator("..")).toContainText("1/1");
  await expect(exportButton).toBeEnabled();

  const layout = await page.locator("main").evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);

  if (process.env.COURSEFORGE_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.COURSEFORGE_SCREENSHOT_DIR}/milestone-17-readiness-${layout.viewportWidth}x${layout.viewportHeight}.png`,
      fullPage: true
    });
  }

  const download = page.waitForEvent("download");
  await exportButton.click();
  expect((await download).suggestedFilename()).toMatch(/^courseforge-package-preview-ready-course-\d{4}-\d{2}-\d{2}\.json$/);
});

test("reopening revokes readiness until reapproval and geometry regeneration", async ({ page }) => {
  await openProjectSave(page, createReadyProjectSave());
  await page.getByRole("button", { name: "Review Hole Traces" }).click();
  await page.getByRole("button", { name: "Reopen & Edit" }).click();

  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeDisabled();
  await expect(page.getByLabel("Preview export blocking issues")).toContainText("0/1 approved");
  await expect(page.getByLabel("Preview export blocking issues")).toContainText(
    "Regenerate preview geometry after the latest trace change"
  );

  await page.getByRole("button", { name: "Save Trace" }).click();
  await page.getByRole("button", { name: "Approve Trace" }).click();
  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeDisabled();
  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeEnabled();
});

test("save and resume recalculate readiness from restored project state", async ({ page }) => {
  await openProjectSave(page, createReadyProjectSave());
  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeEnabled();

  await page.getByRole("button", { name: "Review Hole Traces" }).click();
  await page.getByRole("button", { name: "Reopen & Edit" }).click();
  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeDisabled();
  await page.getByRole("button", { name: "Save Project" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();

  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeDisabled();
  await expect(page.getByLabel("Preview export blocking issues")).toContainText("0/1 approved");
});

test("project-file import recalculates readiness without persisted readiness state", async ({ page }) => {
  await page.goto("/");
  const save = createReadyProjectSave();
  expect(save).not.toHaveProperty("readiness");
  await page.locator('input[type="file"]').setInputFiles({
    name: "preview-ready-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(save))
  });

  await expect(page.getByRole("button", { name: "Export Preview JSON" })).toBeEnabled();
  await expect(page.getByText("Preview JSON readiness").locator("..")).toContainText("Ready");
});
