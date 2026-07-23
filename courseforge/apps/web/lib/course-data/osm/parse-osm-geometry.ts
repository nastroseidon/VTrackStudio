// Transform an Overpass `out geom;` response into the neutral CourseGeometry
// model. This mirrors the "plan" stage of a course pipeline: real OpenStreetMap
// golf features become normalized fairway/green/tee/bunker polygons grouped per
// hole. Pure and deterministic so it can be unit tested against fixtures.

import type {
  CourseGeometry,
  GeometryConfidence,
  HoleGeometry,
  LatLng,
  LineGeometry,
  PolygonGeometry,
  TeeBoxGeometry
} from "../types";

type OverpassGeomPoint = { lat: number; lon: number };

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeomPoint[];
  members?: Array<{ type: string; role?: string; geometry?: OverpassGeomPoint[] }>;
};

type OverpassResponse = { elements?: OverpassElement[] };

type WorkingHole = {
  holeNumber: number;
  centerline: LatLng[];
  teeBoxes: TeeBoxGeometry[];
  fairways: PolygonGeometry[];
  greens: PolygonGeometry[];
  bunkers: PolygonGeometry[];
  waterHazards: PolygonGeometry[];
  treeAreas: PolygonGeometry[];
  cartPaths: LineGeometry[];
};

const METERS_PER_DEGREE_LAT = 111_320;

function toLatLng(point: OverpassGeomPoint): LatLng {
  return { lat: point.lat, lng: point.lon };
}

function isOverpassResponse(value: unknown): value is OverpassResponse {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as OverpassResponse).elements);
}

// Collect the coordinate rings an element contributes. Ways expose a single
// `geometry` array; relations expose per-member geometry (outer rings kept).
function elementRings(element: OverpassElement): LatLng[][] {
  const rings: LatLng[][] = [];

  if (Array.isArray(element.geometry) && element.geometry.length > 0) {
    rings.push(element.geometry.map(toLatLng));
  }

  if (Array.isArray(element.members)) {
    for (const member of element.members) {
      if (member.role === "inner") {
        continue;
      }
      if (Array.isArray(member.geometry) && member.geometry.length > 0) {
        rings.push(member.geometry.map(toLatLng));
      }
    }
  }

  return rings.filter((ring) => ring.length >= 2);
}

function polygonFromRing(ring: LatLng[]): PolygonGeometry {
  return { points: ring };
}

function centroid(points: LatLng[]): LatLng {
  let latSum = 0;
  let lngSum = 0;
  for (const point of points) {
    latSum += point.lat;
    lngSum += point.lng;
  }
  return { lat: latSum / points.length, lng: lngSum / points.length };
}

// Planar (equirectangular) squared distance in metres. Adequate for the small
// spatial extents of a golf course and cheaper than haversine for association.
function squaredMeters(a: LatLng, b: LatLng): number {
  const meanLatRad = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos(meanLatRad);
  return dLat * dLat + dLng * dLng;
}

function minSquaredToPolyline(point: LatLng, polyline: LatLng[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const vertex of polyline) {
    const distance = squaredMeters(point, vertex);
    if (distance < best) {
      best = distance;
    }
  }
  return best;
}

// Assign a feature to the hole whose centerline passes nearest its centroid.
// Returns null when no holes have a usable centerline.
function nearestHole(point: LatLng, holes: WorkingHole[]): WorkingHole | null {
  let best: WorkingHole | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hole of holes) {
    if (hole.centerline.length === 0) {
      continue;
    }
    const distance = minSquaredToPolyline(point, hole.centerline);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hole;
    }
  }
  return best;
}

// Extract a hole number from a `golf=hole` element's `ref`/`name` tags.
function holeNumberFromTags(tags: Record<string, string>): number | null {
  const candidates = [tags.ref, tags.name, tags["golf:hole"]];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const match = /\d+/.exec(candidate);
    if (match) {
      const value = Number.parseInt(match[0], 10);
      if (Number.isFinite(value) && value > 0 && value <= 72) {
        return value;
      }
    }
  }
  return null;
}

function isWater(tags: Record<string, string>): boolean {
  return (
    tags.golf === "water_hazard" ||
    tags.golf === "lateral_water_hazard" ||
    tags.natural === "water" ||
    tags.natural === "wetland"
  );
}

function isTreeArea(tags: Record<string, string>): boolean {
  return (
    tags.natural === "wood" ||
    tags.natural === "scrub" ||
    tags.natural === "tree_row" ||
    tags.landuse === "forest"
  );
}

function isCartPath(tags: Record<string, string>): boolean {
  return (
    tags.golf === "cartpath" ||
    tags.golf === "path" ||
    ((tags.highway === "path" || tags.highway === "footway" || tags.highway === "service") &&
      tags.golf !== undefined)
  );
}

function presenceConfidence(hole: WorkingHole): GeometryConfidence {
  const hasTee = hole.teeBoxes.length > 0;
  const hasFairway = hole.fairways.length > 0;
  const hasGreen = hole.greens.length > 0;
  const hasHazard = hole.bunkers.length > 0 || hole.waterHazards.length > 0;

  let overall = 0.4;
  if (hasGreen) overall += 0.2;
  if (hasFairway) overall += 0.15;
  if (hasTee) overall += 0.1;
  if (hasHazard) overall += 0.1;

  return {
    overall: Math.min(overall, 0.95),
    tees: hasTee ? 0.8 : 0.2,
    fairways: hasFairway ? 0.8 : 0.2,
    greens: hasGreen ? 0.85 : 0.2,
    hazards: hasHazard ? 0.75 : 0.2
  };
}

/**
 * Parse an Overpass response into a CourseGeometry.
 *
 * Returns `null` when the response contains no `golf=hole` centerlines, since
 * without them features cannot be reliably grouped by hole. Callers should
 * treat null as "OSM has insufficient tagging for this course".
 */
export function parseOverpassResponse(response: unknown, courseId: string): CourseGeometry | null {
  if (!isOverpassResponse(response)) {
    return null;
  }

  const elements = response.elements ?? [];

  // Pass 1: build holes from golf=hole ways (the per-hole centerlines).
  const holesByNumber = new Map<number, WorkingHole>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    if (tags.golf !== "hole") {
      continue;
    }
    const holeNumber = holeNumberFromTags(tags);
    if (holeNumber === null) {
      continue;
    }
    const rings = elementRings(element);
    const centerline = rings[0] ?? [];
    if (centerline.length < 2) {
      continue;
    }
    // Keep the longest centerline if a hole number appears more than once.
    const existing = holesByNumber.get(holeNumber);
    if (!existing || centerline.length > existing.centerline.length) {
      holesByNumber.set(holeNumber, {
        holeNumber,
        centerline,
        teeBoxes: [],
        fairways: [],
        greens: [],
        bunkers: [],
        waterHazards: [],
        treeAreas: [],
        cartPaths: []
      });
    }
  }

  const holes = Array.from(holesByNumber.values()).sort((a, b) => a.holeNumber - b.holeNumber);
  if (holes.length === 0) {
    return null;
  }

  // Pass 2: assign area/line features to their nearest hole centerline.
  for (const element of elements) {
    const tags = element.tags ?? {};
    if (tags.golf === "hole" || tags.leisure === "golf_course") {
      continue;
    }

    // Tee expressed as a single node: keep as a tee-box center point.
    if (element.type === "node" && tags.golf === "tee" && typeof element.lat === "number" && typeof element.lon === "number") {
      const center: LatLng = { lat: element.lat, lng: element.lon };
      const hole = nearestHole(center, holes);
      hole?.teeBoxes.push({ center });
      continue;
    }

    const rings = elementRings(element);
    if (rings.length === 0) {
      continue;
    }

    for (const ring of rings) {
      const anchor = centroid(ring);
      const hole = nearestHole(anchor, holes);
      if (!hole) {
        continue;
      }
      const polygon = polygonFromRing(ring);

      if (tags.golf === "tee") {
        hole.teeBoxes.push({ polygon, center: anchor });
      } else if (tags.golf === "fairway") {
        hole.fairways.push(polygon);
      } else if (tags.golf === "green") {
        hole.greens.push(polygon);
      } else if (tags.golf === "bunker") {
        hole.bunkers.push(polygon);
      } else if (isWater(tags)) {
        hole.waterHazards.push(polygon);
      } else if (isCartPath(tags)) {
        hole.cartPaths.push({ points: ring });
      } else if (isTreeArea(tags)) {
        hole.treeAreas.push(polygon);
      }
    }
  }

  const holeGeometries: HoleGeometry[] = holes.map((hole) => ({
    holeNumber: hole.holeNumber,
    teeBoxes: hole.teeBoxes,
    fairways: hole.fairways,
    greens: hole.greens,
    bunkers: hole.bunkers,
    waterHazards: hole.waterHazards,
    treeAreas: hole.treeAreas,
    cartPaths: hole.cartPaths,
    centerline: { points: hole.centerline },
    confidence: presenceConfidence(hole)
  }));

  return {
    courseId,
    source: "osm",
    holes: holeGeometries
  };
}
