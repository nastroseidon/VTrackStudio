import { describe, expect, it } from "vitest";
import {
  buildCoursePackage,
  validateCoursePackageReadiness
} from "../../lib/course-package/build-course-package";
import { generateBasicCourseGeometry } from "../../lib/geometry/generate-basic-hole-geometry";
import { createDraftHolePlan, createProject, generatedAt } from "../helpers/course-fixtures";

describe("CoursePackage construction", () => {
  it("blocks export when generated geometry is missing", () => {
    const readiness = validateCoursePackageReadiness(createProject(), createDraftHolePlan(), false);

    expect(readiness.canExport).toBe(false);
    expect(readiness.blockingIssues).toContain("Generated geometry preview is missing.");
  });

  it("builds the neutral package from existing project data", () => {
    const plan = createDraftHolePlan();
    const project = { ...createProject(), generatedGeometry: generateBasicCourseGeometry(plan) };
    const coursePackage = buildCoursePackage(project, plan, false, generatedAt);

    expect(coursePackage).toMatchObject({
      packageVersion: "0.1.0",
      exportedAt: generatedAt,
      source: "courseforge",
      course: { name: "Test Course", holesCount: 1 },
      geometry: { stale: false }
    });
    expect(coursePackage.holes[0]).toMatchObject({ holeNumber: 1, par: 4, status: "approved" });
    expect(coursePackage.metadata.warnings.map((warning) => warning.code)).toContain("no-elevation-topology");
  });
});
