import type { CourseMetadataProvider } from "../providers";
import type { CourseMetadata, CourseScorecard, CourseSearchResult } from "../types";

export const ryzeRapidApiProvider: CourseMetadataProvider = {
  id: "rapidapi-foshesco",
  name: "RapidAPI Golf Course API by foshesco",
  enabled: false,
  async searchCourses(): Promise<CourseSearchResult[]> {
    // TODO: Implement server-side RapidAPI metadata search after endpoint and terms review.
    // Keep disabled until host/path/query mapping is confirmed. Never expose RAPIDAPI_KEY to the browser.
    return [];
  },
  async getCourseMetadata(): Promise<CourseMetadata | null> {
    // TODO: Normalize metadata only; do not assume this provider supplies visual hole polygons.
    return null;
  },
  async getScorecard(): Promise<CourseScorecard | null> {
    // TODO: Normalize scorecard metadata if available.
    return null;
  }
};
