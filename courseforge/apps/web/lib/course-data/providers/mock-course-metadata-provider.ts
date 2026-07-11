import type { CourseMetadataProvider } from "../providers";
import type { CourseMetadata, CourseScorecard, CourseSearchInput, CourseSearchResult } from "../types";

const scorecards: Record<string, CourseScorecard> = {
  "cherry-hill-golf-club": {
    tees: [
      { id: "black", name: "Black", color: "Black", totalYardage: 6818, courseRating: 73.5, slopeRating: 137 },
      { id: "blue", name: "Blue", color: "Blue", totalYardage: 6334, courseRating: 71.2, slopeRating: 131 },
      { id: "white", name: "White", color: "White", totalYardage: 5850, courseRating: 68.8, slopeRating: 124 }
    ],
    holes: Array.from({ length: 18 }, (_, index) => ({
      holeNumber: index + 1,
      par: [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4][index],
      handicapIndex: index + 1,
      yardagesByTee: {
        black: [420, 548, 188, 410, 392, 176, 532, 441, 405, 416, 194, 557, 431, 389, 172, 536, 425, 386][index],
        blue: [398, 520, 171, 388, 365, 158, 505, 415, 381, 392, 176, 528, 405, 363, 154, 512, 399, 344][index],
        white: [370, 492, 145, 356, 338, 139, 475, 382, 351, 360, 151, 499, 376, 335, 132, 480, 366, 303][index]
      }
    }))
  },
  "sycamore-hills-golf-club": {
    tees: [
      { id: "gold", name: "Gold", color: "Gold", totalYardage: 7275, courseRating: 75.9, slopeRating: 149 },
      { id: "blue", name: "Blue", color: "Blue", totalYardage: 6812, courseRating: 73.5, slopeRating: 142 },
      { id: "white", name: "White", color: "White", totalYardage: 6241, courseRating: 70.6, slopeRating: 134 }
    ],
    holes: Array.from({ length: 18 }, (_, index) => ({
      holeNumber: index + 1,
      par: [4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4][index],
      handicapIndex: index + 1,
      yardagesByTee: {
        gold: [445, 575, 430, 205, 425, 410, 560, 198, 435, 420, 438, 189, 590, 452, 410, 202, 565, 426][index],
        blue: [420, 548, 405, 188, 399, 386, 532, 176, 409, 397, 412, 171, 561, 426, 387, 184, 538, 380][index],
        white: [388, 515, 370, 162, 365, 352, 498, 151, 376, 364, 379, 148, 526, 391, 354, 160, 505, 337][index]
      }
    }))
  },
  "bridgewater-golf-club": {
    tees: [
      { id: "black", name: "Black", color: "Black", totalYardage: 7230, courseRating: 75.2, slopeRating: 144 },
      { id: "blue", name: "Blue", color: "Blue", totalYardage: 6710, courseRating: 72.6, slopeRating: 136 },
      { id: "white", name: "White", color: "White", totalYardage: 6155, courseRating: 69.8, slopeRating: 128 }
    ],
    holes: Array.from({ length: 18 }, (_, index) => ({
      holeNumber: index + 1,
      par: [4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4][index],
      handicapIndex: index + 1,
      yardagesByTee: {
        black: [428, 412, 580, 192, 436, 401, 184, 555, 430, 422, 571, 205, 443, 398, 415, 178, 560, 420][index],
        blue: [401, 389, 548, 174, 411, 376, 166, 526, 402, 397, 540, 187, 417, 371, 389, 160, 530, 326][index],
        white: [369, 356, 510, 151, 379, 344, 142, 492, 369, 365, 505, 162, 384, 339, 356, 138, 497, 297][index]
      }
    }))
  }
};

const metadata: CourseMetadata[] = [
  {
    providerId: "mock",
    providerCourseId: "cherry-hill-golf-club",
    name: "Cherry Hill Golf Club",
    facilityName: "Cherry Hill Golf Club",
    address: { city: "Fort Wayne", state: "IN", country: "US" },
    location: { lat: 41.1942, lng: -85.0477 },
    holesCount: 18,
    website: "https://example.com/cherry-hill",
    scorecard: scorecards["cherry-hill-golf-club"],
    geometryStatus: "missing"
  },
  {
    providerId: "mock",
    providerCourseId: "sycamore-hills-golf-club",
    name: "Sycamore Hills Golf Club",
    facilityName: "Sycamore Hills Golf Club",
    address: { city: "Fort Wayne", state: "IN", country: "US" },
    location: { lat: 41.068, lng: -85.3114 },
    holesCount: 18,
    website: "https://example.com/sycamore-hills",
    scorecard: scorecards["sycamore-hills-golf-club"],
    geometryStatus: "missing"
  },
  {
    providerId: "mock",
    providerCourseId: "bridgewater-golf-club",
    name: "Bridgewater Golf Club",
    facilityName: "Bridgewater Golf Club",
    address: { city: "Auburn", state: "IN", country: "US" },
    location: { lat: 41.3378, lng: -85.0465 },
    holesCount: 18,
    website: "https://example.com/bridgewater",
    scorecard: scorecards["bridgewater-golf-club"],
    geometryStatus: "partial"
  }
];

function matchesQuery(course: CourseMetadata, query: string) {
  const haystack = [
    course.name,
    course.facilityName,
    course.address?.city,
    course.address?.state,
    course.address?.country
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part)) || haystack.includes(query.toLowerCase());
}

export const mockCourseMetadataProvider: CourseMetadataProvider = {
  id: "mock",
  name: "Mock Course Metadata",
  enabled: true,
  async searchCourses(input: CourseSearchInput): Promise<CourseSearchResult[]> {
    const query = input.query.trim();
    const filtered = query ? metadata.filter((course) => matchesQuery(course, query)) : metadata;

    return filtered.map((course) => ({
      providerId: course.providerId,
      providerCourseId: course.providerCourseId,
      name: course.name,
      facilityName: course.facilityName,
      city: course.address?.city,
      state: course.address?.state,
      country: course.address?.country,
      location: course.location,
      confidence: query ? 0.9 : 0.75
    }));
  },
  async getCourseMetadata(courseId: string): Promise<CourseMetadata | null> {
    return metadata.find((course) => course.providerCourseId === courseId) ?? null;
  },
  async getScorecard(courseId: string): Promise<CourseScorecard | null> {
    return scorecards[courseId] ?? null;
  }
};
