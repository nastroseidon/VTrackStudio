import type {
  DraftHole,
  DraftHolePlan,
  GeneratedCourseGeometry,
  GeneratedHoleGeometry,
  PolygonGeometry,
  TracePoint
} from "../../../../packages/course-schema/src";

const yardsPerMeter = 1.09361;
const metersPerDegreeLatitude = 111_320;

function yardsToMeters(yards: number) {
  return yards / yardsPerMeter;
}

function metersToLatitudeDegrees(meters: number) {
  return meters / metersPerDegreeLatitude;
}

function metersToLongitudeDegrees(meters: number, latitude: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.max(Math.cos(latitudeRadians), 0.2);

  return meters / metersPerDegreeLongitude;
}

function offsetPoint(point: TracePoint, eastMeters: number, northMeters: number): TracePoint {
  return {
    latitude: point.latitude + metersToLatitudeDegrees(northMeters),
    longitude: point.longitude + metersToLongitudeDegrees(eastMeters, point.latitude)
  };
}

function pointToCoordinate(point: TracePoint): [longitude: number, latitude: number] {
  return [point.longitude, point.latitude];
}

function polygonFromPoints(points: TracePoint[]): PolygonGeometry {
  const coordinates = points.map(pointToCoordinate);
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  const closedCoordinates =
    firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]
      ? coordinates
      : [...coordinates, firstPoint];

  return {
    type: "Polygon",
    coordinates: [closedCoordinates]
  };
}

function fairwayWidthYards(par?: number) {
  if (par === 3) {
    return 20;
  }

  if (par === 5) {
    return 40;
  }

  return 35;
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y) || 1;

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function segmentDirection(start: TracePoint, end: TracePoint) {
  const meanLatitude = (start.latitude + end.latitude) / 2;
  const eastMeters = (end.longitude - start.longitude) / metersToLongitudeDegrees(1, meanLatitude);
  const northMeters = (end.latitude - start.latitude) / metersToLatitudeDegrees(1);

  return normalize({ x: eastMeters, y: northMeters });
}

function perpendicularAt(points: TracePoint[], index: number) {
  const previousPoint = points[Math.max(index - 1, 0)];
  const nextPoint = points[Math.min(index + 1, points.length - 1)];
  const direction = segmentDirection(previousPoint, nextPoint);

  return {
    x: -direction.y,
    y: direction.x
  };
}

export function createTeeBoxAroundPoint(point: TracePoint): PolygonGeometry {
  const halfWidthMeters = yardsToMeters(8);
  const halfDepthMeters = yardsToMeters(6);

  return polygonFromPoints([
    offsetPoint(point, -halfWidthMeters, -halfDepthMeters),
    offsetPoint(point, halfWidthMeters, -halfDepthMeters),
    offsetPoint(point, halfWidthMeters, halfDepthMeters),
    offsetPoint(point, -halfWidthMeters, halfDepthMeters)
  ]);
}

export function createGreenAroundPoint(point: TracePoint, par?: number): PolygonGeometry {
  const eastRadiusMeters = yardsToMeters(par === 3 ? 16 : 20);
  const northRadiusMeters = yardsToMeters(18);
  const steps = 18;
  const points = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;

    return offsetPoint(
      point,
      Math.cos(angle) * eastRadiusMeters,
      Math.sin(angle) * northRadiusMeters
    );
  });

  return polygonFromPoints(points);
}

export function createCorridorAroundTrace(points: TracePoint[], par?: number): PolygonGeometry | undefined {
  if (points.length < 2) {
    return undefined;
  }

  // TODO: Replace this local lat/lng approximation with real geodesic buffering when GIS tooling is added.
  const halfWidthMeters = yardsToMeters(fairwayWidthYards(par) / 2);
  const leftSide = points.map((point, index) => {
    const perpendicular = perpendicularAt(points, index);

    return offsetPoint(point, perpendicular.x * halfWidthMeters, perpendicular.y * halfWidthMeters);
  });
  const rightSide = points
    .map((point, index) => {
      const perpendicular = perpendicularAt(points, index);

      return offsetPoint(point, -perpendicular.x * halfWidthMeters, -perpendicular.y * halfWidthMeters);
    })
    .reverse();

  return polygonFromPoints([...leftSide, ...rightSide]);
}

export function generateHoleGeometryFromTrace(
  hole: DraftHole,
  generatedAt = new Date().toISOString()
): GeneratedHoleGeometry | null {
  if (!hole.trace?.teePoint || !hole.trace.greenPoint) {
    return null;
  }

  const centerline = [
    hole.trace.teePoint,
    ...hole.trace.centerlinePoints,
    hole.trace.greenPoint
  ];

  return {
    holeNumber: hole.holeNumber,
    source: "trace_generated",
    teeBox: createTeeBoxAroundPoint(hole.trace.teePoint),
    fairway: createCorridorAroundTrace(centerline, hole.par),
    green: createGreenAroundPoint(hole.trace.greenPoint, hole.par),
    generatedAt,
    confidence: hole.status === "approved" ? 0.72 : 0.58
  };
}

export function generateBasicCourseGeometry(draftHolePlan: DraftHolePlan): GeneratedCourseGeometry {
  const generatedAt = new Date().toISOString();
  const holes = draftHolePlan.holes
    .map((hole) => generateHoleGeometryFromTrace(hole, generatedAt))
    .filter((hole): hole is GeneratedHoleGeometry => Boolean(hole));

  return {
    source: "trace_generated",
    generatedAt,
    holes
  };
}
