export type GeometryStatus = "available" | "partial" | "missing";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CourseSearchInput {
  query: string;
  location?: LatLng;
  radiusMiles?: number;
}

export interface CourseSearchResult {
  providerId: string;
  providerCourseId: string;
  name: string;
  facilityName?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: LatLng;
  confidence: number;
}

export interface CourseMetadata {
  providerId: string;
  providerCourseId: string;
  name: string;
  facilityName?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location?: LatLng;
  holesCount?: number;
  phone?: string;
  website?: string;
  scorecard?: CourseScorecard;
  geometryStatus: GeometryStatus;
}

export interface CourseScorecard {
  tees: TeeSet[];
  holes: ScorecardHole[];
}

export interface TeeSet {
  id: string;
  name: string;
  color?: string;
  totalYardage?: number;
  courseRating?: number;
  slopeRating?: number;
}

export interface ScorecardHole {
  holeNumber: number;
  par?: number;
  handicapIndex?: number;
  yardagesByTee: Record<string, number>;
}

export interface CourseGeometry {
  courseId: string;
  source: "mock" | "osm" | "manual" | "satellite_assisted" | "commercial";
  holes: HoleGeometry[];
}

export interface HoleGeometry {
  holeNumber: number;
  teeBoxes: TeeBoxGeometry[];
  fairways: PolygonGeometry[];
  greens: PolygonGeometry[];
  bunkers: PolygonGeometry[];
  waterHazards: PolygonGeometry[];
  treeAreas: PolygonGeometry[];
  cartPaths: LineGeometry[];
  centerline?: LineGeometry;
  confidence: GeometryConfidence;
}

export interface TeeBoxGeometry {
  teeName?: string;
  polygon?: PolygonGeometry;
  center?: LatLng;
}

export interface PolygonGeometry {
  points: LatLng[];
}

export interface LineGeometry {
  points: LatLng[];
}

export interface GeometryConfidence {
  overall: number;
  tees: number;
  fairways: number;
  greens: number;
  hazards: number;
}
