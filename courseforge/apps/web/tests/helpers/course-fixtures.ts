import type { CourseProject, DraftHolePlan } from "../../../../packages/course-schema/src";

export const generatedAt = "2026-01-02T03:04:05.000Z";

export function createDraftHolePlan(): DraftHolePlan {
  return {
    generatedAt,
    source: "placeholder",
    holes: [
      {
        holeNumber: 1,
        par: 4,
        yardagesByTee: { blue: 410 },
        status: "approved",
        confidence: "low",
        trace: {
          teePoint: { latitude: 41.194, longitude: -85.048 },
          centerlinePoints: [{ latitude: 41.195, longitude: -85.047 }],
          greenPoint: { latitude: 41.196, longitude: -85.046 },
          source: "manual",
          confidence: 0.8
        }
      }
    ]
  };
}

export function createProject(): CourseProject {
  return {
    id: "test-course",
    name: "Test Course",
    city: "Fort Wayne",
    region: "IN",
    location: { latitude: 41.195, longitude: -85.047 },
    confidence: 0.9,
    status: {
      courseConfirmed: true,
      locationConfirmed: true,
      boundaryConfirmed: true,
      scorecardConfirmed: false,
      holesTraced: true,
      elevationGenerated: false,
      packageExported: false
    },
    boundary: {
      type: "Polygon",
      source: "manual",
      coordinates: [[
        [-85.049, 41.193],
        [-85.045, 41.193],
        [-85.045, 41.197],
        [-85.049, 41.197],
        [-85.049, 41.193]
      ]]
    }
  };
}
