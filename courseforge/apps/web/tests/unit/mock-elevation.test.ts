import { describe, expect, it } from "vitest";
import { generateMockCourseElevationModel } from "../../lib/elevation/mock-elevation-provider";
import { generateMockElevationProfile } from "../../lib/elevation/elevation-service";
import { createDraftHolePlan, createProject, generatedAt } from "../helpers/course-fixtures";

describe("mock elevation", () => {
  it("returns the same samples for the same input", () => {
    const first = generateMockCourseElevationModel(createProject(), createDraftHolePlan(), generatedAt);
    const second = generateMockCourseElevationModel(createProject(), createDraftHolePlan(), generatedAt);

    expect(first).toEqual(second);
    expect(first.boundarySamplePoints).toHaveLength(4);
    expect(first.holeProfiles[0].samplePoints).toHaveLength(3);
    expect(first.status).toBe("mock");
  });

  it("requires a confirmed boundary", () => {
    const project = createProject();
    project.status.boundaryConfirmed = false;

    expect(generateMockElevationProfile(project, createDraftHolePlan())).toEqual({
      warnings: ["Confirm a course boundary before generating a mock elevation profile."]
    });
  });
});
