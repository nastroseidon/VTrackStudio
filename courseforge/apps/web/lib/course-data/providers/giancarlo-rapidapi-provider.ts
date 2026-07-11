import type { CourseMetadataProvider } from "../providers";
import type { CourseMetadata, CourseScorecard, CourseSearchResult } from "../types";

export const giancarloRapidApiProvider: CourseMetadataProvider = {
  id: "rapidapi-giancarlo",
  name: "RapidAPI Golf Courses API by giancarlo",
  enabled: false,
  async searchCourses(): Promise<CourseSearchResult[]> {
    // TODO: Implement server-side metadata search after endpoint and terms review.
    // Keep disabled until endpoint mapping is confirmed. Never expose RAPIDAPI_KEY to the browser.
    return [];
  },
  async getCourseMetadata(): Promise<CourseMetadata | null> {
    // TODO: Normalize provider data into CourseMetadata.
    return null;
  },
  async getScorecard(): Promise<CourseScorecard | null> {
    // TODO: Normalize tee sets and hole rows if supplied.
    return null;
  }
};
