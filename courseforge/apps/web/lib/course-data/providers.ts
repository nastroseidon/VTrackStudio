import type {
  CourseGeometry,
  CourseMetadata,
  CourseScorecard,
  CourseSearchInput,
  CourseSearchResult,
  HoleGeometry
} from "./types";

export interface CourseMetadataProvider {
  id: string;
  name: string;
  enabled: boolean;
  searchCourses(input: CourseSearchInput): Promise<CourseSearchResult[]>;
  getCourseMetadata(courseId: string): Promise<CourseMetadata | null>;
  getScorecard(courseId: string): Promise<CourseScorecard | null>;
}

export interface CourseGeometryProvider {
  id: string;
  name: string;
  enabled: boolean;
  getCourseGeometry(courseId: string): Promise<CourseGeometry | null>;
  getHoleGeometry(courseId: string, holeNumber: number): Promise<HoleGeometry | null>;
}
