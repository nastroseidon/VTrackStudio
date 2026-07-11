import type { CourseGeometryProvider } from "../providers";
import type { CourseGeometry, HoleGeometry } from "../types";

const bridgewaterPartialGeometry: CourseGeometry = {
  courseId: "bridgewater-golf-club",
  source: "mock",
  holes: [
    {
      holeNumber: 1,
      teeBoxes: [{ teeName: "Blue", center: { lat: 41.3373, lng: -85.0472 } }],
      fairways: [],
      greens: [{ points: [{ lat: 41.338, lng: -85.0466 }, { lat: 41.3381, lng: -85.0464 }, { lat: 41.3379, lng: -85.0463 }] }],
      bunkers: [],
      waterHazards: [],
      treeAreas: [],
      cartPaths: [],
      centerline: { points: [{ lat: 41.3373, lng: -85.0472 }, { lat: 41.3378, lng: -85.0465 }] },
      confidence: { overall: 0.34, tees: 0.5, fairways: 0.1, greens: 0.42, hazards: 0.1 }
    }
  ]
};

export const mockCourseGeometryProvider: CourseGeometryProvider = {
  id: "mock-geometry",
  name: "Mock Course Geometry",
  enabled: true,
  async getCourseGeometry(courseId: string): Promise<CourseGeometry | null> {
    if (courseId === bridgewaterPartialGeometry.courseId) {
      return bridgewaterPartialGeometry;
    }

    return null;
  },
  async getHoleGeometry(courseId: string, holeNumber: number): Promise<HoleGeometry | null> {
    const geometry = await this.getCourseGeometry(courseId);

    return geometry?.holes.find((hole) => hole.holeNumber === holeNumber) ?? null;
  }
};
