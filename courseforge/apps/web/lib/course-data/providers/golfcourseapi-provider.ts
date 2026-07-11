import type { CourseMetadataProvider } from "../providers";
import type { CourseMetadata, CourseScorecard, CourseSearchResult } from "../types";

export const golfCourseApiProvider: CourseMetadataProvider = {
  id: "golfcourseapi",
  name: "GolfCourseAPI",
  enabled: false,
  async searchCourses(): Promise<CourseSearchResult[]> {
    // TODO: Implement server-side GolfCourseAPI requests after endpoint mapping and license review.
    // Keep disabled until response shapes are confirmed. Never expose GOLFCOURSEAPI_KEY to the browser.
    return [];
  },
  async getCourseMetadata(): Promise<CourseMetadata | null> {
    // TODO: Normalize GolfCourseAPI course metadata server-side without exposing GOLFCOURSEAPI_KEY.
    return null;
  },
  async getScorecard(): Promise<CourseScorecard | null> {
    // TODO: Normalize scorecard data when the provider response shape is confirmed.
    return null;
  }
};
