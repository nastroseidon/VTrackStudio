import type {
  CoursePackage,
  CoursePackageWarning,
  CourseProject,
  DraftHolePlan
} from "../../../../packages/course-schema/src";

export type CoursePackageReadiness = {
  blockingIssues: string[];
  warnings: CoursePackageWarning[];
  coverage: {
    expectedHoles: number;
    completeTraces: number;
    approvedTraces: number;
    currentGeometry: number;
  };
  canExport: boolean;
};

function hasTrace(hole: DraftHolePlan["holes"][number]) {
  return Boolean(hole.trace?.teePoint && hole.trace.greenPoint);
}

function getExpectedHoleNumbers(project: CourseProject | null, draftHolePlan: DraftHolePlan | null) {
  if (project?.scorecard?.holes.length) {
    return project.scorecard.holes.map((hole) => hole.holeNumber);
  }

  if (draftHolePlan?.holes.length) {
    return draftHolePlan.holes.map((hole) => hole.holeNumber);
  }

  return Array.from({ length: project?.holesCount ?? 0 }, (_, index) => index + 1);
}

export function getCoursePackageWarnings(project: CourseProject | null): CoursePackageWarning[] {
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

  return warnings;
}

export function validateCoursePackageReadiness(
  project: CourseProject | null,
  draftHolePlan: DraftHolePlan | null,
  generatedGeometryStale: boolean
): CoursePackageReadiness {
  const blockingIssues: string[] = [];
  const expectedHoleNumbers = getExpectedHoleNumbers(project, draftHolePlan);
  const expectedHoleSet = new Set(expectedHoleNumbers);
  const draftHolesByNumber = new Map(
    draftHolePlan?.holes.map((hole) => [hole.holeNumber, hole]) ?? []
  );
  const geometryHoleNumbers = new Set(
    project?.generatedGeometry?.holes.map((hole) => hole.holeNumber) ?? []
  );
  const completeTraces = expectedHoleNumbers.filter((holeNumber) => {
    const hole = draftHolesByNumber.get(holeNumber);
    return hole ? hasTrace(hole) : false;
  }).length;
  const approvedTraces = expectedHoleNumbers.filter((holeNumber) => {
    const hole = draftHolesByNumber.get(holeNumber);
    return hole ? hasTrace(hole) && hole.status === "approved" : false;
  }).length;
  const currentGeometry = generatedGeometryStale
    ? 0
    : expectedHoleNumbers.filter((holeNumber) => geometryHoleNumbers.has(holeNumber)).length;

  if (!project) {
    blockingIssues.push("Select and confirm a course before exporting preview JSON.");
  }

  if (project && !project.status.courseConfirmed) {
    blockingIssues.push("Confirm the selected course identity before exporting preview JSON.");
  }

  if (project && !project.status.locationConfirmed) {
    blockingIssues.push("Confirm the course location before exporting preview JSON.");
  }

  if (project && !project.status.boundaryConfirmed) {
    blockingIssues.push("Confirm the course boundary before exporting preview JSON.");
  }

  if (!expectedHoleSet.size) {
    blockingIssues.push("Generate a draft hole plan so expected-hole coverage can be checked.");
  } else {
    if (completeTraces < expectedHoleSet.size) {
      blockingIssues.push(
        `Save complete traces for all expected holes (${completeTraces}/${expectedHoleSet.size} complete).`
      );
    }

    if (approvedTraces < expectedHoleSet.size) {
      blockingIssues.push(
        `Review and approve every expected hole trace (${approvedTraces}/${expectedHoleSet.size} approved).`
      );
    }

    if (!project?.generatedGeometry?.holes.length) {
      blockingIssues.push("Generate preview geometry for all expected holes.");
    } else if (generatedGeometryStale) {
      blockingIssues.push("Regenerate preview geometry after the latest trace change.");
    } else if (currentGeometry < expectedHoleSet.size) {
      blockingIssues.push(
        `Generate preview geometry for every expected hole (${currentGeometry}/${expectedHoleSet.size} current).`
      );
    }
  }

  if (project?.elevationModel?.status === "stale") {
    blockingIssues.push("Regenerate or remove the stale elevation model before exporting preview JSON.");
  }

  return {
    blockingIssues,
    warnings: getCoursePackageWarnings(project),
    coverage: {
      expectedHoles: expectedHoleSet.size,
      completeTraces,
      approvedTraces,
      currentGeometry
    },
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
    surfaces: project.surfaces,
    metadata: {
      geometryStatus: project.geometryStatus,
      locationSource: project.locationSource,
      boundarySource: project.boundary?.source,
      warnings: getCoursePackageWarnings(project),
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
