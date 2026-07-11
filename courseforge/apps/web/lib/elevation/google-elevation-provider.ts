import type {
  CourseElevationModel,
  CourseProject,
  DraftHole,
  DraftHolePlan,
  ElevationPoint,
  HoleElevationProfile,
  TracePoint
} from "../../../../packages/course-schema/src";

const googleElevationEndpoint = "https://maps.googleapis.com/maps/api/elevation/json";
const maxElevationSamples = 240;
const batchSize = 100;

type GoogleElevationResult = {
  elevation: number;
  location: {
    lat: number;
    lng: number;
  };
  resolution?: number;
};

type GoogleElevationResponse = {
  results?: GoogleElevationResult[];
  status: string;
  error_message?: string;
};

type NamedSamplePoint = {
  kind: "boundary" | "hole";
  holeNumber?: number;
  point: TracePoint;
};

export type ElevationProviderStatus = {
  id: "mock" | "google_elevation";
  name: string;
  enabled: boolean;
  reason?: string;
};

export function getGoogleElevationProviderStatus(): ElevationProviderStatus {
  return {
    id: "google_elevation",
    name: "Google Elevation",
    enabled: Boolean(process.env.GOOGLE_MAPS_SERVER_API_KEY),
    reason: process.env.GOOGLE_MAPS_SERVER_API_KEY ? undefined : "Missing GOOGLE_MAPS_SERVER_API_KEY"
  };
}

function boundarySamples(project: CourseProject): NamedSamplePoint[] {
  const ring = project.boundary?.coordinates[0] ?? [];
  const openRing = ring.length > 1 ? ring.slice(0, -1) : ring;
  const samples: NamedSamplePoint[] = [];

  openRing.forEach(([lng, lat], index) => {
    samples.push({
      kind: "boundary",
      point: { latitude: lat, longitude: lng }
    });

    const next = openRing[index + 1] ?? openRing[0];

    if (next) {
      samples.push({
        kind: "boundary",
        point: {
          latitude: (lat + next[1]) / 2,
          longitude: (lng + next[0]) / 2
        }
      });
    }
  });

  return samples;
}

function traceSamples(hole: DraftHole): NamedSamplePoint[] {
  if (!hole.trace) {
    return [];
  }

  const tracePoints = [
    hole.trace.teePoint,
    ...hole.trace.centerlinePoints,
    hole.trace.greenPoint
  ].filter((point): point is TracePoint => Boolean(point));

  return tracePoints.map((point) => ({
    kind: "hole",
    holeNumber: hole.holeNumber,
    point
  }));
}

function collectSamplePoints(project: CourseProject, draftHolePlan: DraftHolePlan | null) {
  return [
    ...boundarySamples(project),
    ...(draftHolePlan?.holes.flatMap(traceSamples) ?? [])
  ];
}

function toElevationPoint(result: GoogleElevationResult): ElevationPoint {
  return {
    lat: result.location.lat,
    lng: result.location.lng,
    elevationMeters: Number(result.elevation.toFixed(2))
  };
}

async function fetchElevationBatch(points: NamedSamplePoint[], apiKey: string) {
  const locations = points
    .map((sample) => `${sample.point.latitude.toFixed(7)},${sample.point.longitude.toFixed(7)}`)
    .join("|");
  const url = `${googleElevationEndpoint}?locations=${encodeURIComponent(locations)}&key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Google Elevation request failed.");
    }

    const data = (await response.json()) as GoogleElevationResponse;

    if (data.status !== "OK") {
      throw new Error(data.status === "REQUEST_DENIED" ? "Google Elevation request was denied." : "Google Elevation returned no usable results.");
    }

    return data.results?.map(toElevationPoint) ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildHoleProfile(holeNumber: number, samplePoints: ElevationPoint[]): HoleElevationProfile {
  const elevations = samplePoints.map((point) => point.elevationMeters);
  const teeElevationMeters = samplePoints[0]?.elevationMeters;
  const greenElevationMeters = samplePoints[samplePoints.length - 1]?.elevationMeters;

  return {
    holeNumber,
    teeElevationMeters,
    greenElevationMeters,
    minElevationMeters: elevations.length ? Math.min(...elevations) : undefined,
    maxElevationMeters: elevations.length ? Math.max(...elevations) : undefined,
    elevationChangeMeters:
      teeElevationMeters !== undefined && greenElevationMeters !== undefined
        ? Number((greenElevationMeters - teeElevationMeters).toFixed(2))
        : undefined,
    samplePoints
  };
}

export async function generateGoogleElevationModel(
  project: CourseProject,
  draftHolePlan: DraftHolePlan | null,
  generatedAt = new Date().toISOString()
): Promise<CourseElevationModel> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

  if (!apiKey) {
    throw new Error("Google Elevation requires GOOGLE_MAPS_SERVER_API_KEY in .env.local.");
  }

  const allSamples = collectSamplePoints(project, draftHolePlan);
  const cappedSamples = allSamples.slice(0, maxElevationSamples);
  const warnings: string[] = [
    "Elevation samples are included, but no terrain heightmap is generated yet."
  ];

  if (allSamples.length > cappedSamples.length) {
    warnings.push(`Elevation samples were capped at ${maxElevationSamples} points for this request.`);
  }

  if (!draftHolePlan?.holes.some((hole) => hole.trace)) {
    warnings.push("No saved hole traces were available for hole elevation profiles.");
  }

  if (!project.generatedGeometry?.holes.length) {
    warnings.push("Generated geometry preview is missing; elevation was sampled from boundary and traces only.");
  }

  const elevationPoints: ElevationPoint[] = [];

  for (let index = 0; index < cappedSamples.length; index += batchSize) {
    const batch = cappedSamples.slice(index, index + batchSize);
    elevationPoints.push(...(await fetchElevationBatch(batch, apiKey)));
  }

  const boundaryPointCount = cappedSamples.filter((sample) => sample.kind === "boundary").length;
  const boundarySamplePoints = elevationPoints.slice(0, boundaryPointCount);
  const holeProfiles = new Map<number, ElevationPoint[]>();

  cappedSamples.slice(boundaryPointCount).forEach((sample, index) => {
    if (sample.kind !== "hole" || sample.holeNumber === undefined) {
      return;
    }

    const profilePoints = holeProfiles.get(sample.holeNumber) ?? [];
    const elevationPoint = elevationPoints[boundaryPointCount + index];

    if (elevationPoint) {
      profilePoints.push(elevationPoint);
      holeProfiles.set(sample.holeNumber, profilePoints);
    }
  });

  const profiles = [...holeProfiles.entries()].map(([holeNumber, samplePoints]) =>
    buildHoleProfile(holeNumber, samplePoints)
  );
  const allElevations = elevationPoints.map((point) => point.elevationMeters);

  return {
    source: "google_elevation",
    status: "sampled",
    generatedAt,
    boundarySamplePoints,
    holeProfiles: profiles,
    minElevationMeters: allElevations.length ? Math.min(...allElevations) : undefined,
    maxElevationMeters: allElevations.length ? Math.max(...allElevations) : undefined,
    warnings
  };
}
