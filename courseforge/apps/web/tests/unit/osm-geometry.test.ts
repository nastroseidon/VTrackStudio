import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SEARCH_RADIUS_METERS,
  OVERPASS_USER_AGENT,
  buildOverpassQuery,
  parseOsmCourseId,
  requestOverpass
} from "../../lib/course-data/osm/overpass";
import { parseOverpassResponse } from "../../lib/course-data/osm/parse-osm-geometry";

describe("parseOsmCourseId", () => {
  it("parses element references with and without the osm: prefix", () => {
    expect(parseOsmCourseId("osm:way/123")).toEqual({ kind: "element", elementType: "way", id: 123 });
    expect(parseOsmCourseId("relation/98765")).toEqual({
      kind: "element",
      elementType: "relation",
      id: 98765
    });
    expect(parseOsmCourseId("osm:node/42")).toEqual({ kind: "element", elementType: "node", id: 42 });
  });

  it("parses point references with a default and explicit radius", () => {
    expect(parseOsmCourseId("osm:@56.28,-2.59")).toEqual({
      kind: "point",
      lat: 56.28,
      lng: -2.59,
      radiusMeters: DEFAULT_SEARCH_RADIUS_METERS
    });
    expect(parseOsmCourseId("osm:56.28,-2.59,900")).toEqual({
      kind: "point",
      lat: 56.28,
      lng: -2.59,
      radiusMeters: 900
    });
  });

  it("returns null for ids this provider does not own", () => {
    expect(parseOsmCourseId("bridgewater-golf-club")).toBeNull();
    expect(parseOsmCourseId("56.28,-2.59")).toBeNull(); // bare point, no osm: prefix
    expect(parseOsmCourseId("osm:way/abc")).toBeNull();
    expect(parseOsmCourseId("osm:@200,0")).toBeNull(); // latitude out of range
    expect(parseOsmCourseId("")).toBeNull();
  });
});

describe("buildOverpassQuery", () => {
  it("uses map_to_area for element targets", () => {
    const query = buildOverpassQuery({ kind: "element", elementType: "way", id: 555 });
    expect(query).toContain("way(555);");
    expect(query).toContain("map_to_area->.searchArea;");
    expect(query).toContain("out geom;");
  });

  it("uses an around filter for point targets", () => {
    const query = buildOverpassQuery({ kind: "point", lat: 10, lng: 20, radiusMeters: 800 });
    expect(query).toContain("(around:800,10,20)");
    expect(query).toContain("out geom;");
  });
});

// A tiny synthetic course: two holes, each with a centerline, green, tee,
// fairway and a bunker, positioned so association is unambiguous.
const fixture = {
  elements: [
    {
      type: "way",
      id: 1,
      tags: { golf: "hole", ref: "1", par: "4" },
      geometry: [
        { lat: 56.2800, lon: -2.5900 },
        { lat: 56.2810, lon: -2.5900 }
      ]
    },
    {
      type: "way",
      id: 2,
      tags: { golf: "hole", ref: "2", par: "3" },
      geometry: [
        { lat: 56.2900, lon: -2.5900 },
        { lat: 56.2910, lon: -2.5900 }
      ]
    },
    {
      type: "way",
      id: 10,
      tags: { golf: "green" },
      geometry: [
        { lat: 56.28105, lon: -2.59005 },
        { lat: 56.28108, lon: -2.58995 },
        { lat: 56.28102, lon: -2.58995 },
        { lat: 56.28105, lon: -2.59005 }
      ]
    },
    {
      type: "way",
      id: 11,
      tags: { golf: "tee" },
      geometry: [
        { lat: 56.27998, lon: -2.59003 },
        { lat: 56.28001, lon: -2.58997 },
        { lat: 56.27997, lon: -2.58997 },
        { lat: 56.27998, lon: -2.59003 }
      ]
    },
    {
      type: "way",
      id: 12,
      tags: { golf: "fairway" },
      geometry: [
        { lat: 56.2804, lon: -2.5901 },
        { lat: 56.2806, lon: -2.5899 },
        { lat: 56.2803, lon: -2.5899 },
        { lat: 56.2804, lon: -2.5901 }
      ]
    },
    {
      type: "way",
      id: 13,
      tags: { golf: "bunker" },
      geometry: [
        { lat: 56.29095, lon: -2.59005 },
        { lat: 56.29097, lon: -2.58997 },
        { lat: 56.29093, lon: -2.58997 },
        { lat: 56.29095, lon: -2.59005 }
      ]
    },
    {
      type: "way",
      id: 14,
      tags: { natural: "water" },
      geometry: [
        { lat: 56.2905, lon: -2.5902 },
        { lat: 56.2906, lon: -2.5901 },
        { lat: 56.2904, lon: -2.5901 },
        { lat: 56.2905, lon: -2.5902 }
      ]
    },
    // Non-golf noise that should be ignored for hole grouping.
    { type: "way", id: 99, tags: { leisure: "golf_course", name: "Test Links" }, geometry: [] }
  ]
};

describe("requestOverpass", () => {
  it("sends a descriptive User-Agent (overpass-api.de returns 406 without one)", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await requestOverpass("[out:json];out;", {
      endpoint: "https://example.test/interpreter",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe(OVERPASS_USER_AGENT);
    expect(OVERPASS_USER_AGENT.length).toBeGreaterThan(0);
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 406 }));
    await expect(
      requestOverpass("[out:json];out;", {
        endpoint: "https://example.test/interpreter",
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).rejects.toThrow("406");
  });
});

describe("parseOverpassResponse", () => {
  it("groups features into numbered holes", () => {
    const geometry = parseOverpassResponse(fixture, "osm:@56.285,-2.59");
    expect(geometry).not.toBeNull();
    expect(geometry?.source).toBe("osm");
    expect(geometry?.courseId).toBe("osm:@56.285,-2.59");
    expect(geometry?.holes.map((hole) => hole.holeNumber)).toEqual([1, 2]);

    const holeOne = geometry?.holes[0];
    expect(holeOne?.greens).toHaveLength(1);
    expect(holeOne?.teeBoxes).toHaveLength(1);
    expect(holeOne?.fairways).toHaveLength(1);
    expect(holeOne?.centerline?.points).toHaveLength(2);
    expect(holeOne?.confidence.overall).toBeGreaterThan(0.7);

    const holeTwo = geometry?.holes[1];
    expect(holeTwo?.bunkers).toHaveLength(1);
    expect(holeTwo?.waterHazards).toHaveLength(1);
  });

  it("assigns each feature to its nearest hole centerline", () => {
    const geometry = parseOverpassResponse(fixture, "osm:test");
    const holeOne = geometry?.holes.find((hole) => hole.holeNumber === 1);
    const holeTwo = geometry?.holes.find((hole) => hole.holeNumber === 2);
    // The bunker and water sit by hole 2, not hole 1.
    expect(holeOne?.bunkers).toHaveLength(0);
    expect(holeTwo?.greens).toHaveLength(0);
  });

  it("returns null when no golf=hole centerlines are present", () => {
    const noHoles = { elements: [fixture.elements[2], fixture.elements[3]] };
    expect(parseOverpassResponse(noHoles, "osm:test")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseOverpassResponse(null, "osm:test")).toBeNull();
    expect(parseOverpassResponse({}, "osm:test")).toBeNull();
  });
});
