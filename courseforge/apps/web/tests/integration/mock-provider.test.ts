import { describe, expect, it } from "vitest";
import { CourseDataService } from "../../lib/course-data/course-data-service";
import { mockCourseMetadataProvider } from "../../lib/course-data/providers/mock-course-metadata-provider";

describe("mock provider boundary", () => {
  const service = new CourseDataService([mockCourseMetadataProvider], []);

  it("searches deterministic local provider data without live credentials", async () => {
    const results = await service.searchCourses({ query: "Fort Wayne" });

    expect(results.map((result) => result.name)).toEqual([
      "Cherry Hill Golf Club",
      "Sycamore Hills Golf Club"
    ]);
    expect(results.every((result) => result.providerId === "mock")).toBe(true);
  });

  it("returns metadata and reports missing geometry", async () => {
    const metadata = await service.getCourseMetadata("mock", "cherry-hill-golf-club");

    expect(metadata).toMatchObject({
      name: "Cherry Hill Golf Club",
      holesCount: 18,
      geometryStatus: "missing"
    });
    expect(metadata?.scorecard?.holes).toHaveLength(18);
  });
});
