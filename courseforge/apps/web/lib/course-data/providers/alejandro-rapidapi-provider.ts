import type { CourseMetadataProvider } from "../providers";
import type { CourseMetadata, CourseScorecard, CourseSearchResult } from "../types";

export const alejandroRapidApiProvider: CourseMetadataProvider = {
  id: "rapidapi-alejandro99aru",
  name: "RapidAPI Golf Course Database Info by Alejandro99aru",
  enabled: false,
  async searchCourses(): Promise<CourseSearchResult[]> {
    // TODO: Implement server-side metadata lookup after endpoint and terms review.
    // Keep disabled until endpoint mapping is confirmed. Never expose RAPIDAPI_KEY to the browser.
    return [];
  },
  async getCourseMetadata(): Promise<CourseMetadata | null> {
    // TODO: Normalize course metadata; visual geometry should remain a separate provider concern.
    return null;
  },
  async getScorecard(): Promise<CourseScorecard | null> {
    // TODO: Normalize scorecard rows if available.
    return null;
  }
};
