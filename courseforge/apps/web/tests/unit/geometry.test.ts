import { describe, expect, it } from "vitest";
import {
  createCorridorAroundTrace,
  createGreenAroundPoint,
  createTeeBoxAroundPoint,
  generateHoleGeometryFromTrace
} from "../../lib/geometry/generate-basic-hole-geometry";
import { createDraftHolePlan, generatedAt } from "../helpers/course-fixtures";

describe("basic hole geometry", () => {
  it("creates closed tee and green polygons", () => {
    const point = { latitude: 41.194, longitude: -85.048 };
    const tee = createTeeBoxAroundPoint(point);
    const green = createGreenAroundPoint(point, 4);

    expect(tee.coordinates[0]).toHaveLength(5);
    expect(green.coordinates[0]).toHaveLength(19);
    expect(tee.coordinates[0][0]).toEqual(tee.coordinates[0].at(-1));
    expect(green.coordinates[0][0]).toEqual(green.coordinates[0].at(-1));
  });

  it("requires at least two points for a fairway corridor", () => {
    expect(createCorridorAroundTrace([{ latitude: 41, longitude: -85 }])).toBeUndefined();
  });

  it("generates deterministic metadata for a completed trace", () => {
    const geometry = generateHoleGeometryFromTrace(createDraftHolePlan().holes[0], generatedAt);

    expect(geometry).toMatchObject({
      holeNumber: 1,
      source: "trace_generated",
      generatedAt,
      confidence: 0.72
    });
    expect(geometry?.fairway?.coordinates[0][0]).toEqual(geometry?.fairway?.coordinates[0].at(-1));
  });
});
