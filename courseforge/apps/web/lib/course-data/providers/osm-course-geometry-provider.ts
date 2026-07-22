import type { CourseGeometryProvider } from "../providers";
import type { CourseGeometry, HoleGeometry } from "../types";
import { buildOverpassQuery, parseOsmCourseId, requestOverpass } from "../osm/overpass";
import { parseOverpassResponse } from "../osm/parse-osm-geometry";

/**
 * Course geometry from OpenStreetMap golf tags via the Overpass API.
 *
 * Owns courseIds of the form `osm:way/<id>`, `osm:relation/<id>`,
 * `osm:node/<id>`, or `osm:@<lat>,<lng>[,<radius>]`. Any other id yields
 * `null`, letting the course-data service fall through to other providers.
 *
 * OSM golf data is licensed under the ODbL; downstream packages must preserve
 * "© OpenStreetMap contributors" attribution (see courseforge/docs).
 */
export const osmCourseGeometryProvider: CourseGeometryProvider = {
  id: "osm",
  name: "OpenStreetMap Golf Geometry",
  enabled: true,
  async getCourseGeometry(courseId: string): Promise<CourseGeometry | null> {
    const target = parseOsmCourseId(courseId);
    if (!target) {
      return null;
    }

    const query = buildOverpassQuery(target);

    let response: unknown;
    try {
      response = await requestOverpass(query);
    } catch {
      // Network/endpoint failures should not break the provider chain; treat
      // as "no OSM geometry available" so other providers can respond.
      return null;
    }

    return parseOverpassResponse(response, courseId);
  },
  async getHoleGeometry(courseId: string, holeNumber: number): Promise<HoleGeometry | null> {
    const geometry = await this.getCourseGeometry(courseId);
    return geometry?.holes.find((hole) => hole.holeNumber === holeNumber) ?? null;
  }
};
