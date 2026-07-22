// Overpass API query construction and course-id parsing for the OSM golf
// geometry provider. These functions are pure so they can be unit tested
// without network access; the live request helper is a thin wrapper.

export type OsmElementType = "way" | "relation" | "node";

export type OsmElementTarget = {
  kind: "element";
  elementType: OsmElementType;
  id: number;
};

export type OsmPointTarget = {
  kind: "point";
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type OsmGeometryTarget = OsmElementTarget | OsmPointTarget;

// Default search radius for point-based lookups. Large enough to cover an
// 18-hole course, small enough to avoid pulling in an adjacent facility.
export const DEFAULT_SEARCH_RADIUS_METERS = 1200;
export const MAX_SEARCH_RADIUS_METERS = 5000;
export const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
// Overpass etiquette: identify the client. overpass-api.de returns HTTP 406 to
// requests without an acceptable User-Agent (e.g. bare Node fetch), so this is
// also functionally required, not just polite.
export const OVERPASS_USER_AGENT = "VTrackCourseForge/1.0 (personal, non-commercial golf sim; +https://github.com/nastroseidon/VTrackStudio)";

/**
 * Parse a courseId owned by the OSM provider into an Overpass target.
 *
 * Recognised forms (the leading `osm:` prefix is optional):
 *   - `osm:way/123456`      an OSM way (typically the golf_course area)
 *   - `osm:relation/98765`  an OSM multipolygon relation
 *   - `osm:node/42`         an OSM node
 *   - `osm:@56.28,-2.59`    a lat,lng point (radius defaults, optional 3rd value in metres)
 *   - `osm:56.28,-2.59,900` a lat,lng point with explicit radius
 *
 * Returns `null` for any courseId this provider does not own, so the
 * course-data service can fall through to other geometry providers.
 */
export function parseOsmCourseId(courseId: string): OsmGeometryTarget | null {
  if (typeof courseId !== "string") {
    return null;
  }

  const trimmed = courseId.trim();
  const body = trimmed.startsWith("osm:") ? trimmed.slice(4) : trimmed;

  if (body.length === 0) {
    return null;
  }

  const elementMatch = /^(way|relation|node)\/(\d+)$/i.exec(body);
  if (elementMatch) {
    const id = Number.parseInt(elementMatch[2], 10);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return {
      kind: "element",
      elementType: elementMatch[1].toLowerCase() as OsmElementType,
      id
    };
  }

  // Point form only applies when the caller prefixed `osm:` (an `@` prefix is
  // also accepted). A bare "lat,lng" without the prefix is not claimed, to
  // avoid colliding with other providers' id schemes.
  const claimedPoint = trimmed.startsWith("osm:");
  const pointBody = body.startsWith("@") ? body.slice(1) : claimedPoint ? body : null;
  if (pointBody === null) {
    return null;
  }

  const parts = pointBody.split(",").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  let radiusMeters = DEFAULT_SEARCH_RADIUS_METERS;
  if (parts.length === 3) {
    const parsedRadius = Number(parts[2]);
    if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
      return null;
    }
    radiusMeters = Math.min(parsedRadius, MAX_SEARCH_RADIUS_METERS);
  }

  return { kind: "point", lat, lng, radiusMeters };
}

// Golf and natural feature filters shared by both query shapes. `nwr` matches
// nodes, ways and relations in a single statement.
const FEATURE_SELECTORS = [
  'nwr["golf"]',
  'nwr["leisure"="golf_course"]',
  'nwr["natural"~"^(water|wetland|wood|scrub|tree_row|heath)$"]',
  'nwr["landuse"="forest"]'
];

function areaFilteredBlock(): string {
  return FEATURE_SELECTORS.map((selector) => `  ${selector}(area.searchArea);`).join("\n");
}

function aroundFilteredBlock(lat: number, lng: number, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${lat},${lng})`;
  return FEATURE_SELECTORS.map((selector) => `  ${selector}${around};`).join("\n");
}

/**
 * Build the Overpass QL query for a target. Uses `out geom;` so way/relation
 * geometry is returned inline as coordinate arrays (no separate node
 * resolution required).
 */
export function buildOverpassQuery(target: OsmGeometryTarget, timeoutSeconds = 60): string {
  const header = `[out:json][timeout:${timeoutSeconds}];`;

  if (target.kind === "point") {
    return [
      header,
      "(",
      aroundFilteredBlock(target.lat, target.lng, target.radiusMeters),
      ");",
      "out geom;"
    ].join("\n");
  }

  // Element form: resolve the element to a search area, then pull features
  // contained by it. `map_to_area` works for closed ways and multipolygon
  // relations, which is what a golf_course boundary is.
  return [
    header,
    `${target.elementType}(${target.id});`,
    "map_to_area->.searchArea;",
    "(",
    areaFilteredBlock(),
    ");",
    "out geom;"
  ].join("\n");
}

export type OverpassRequestOptions = {
  endpoint?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

/**
 * Execute an Overpass query. Thin live wrapper kept separate from the pure
 * builders above. Never logs or embeds credentials; Overpass is keyless.
 */
export async function requestOverpass(
  query: string,
  options: OverpassRequestOptions = {}
): Promise<unknown> {
  const endpoint = options.endpoint ?? process.env.OVERPASS_URL ?? DEFAULT_OVERPASS_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": OVERPASS_USER_AGENT
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed with status ${response.status}`);
  }

  return response.json();
}
