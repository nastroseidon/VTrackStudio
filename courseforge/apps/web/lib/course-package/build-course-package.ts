import type {
  CoursePackage,
  CoursePackageWarning,
  CourseProject,
  DraftHolePlan
} from "../../../../packages/course-schema/src";

export type CoursePackageReadiness = {
  blockingIssues: string[];
  warnings: CoursePackageWarning[];
  canExport: boolean;
};

function hasTrace(hole: DraftHolePlan["holes"][number]) {
  return Boolean(hole.trace?.teePoint && hole.trace.greenPoint);
}

export function getCoursePackageWarnings(
  project: CourseProject | null,
  draftHolePlan: DraftHolePlan | null,
  generatedGeometryStale: boolean
): CoursePackageWarning[] {
  const warnings: CoursePackageWarning[] = [
    {
      code: "basic-preview-geometry",
      message: "Geometry is a basic visual preview generated from manual traces."
    },
    {
      code: "no-unreal-assets",
      message: "No Unreal-ready assets or import data are included yet."
    }
  ];

  if (project && !project.status.scorecardConfirmed) {
    warnings.push({
      code: "scorecard-not-confirmed",
      message: "Scorecard has not been confirmed."
    });
  }

  if (!project?.elevationModel) {
    warnings.push({
      code: "no-elevation-topology",
      message: "No elevation, terrain, or topology data is included yet."
    });
  }

  if (project?.elevationModel?.status === "mock") {
    warnings.push({
      code: "mock-elevation-profile",
      message: "Elevation profile uses mock data and is not real terrain/topology."
    });
  }

  if (project?.elevationModel?.source === "google_elevation") {
    warnings.push({
      code: "elevation-samples-no-heightmap",
      message: "Elevation samples are included, but no terrain heightmap is generated yet."
    });
  }

  if (project?.elevationModel?.status === "stale") {
    warnings.push({
      code: "elevation-profile-stale",
      message: "Boundary or trace data changed after elevation generation. Regenerate elevation profile."
    });
  }

  if (draftHolePlan?.holes.length && draftHolePlan.holes.some((hole) => !hasTrace(hole))) {
    warnings.push({
      code: "not-all-holes-traced",
      message: "Not all holes have saved traces."
    });
  }

  if (generatedGeometryStale) {
    warnings.push({
      code: "generated-geometry-stale",
      message: "A trace changed after geometry generation. Regenerate geometry to update the preview."
    });
  }

  return warnings;
}

export function validateCoursePackageReadiness(
  project: CourseProject | null,
  draftHolePlan: DraftHolePlan | null,
  generatedGeometryStale: boolean
): CoursePackageReadiness {
  const blockingIssues: string[] = [];

  if (!project) {
    blockingIssues.push("No active project.");
  }

  if (project && !project.status.courseConfirmed) {
    blockingIssues.push("Course is not confirmed.");
  }

  if (project && !project.status.locationConfirmed) {
    blockingIssues.push("Location is not confirmed.");
  }

  if (project && !project.status.boundaryConfirmed) {
    blockingIssues.push("Boundary is not confirmed.");
  }

  if (project && !project.generatedGeometry?.holes.length) {
    blockingIssues.push("Generated geometry preview is missing.");
  }

  return {
    blockingIssues,
    warnings: getCoursePackageWarnings(project, draftHolePlan, generatedGeometryStale),
    canExport: blockingIssues.length === 0
  };
}

export function buildCoursePackage(
  project: CourseProject,
  draftHolePlan: DraftHolePlan | null,
  generatedGeometryStale: boolean,
  exportedAt = new Date().toISOString()
): CoursePackage {
  const geometryByHole = new Map(
    project.generatedGeometry?.holes.map((holeGeometry) => [holeGeometry.holeNumber, holeGeometry]) ?? []
  );
  const scorecardByHole = new Map(
    project.scorecard?.holes.map((hole) => [hole.holeNumber, hole]) ?? []
  );
  const packageHoles =
    draftHolePlan?.holes.map((hole) => {
      const scorecardHole = scorecardByHole.get(hole.holeNumber);

      return {
        holeNumber: hole.holeNumber,
        par: hole.par ?? scorecardHole?.par,
        handicapIndex: scorecardHole?.handicapIndex,
        yardagesByTee: hole.yardagesByTee ?? scorecardHole?.yardagesByTee,
        trace: hole.trace,
        generatedGeometry: geometryByHole.get(hole.holeNumber),
        status: hole.status,
        confidence: hole.confidence
      };
    }) ??
    project.generatedGeometry?.holes.map((holeGeometry) => ({
      holeNumber: holeGeometry.holeNumber,
      generatedGeometry: holeGeometry,
      status: "needs review" as const,
      confidence: "low" as const
    })) ??
    [];

  return {
    packageVersion: "0.1.0",
    exportedAt,
    source: "courseforge",
    course: {
      name: project.name,
      providerId: project.providerId,
      providerCourseId: project.providerCourseId,
      location: project.location,
      originalLocation: project.originalLocation,
      boundary: project.boundary,
      holesCount: project.holesCount ?? draftHolePlan?.holes.length ?? project.scorecard?.holes.length
    },
    scorecard: project.scorecard
      ? {
          confirmed: project.status.scorecardConfirmed,
          tees: project.scorecard.tees,
          holes: project.scorecard.holes
        }
      : undefined,
    holes: packageHoles,
    geometry: {
      source: project.generatedGeometry?.source,
      generatedAt: project.generatedGeometry?.generatedAt,
      stale: generatedGeometryStale,
      holes: project.generatedGeometry?.holes ?? []
    },
    elevation: project.elevationModel,
    metadata: {
      geometryStatus: project.geometryStatus,
      locationSource: project.locationSource,
      boundarySource: project.boundary?.source,
      warnings: getCoursePackageWarnings(project, draftHolePlan, generatedGeometryStale),
      limitations: [
        "Basic geometry preview only.",
        project.elevationModel
          ? "Elevation profile may be mock/sample data only."
          : "No elevation or terrain generation.",
        "No final playable simulator assets.",
        "No Unreal import data."
      ]
    }
  };
}
