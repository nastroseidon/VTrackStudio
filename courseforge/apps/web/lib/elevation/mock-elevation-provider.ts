import type {
  CourseElevationModel,
  CourseProject,
  DraftHole,
  DraftHolePlan,
  ElevationPoint,
  HoleElevationProfile,
  TracePoint
} from "../../../../packages/course-schema/src";

function deterministicElevation(latitude: number, longitude: number, seed = 0) {
  const latWave = Math.sin((latitude + seed * 0.013) * 31.7);
  const lngWave = Math.cos((longitude - seed * 0.017) * 27.4);

  return Number((252 + latWave * 8 + lngWave * 6 + seed * 0.35).toFixed(2));
}

function toElevationPoint(point: TracePoint, seed = 0): ElevationPoint {
  return {
    lat: point.latitude,
    lng: point.longitude,
    elevationMeters: deterministicElevation(point.latitude, point.longitude, seed)
  };
}

function boundarySamplePoints(project: CourseProject) {
  const ring = project.boundary?.coordinates[0] ?? [];
  const openRing = ring.length > 1 ? ring.slice(0, -1) : ring;

  return openRing.map(([lng, lat], index) => ({
    lat,
    lng,
    elevationMeters: deterministicElevation(lat, lng, index)
  }));
}

function profileForHole(hole: DraftHole): HoleElevationProfile | null {
  if (!hole.trace?.teePoint && !hole.trace?.greenPoint) {
    return null;
  }

  const tracePoints = [
    hole.trace.teePoint,
    ...hole.trace.centerlinePoints,
    hole.trace.greenPoint
  ].filter((point): point is TracePoint => Boolean(point));
  const samplePoints = tracePoints.map((point, index) => toElevationPoint(point, hole.holeNumber + index));
  const elevations = samplePoints.map((point) => point.elevationMeters);
  const teeElevationMeters = samplePoints[0]?.elevationMeters;
  const greenElevationMeters = samplePoints[samplePoints.length - 1]?.elevationMeters;

  return {
    holeNumber: hole.holeNumber,
    teeElevationMeters,
    greenElevationMeters,
    minElevationMeters: elevations.length ? Math.min(...elevations) : undefined,
    maxElevationMeters: elevations.length ? Math.max(...elevations) : undefined,
    elevationChangeMeters:
      teeElevationMeters !== undefined && greenElevationMeters !== undefined
        ? Number((greenElevationMeters - teeElevationMeters).toFixed(2))
        : undefined,
    samplePoints
  };
}

export function generateMockCourseElevationModel(
  project: CourseProject,
  draftHolePlan: DraftHolePlan | null,
  generatedAt = new Date().toISOString()
): CourseElevationModel {
  const boundaryPoints = boundarySamplePoints(project);
  const holeProfiles = draftHolePlan?.holes
    .map(profileForHole)
    .filter((profile): profile is HoleElevationProfile => Boolean(profile)) ?? [];
  const allElevations = [
    ...boundaryPoints.map((point) => point.elevationMeters),
    ...holeProfiles.flatMap((profile) => profile.samplePoints.map((point) => point.elevationMeters))
  ];
  const warnings = [
    "Mock elevation profile only. Not real terrain or topology.",
    "Future milestones can connect Google Elevation, USGS, or Earth Engine data."
  ];

  if (!draftHolePlan?.holes.length || holeProfiles.length === 0) {
    warnings.push("No saved hole traces were available for hole elevation profiles.");
  }

  if (!project.generatedGeometry?.holes.length) {
    warnings.push("Generated geometry preview is missing; elevation was sampled from boundary and traces only.");
  }

  return {
    source: "mock",
    status: "mock",
    generatedAt,
    boundarySamplePoints: boundaryPoints,
    holeProfiles,
    minElevationMeters: allElevations.length ? Math.min(...allElevations) : undefined,
    maxElevationMeters: allElevations.length ? Math.max(...allElevations) : undefined,
    warnings
  };
}
