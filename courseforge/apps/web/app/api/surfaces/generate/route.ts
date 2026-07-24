import { NextResponse } from "next/server";
import { courseDataService } from "../../../../lib/course-data/course-data-service";
import { fetchWorldCoverClassGrid } from "../../../../lib/surfaces/worldcover/fetch-worldcover";
import { worldCoverSourceId } from "../../../../lib/surfaces/worldcover/worldcover-tiles";
import { generateCourseSplatMap } from "../../../../lib/surfaces/generate-splat";
import type { CourseHeightmapRaster } from "../../../../../../packages/course-schema/src";

type SurfacesGenerateRequest = {
  /** Provider course id owning the geometry, e.g. `osm:way/123` or a mock id. */
  courseId?: string;
  /** The heightmap's grid — the splat must share it so Unreal binds both to one Landscape. */
  grid?: {
    width: number;
    height: number;
    bounds: { south: number; west: number; north: number; east: number };
    localGrid?: CourseHeightmapRaster["localGrid"];
  };
};

export async function POST(request: Request) {
  let body: SurfacesGenerateRequest;
  try {
    body = (await request.json()) as SurfacesGenerateRequest;
  } catch {
    return NextResponse.json({ error: "Surfaces request body could not be read." }, { status: 400 });
  }

  if (!body.courseId) {
    return NextResponse.json({ error: "No courseId was provided." }, { status: 400 });
  }
  const grid = body.grid;
  if (!grid || !grid.bounds || !grid.width || !grid.height) {
    return NextResponse.json(
      { error: "Generate a terrain heightmap first — the surface grid must match it." },
      { status: 400 }
    );
  }

  const geometry = await courseDataService.getCourseGeometry(body.courseId);
  if (!geometry) {
    return NextResponse.json(
      { error: `No course geometry available for "${body.courseId}".` },
      { status: 404 }
    );
  }

  try {
    // Live keyless WorldCover fetch (approved provider); OSM polygons win over it.
    const classGrid = await fetchWorldCoverClassGrid(grid.bounds);
    const generated = generateCourseSplatMap({
      geometry,
      grid: { width: grid.width, height: grid.height, bounds: grid.bounds },
      classGrid,
      landCoverSource: worldCoverSourceId(),
      localGrid: grid.localGrid
    });

    // Descriptor plus base64 layer bytes so the client can cache them for an
    // instant bundle export (same pattern as the heightmap).
    const layersBase64: Record<string, string> = {};
    for (const layer of generated.layers) {
      layersBase64[layer.name] = Buffer.from(layer.bytes).toString("base64");
    }

    return NextResponse.json({ splat: generated.splat, coverage: generated.coverage, layersBase64 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Surface layers could not be generated.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
