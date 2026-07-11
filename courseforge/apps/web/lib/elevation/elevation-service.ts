import type {
  CourseElevationModel,
  CourseProject,
  DraftHolePlan
} from "../../../../packages/course-schema/src";
import { generateMockCourseElevationModel } from "./mock-elevation-provider";

export type ElevationGenerationResult = {
  elevationModel?: CourseElevationModel;
  warnings: string[];
};

export function generateMockElevationProfile(
  project: CourseProject | null,
  draftHolePlan: DraftHolePlan | null
): ElevationGenerationResult {
  if (!project) {
    return {
      warnings: ["No active project is available."]
    };
  }

  if (!project.status.boundaryConfirmed || !project.boundary) {
    return {
      warnings: ["Confirm a course boundary before generating a mock elevation profile."]
    };
  }

  const warnings: string[] = [];

  if (!draftHolePlan?.holes.some((hole) => hole.trace)) {
    warnings.push("No saved hole traces found. Boundary samples were generated, but hole profiles are missing.");
  }

  if (!project.generatedGeometry?.holes.length) {
    warnings.push("Generated geometry preview is missing.");
  }

  const elevationModel = generateMockCourseElevationModel(project, draftHolePlan);

  return {
    elevationModel: {
      ...elevationModel,
      warnings: [...warnings, ...elevationModel.warnings]
    },
    warnings
  };
}

export function markElevationModelStale(project: CourseProject): CourseProject {
  if (!project.elevationModel || project.elevationModel.status === "stale") {
    return project;
  }

  return {
    ...project,
    elevationModel: {
      ...project.elevationModel,
      status: "stale",
      warnings: [
        "Boundary or trace data changed after elevation generation. Regenerate the mock elevation profile.",
        ...project.elevationModel.warnings
      ]
    },
    status: {
      ...project.status,
      elevationGenerated: false
    }
  };
}
