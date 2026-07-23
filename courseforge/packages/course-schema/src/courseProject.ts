export type ConfidenceScore = number;

export type CourseLocation = {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
};

export type CourseBoundary = {
  type: "Polygon";
  coordinates: Array<Array<[longitude: number, latitude: number]>>;
  confidence?: ConfidenceScore;
  source?: "auto" | "manual";
};

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: Array<Array<[longitude: number, latitude: number]>>;
};

export type GeneratedHoleGeometry = {
  holeNumber: number;
  source: "trace_generated";
  teeBox?: PolygonGeometry;
  fairway?: PolygonGeometry;
  green?: PolygonGeometry;
  rough?: PolygonGeometry;
  generatedAt: string;
  confidence: ConfidenceScore;
};

export type GeneratedCourseGeometry = {
  source: "trace_generated";
  generatedAt: string;
  holes: GeneratedHoleGeometry[];
};

export type ElevationStatus = "missing" | "mock" | "sampled" | "generated" | "stale" | "error";

export type ElevationPoint = {
  lat: number;
  lng: number;
  elevationMeters: number;
};

export type HoleElevationProfile = {
  holeNumber: number;
  teeElevationMeters?: number;
  greenElevationMeters?: number;
  minElevationMeters?: number;
  maxElevationMeters?: number;
  elevationChangeMeters?: number;
  samplePoints: ElevationPoint[];
};

// Engine-neutral descriptor for a 16-bit heightmap raster derived from an open
// DEM (Phase 2 of the Automat port; see courseforge/docs/PHASE2_DEM_HEIGHTMAP_DESIGN.md).
// The raster bytes are a separate packaged artifact, referenced here by path +
// hash, never inlined. The 16-bit sample range maps linearly onto
// [minElevationMeters, maxElevationMeters], giving the importer a vertical scale.
export type CourseHeightmapRaster = {
  format: "png-16" | "raw-u16";
  width: number;
  height: number;
  metersPerPixel: number;
  minElevationMeters: number;
  maxElevationMeters: number;
  nodataPolicy: "clampToMin" | "fillNearest";
  crs: "EPSG:4326";
  bounds: { south: number; west: number; north: number; east: number };
  // Optional local metric grid (equirectangular ENU centred on the bbox) so the
  // importer can place the Landscape in metres without reprojecting at import.
  localGrid?: {
    originLat: number;
    originLng: number;
    widthMeters: number;
    heightMeters: number;
    metersPerPixelX: number;
    metersPerPixelY: number;
  };
  artifact: {
    path: string;
    byteLength: number;
    sha256: string;
  };
  attribution: string;
};

export type CourseElevationModel = {
  source: "mock" | "google_elevation" | "earth_engine" | "usgs" | "usgs_3dep" | "copernicus_glo30" | "manual";
  status: ElevationStatus;
  generatedAt: string;
  boundarySamplePoints: ElevationPoint[];
  holeProfiles: HoleElevationProfile[];
  minElevationMeters?: number;
  maxElevationMeters?: number;
  // Optional raster heightmap (Phase 2). Absent for legacy point-sample models.
  heightmap?: CourseHeightmapRaster;
  warnings: string[];
};

export type CoursePackageWarning = {
  code: string;
  message: string;
};

export type CoursePackage = {
  packageVersion: "0.1.0";
  exportedAt: string;
  source: "courseforge";
  course: {
    name: string;
    providerId?: string;
    providerCourseId?: string;
    location: CourseLocation;
    originalLocation?: CourseLocation;
    boundary?: CourseBoundary;
    holesCount?: number;
  };
  scorecard?: {
    confirmed: boolean;
    tees: CourseProjectTeeSet[];
    holes: CourseProjectScorecardHole[];
  };
  holes: Array<{
    holeNumber: number;
    par?: number;
    handicapIndex?: number;
    yardagesByTee?: Record<string, number>;
    trace?: DraftHoleTrace;
    generatedGeometry?: GeneratedHoleGeometry;
    status: DraftHole["status"];
    confidence: DraftHole["confidence"];
  }>;
  geometry: {
    source?: GeneratedCourseGeometry["source"];
    generatedAt?: string;
    stale: boolean;
    holes: GeneratedHoleGeometry[];
  };
  elevation?: CourseElevationModel;
  metadata: {
    geometryStatus?: CourseProjectGeometryStatus;
    locationSource?: CourseProject["locationSource"];
    boundarySource?: CourseBoundary["source"];
    warnings: CoursePackageWarning[];
    limitations: string[];
  };
};

export type CourseProjectStatus = {
  courseConfirmed: boolean;
  locationConfirmed: boolean;
  boundaryConfirmed: boolean;
  scorecardConfirmed: boolean;
  holesTraced: boolean;
  elevationGenerated: boolean;
  packageExported: boolean;
};

export type CourseProjectGeometryStatus = "available" | "partial" | "missing";

export type CourseProjectTeeSet = {
  id: string;
  name: string;
  color?: string;
  totalYardage?: number;
  courseRating?: number;
  slopeRating?: number;
};

export type CourseProjectScorecardHole = {
  holeNumber: number;
  par?: number;
  handicapIndex?: number;
  yardagesByTee: Record<string, number>;
};

export type CourseProjectScorecard = {
  tees: CourseProjectTeeSet[];
  holes: CourseProjectScorecardHole[];
};

export type DraftHole = {
  holeNumber: number;
  par?: number;
  yardagesByTee?: Record<string, number>;
  status: "needs tracing" | "tracing" | "trace saved" | "approved" | "needs review";
  confidence: "low";
  trace?: DraftHoleTrace;
};

export type TracePoint = {
  latitude: number;
  longitude: number;
};

export type DraftHoleTrace = {
  teePoint?: TracePoint;
  centerlinePoints: TracePoint[];
  greenPoint?: TracePoint;
  source: "manual";
  confidence: number;
};

export type DraftHolePlan = {
  generatedAt: string;
  source: "scorecard" | "placeholder";
  holes: DraftHole[];
};

export type CourseProject = {
  id: string;
  name: string;
  city: string;
  region: string;
  location: CourseLocation;
  originalLocation?: CourseLocation;
  locationSource?: "provider" | "mock" | "user_adjusted";
  confidence: ConfidenceScore;
  status: CourseProjectStatus;
  source?: "mock-map-selection" | "provider-import";
  providerId?: string;
  providerCourseId?: string;
  importedMetadata?: unknown;
  scorecard?: CourseProjectScorecard;
  geometryStatus?: CourseProjectGeometryStatus;
  holesCount?: number;
  boundary?: CourseBoundary;
  generatedGeometry?: GeneratedCourseGeometry;
  elevationModel?: CourseElevationModel;
};
