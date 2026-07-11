import type { CourseGeometryProvider, CourseMetadataProvider } from "./providers";
import type {
  CourseGeometry,
  CourseMetadata,
  CourseScorecard,
  CourseSearchInput,
  CourseSearchResult,
  GeometryStatus
} from "./types";
import { alejandroRapidApiProvider } from "./providers/alejandro-rapidapi-provider";
import { giancarloRapidApiProvider } from "./providers/giancarlo-rapidapi-provider";
import { golfCourseApiProvider } from "./providers/golfcourseapi-provider";
import { mockCourseGeometryProvider } from "./providers/mock-course-geometry-provider";
import { mockCourseMetadataProvider } from "./providers/mock-course-metadata-provider";
import { osmCourseGeometryProvider } from "./providers/osm-course-geometry-provider";
import { ryzeRapidApiProvider } from "./providers/ryze-rapidapi-provider";

const metadataProviders: CourseMetadataProvider[] = [
  mockCourseMetadataProvider,
  golfCourseApiProvider,
  ryzeRapidApiProvider,
  giancarloRapidApiProvider,
  alejandroRapidApiProvider
];

const geometryProviders: CourseGeometryProvider[] = [mockCourseGeometryProvider, osmCourseGeometryProvider];

function resultKey(result: CourseSearchResult) {
  return [result.name, result.city, result.state]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeResults(results: CourseSearchResult[]) {
  const byKey = new Map<string, CourseSearchResult>();

  for (const result of results) {
    const key = resultKey(result);
    const existing = byKey.get(key);

    if (!existing || result.confidence > existing.confidence) {
      byKey.set(key, result);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.confidence - a.confidence);
}

function geometryStatusFromGeometry(geometry: CourseGeometry | null): GeometryStatus {
  if (!geometry || geometry.holes.length === 0) {
    return "missing";
  }

  if (geometry.holes.length >= 18 && geometry.holes.every((hole) => hole.confidence.overall >= 0.75)) {
    return "available";
  }

  return "partial";
}

export class CourseDataService {
  private readonly metadataProviders: CourseMetadataProvider[];
  private readonly geometryProviders: CourseGeometryProvider[];

  constructor(
    providers = metadataProviders.filter((provider) => provider.enabled),
    geometrySources = geometryProviders.filter((provider) => provider.enabled)
  ) {
    this.metadataProviders = providers;
    this.geometryProviders = geometrySources;
  }

  async searchCourses(input: CourseSearchInput): Promise<CourseSearchResult[]> {
    const providerResults = await Promise.all(
      this.metadataProviders.map(async (provider) => provider.searchCourses(input))
    );

    return dedupeResults(providerResults.flat());
  }

  async getCourseMetadata(providerId: string, courseId: string): Promise<CourseMetadata | null> {
    const provider = this.metadataProviders.find((candidate) => candidate.id === providerId);

    if (!provider) {
      return null;
    }

    const metadata = await provider.getCourseMetadata(courseId);

    if (!metadata) {
      return null;
    }

    const scorecard = metadata.scorecard ?? (await this.getScorecard(providerId, courseId)) ?? undefined;
    const geometryStatus = await this.getGeometryStatus(courseId);

    return {
      ...metadata,
      scorecard,
      geometryStatus
    };
  }

  async getScorecard(providerId: string, courseId: string): Promise<CourseScorecard | null> {
    const provider = this.metadataProviders.find((candidate) => candidate.id === providerId);

    return provider?.getScorecard(courseId) ?? null;
  }

  async getCourseGeometry(courseId: string): Promise<CourseGeometry | null> {
    for (const provider of this.geometryProviders) {
      const geometry = await provider.getCourseGeometry(courseId);

      if (geometry) {
        return geometry;
      }
    }

    return null;
  }

  async getGeometryStatus(courseId: string): Promise<GeometryStatus> {
    const geometry = await this.getCourseGeometry(courseId);

    return geometryStatusFromGeometry(geometry);
  }
}

export const courseDataService = new CourseDataService();
