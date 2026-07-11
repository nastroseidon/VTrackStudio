import { describe, expect, it } from "vitest";
import {
  buildCoursePackage,
  validateCoursePackageReadiness
} from "../../lib/course-package/build-course-package";
import { generateBasicCourseGeometry } from "../../lib/geometry/generate-basic-hole-geometry";
import { createDraftHolePlan, createProject, generatedAt } from "../helpers/course-fixtures";

function createReadyState() {
  const plan = createDraftHolePlan();
  const project = { ...createProject(), generatedGeometry: generateBasicCourseGeometry(plan) };

  return { plan, project };
}

describe("CoursePackage preview readiness", () => {
  it("blocks missing projects and unconfirmed identity prerequisites", () => {
    const missingProject = validateCoursePackageReadiness(null, null, false);
    expect(missingProject.canExport).toBe(false);
    expect(missingProject.blockingIssues).toContain(
      "Select and confirm a course before exporting preview JSON."
    );

    const { plan, project } = createReadyState();
    const unconfirmed = {
      ...project,
      status: {
        ...project.status,
        courseConfirmed: false,
        locationConfirmed: false,
        boundaryConfirmed: false
      }
    };
    const readiness = validateCoursePackageReadiness(unconfirmed, plan, false);

    expect(readiness.blockingIssues).toEqual(expect.arrayContaining([
      "Confirm the selected course identity before exporting preview JSON.",
      "Confirm the course location before exporting preview JSON.",
      "Confirm the course boundary before exporting preview JSON."
    ]));
  });

  it("blocks incomplete traces and reports trace coverage", () => {
    const { plan, project } = createReadyState();
    const incompletePlan = {
      ...plan,
      holes: plan.holes.map((hole) => ({ ...hole, trace: undefined, status: "needs tracing" as const }))
    };
    const readiness = validateCoursePackageReadiness(project, incompletePlan, false);

    expect(readiness.canExport).toBe(false);
    expect(readiness.coverage.completeTraces).toBe(0);
    expect(readiness.blockingIssues).toContain("Save complete traces for all expected holes (0/1 complete).");
  });

  it("blocks unapproved traces and reports approval coverage", () => {
    const { plan, project } = createReadyState();
    const unapprovedPlan = {
      ...plan,
      holes: plan.holes.map((hole) => ({ ...hole, status: "needs review" as const }))
    };
    const readiness = validateCoursePackageReadiness(project, unapprovedPlan, false);

    expect(readiness.coverage).toMatchObject({ expectedHoles: 1, completeTraces: 1, approvedTraces: 0 });
    expect(readiness.blockingIssues).toContain(
      "Review and approve every expected hole trace (0/1 approved)."
    );
  });

  it("blocks missing geometry", () => {
    const readiness = validateCoursePackageReadiness(createProject(), createDraftHolePlan(), false);

    expect(readiness.canExport).toBe(false);
    expect(readiness.blockingIssues).toContain("Generate preview geometry for all expected holes.");
  });

  it("blocks stale geometry and sets current geometry coverage to zero", () => {
    const { plan, project } = createReadyState();
    const readiness = validateCoursePackageReadiness(project, plan, true);

    expect(readiness.coverage.currentGeometry).toBe(0);
    expect(readiness.blockingIssues).toContain(
      "Regenerate preview geometry after the latest trace change."
    );
  });

  it("blocks an existing stale elevation model", () => {
    const { plan, project } = createReadyState();
    const withStaleElevation = {
      ...project,
      elevationModel: {
        source: "mock" as const,
        status: "stale" as const,
        generatedAt,
        boundarySamplePoints: [],
        holeProfiles: [],
        warnings: []
      }
    };
    const readiness = validateCoursePackageReadiness(withStaleElevation, plan, false);

    expect(readiness.canExport).toBe(false);
    expect(readiness.blockingIssues).toContain(
      "Regenerate or remove the stale elevation model before exporting preview JSON."
    );
  });

  it("keeps missing elevation and unconfirmed scorecard as non-blocking warnings", () => {
    const { plan, project } = createReadyState();
    const readiness = validateCoursePackageReadiness(project, plan, false);
    const warningCodes = readiness.warnings.map((warning) => warning.code);

    expect(readiness.canExport).toBe(true);
    expect(warningCodes).toContain("no-elevation-topology");
    expect(warningCodes).toContain("scorecard-not-confirmed");
  });

  it("reports a fully ready preview state with complete coverage", () => {
    const { plan, project } = createReadyState();
    const readiness = validateCoursePackageReadiness(project, plan, false);

    expect(readiness).toMatchObject({
      canExport: true,
      blockingIssues: [],
      coverage: { expectedHoles: 1, completeTraces: 1, approvedTraces: 1, currentGeometry: 1 }
    });
  });

  it("reopening or editing a trace revokes readiness", () => {
    const { plan, project } = createReadyState();
    const reopenedPlan = {
      ...plan,
      holes: plan.holes.map((hole) => ({ ...hole, status: "needs review" as const }))
    };
    const readiness = validateCoursePackageReadiness(project, reopenedPlan, true);

    expect(readiness.canExport).toBe(false);
    expect(readiness.coverage).toMatchObject({ approvedTraces: 0, currentGeometry: 0 });
  });

  it("restores readiness after a trace is saved, reapproved, and geometry is regenerated", () => {
    const { plan, project } = createReadyState();
    const savedPlan = {
      ...plan,
      holes: plan.holes.map((hole) => ({ ...hole, status: "trace saved" as const }))
    };
    expect(validateCoursePackageReadiness(project, savedPlan, true).canExport).toBe(false);

    const reapprovedPlan = {
      ...savedPlan,
      holes: savedPlan.holes.map((hole) => ({ ...hole, status: "approved" as const }))
    };
    const regeneratedProject = {
      ...project,
      generatedGeometry: generateBasicCourseGeometry(reapprovedPlan)
    };

    expect(validateCoursePackageReadiness(regeneratedProject, reapprovedPlan, false).canExport).toBe(true);
  });
});

describe("CoursePackage construction", () => {
  it("builds the neutral preview JSON from existing project data without changing the schema", () => {
    const { plan, project } = createReadyState();
    const coursePackage = buildCoursePackage(project, plan, false, generatedAt);

    expect(coursePackage).toMatchObject({
      packageVersion: "0.1.0",
      exportedAt: generatedAt,
      source: "courseforge",
      course: { name: "Test Course", holesCount: 1 },
      geometry: { stale: false }
    });
    expect(coursePackage.holes[0]).toMatchObject({ holeNumber: 1, par: 4, status: "approved" });
  });
});
