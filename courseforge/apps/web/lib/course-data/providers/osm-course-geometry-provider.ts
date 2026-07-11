import type { CourseGeometryProvider } from "../providers";
import type { CourseGeometry, HoleGeometry } from "../types";

export const osmCourseGeometryProvider: CourseGeometryProvider = {
  id: "osm",
  name: "OpenStreetMap Golf Geometry",
  enabled: false,
  async getCourseGeometry(): Promise<CourseGeometry | null> {
    // TODO: Query and normalize OSM geometry tags:
    // golf=hole, golf=tee, golf=green, golf=fairway, golf=bunker,
    // golf=water_hazard, leisure=golf_course.
    return null;
  },
  async getHoleGeometry(): Promise<HoleGeometry | null> {
    // TODO: Return normalized hole geometry from OSM when enough tagged data exists.
    return null;
  }
};
