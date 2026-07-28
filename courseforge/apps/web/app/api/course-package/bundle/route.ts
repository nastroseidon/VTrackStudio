import { NextResponse } from "next/server";
import type { CourseProject, DraftHolePlan } from "../../../../../../packages/course-schema/src";
import { buildCoursePackage } from "../../../../lib/course-package/build-course-package";
import { buildCoursePackageBundle, type BundleArtifact } from "../../../../lib/course-package/course-package-bundle";
import { generateCopernicusElevationModel } from "../../../../lib/elevation/copernicus-glo30-elevation-provider";
import { courseDataService } from "../../../../lib/course-data/course-data-service";
import { fetchWorldCoverClassGrid } from "../../../../lib/surfaces/worldcover/fetch-worldcover";
import { worldCoverSourceId } from "../../../../lib/surfaces/worldcover/worldcover-tiles";
import { generateCourseSplatMap } from "../../../../lib/surfaces/generate-splat";

type BundleRequest = {
  project?: CourseProject;
  draftHolePlan?: DraftHolePlan | null;
  generatedGeometryStale?: boolean;
  exportedAt?: string;
  /** Client-cached heightmap PNG (base64). When absent, a Copernicus heightmap
   *  is regenerated server-side from the boundary (hybrid path). */
  heightmapPngBase64?: string;
  /** Client-cached surface layer PNGs (base64 by layer name). When absent and
   *  the project carries a surfaces descriptor, layers are regenerated
   *  server-side (live WorldCover + provider geometry). */
  surfaceLayersBase64?: Record<string, string>;
};

export async function POST(request: Request) {
  let body: BundleRequest;
  try {
    body = (await request.json()) as BundleRequest;
  } catch {
    return NextResponse.json({ error: "Bundle request body could not be read." }, { status: 400 });
  }

  if (!body.project) {
    return NextResponse.json({ error: "No course project was provided." }, { status: 400 });
  }

  const exportedAt = body.exportedAt ?? new Date().toISOString();
  const coursePackage = buildCoursePackage(
    body.project,
    body.draftHolePlan ?? null,
    body.generatedGeometryStale ?? false,
    exportedAt
  );

  const artifacts: BundleArtifact[] = [];
  const heightmap = coursePackage.elevation?.heightmap;
  if (heightmap) {
    let bytes: Uint8Array | null = null;
    if (body.heightmapPngBase64) {
      // Fast path: client-cached bytes from the generation step.
      bytes = new Uint8Array(Buffer.from(body.heightmapPngBase64, "base64"));
    } else if (coursePackage.elevation?.source === "copernicus_glo30" && body.project.boundary) {
      // Fallback: regenerate from the boundary (a live Copernicus fetch).
      try {
        const { heightmapBytes } = await generateCopernicusElevationModel(body.project.boundary);
        bytes = heightmapBytes;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Heightmap could not be regenerated for the bundle.";
        return NextResponse.json({ error: message }, { status: 503 });
      }
    }
    if (bytes && bytes.byteLength > 0) {
      artifacts.push({ path: heightmap.artifact.path, bytes });
    }
  }

  const surfaces = coursePackage.surfaces;
  if (surfaces) {
    const provided = body.surfaceLayersBase64 ?? {};
    const missing = surfaces.layers.filter((layer) => !provided[layer.name]);

    if (missing.length === 0) {
      for (const layer of surfaces.layers) {
        artifacts.push({
          path: layer.artifact.path,
          bytes: new Uint8Array(Buffer.from(provided[layer.name], "base64"))
        });
      }
    } else if (body.project.providerCourseId) {
      // Fallback: regenerate on the same grid (live WorldCover + provider geometry).
      try {
        const geometry = await courseDataService.getCourseGeometry(body.project.providerCourseId);
        if (!geometry) {
          throw new Error(`No course geometry available for "${body.project.providerCourseId}".`);
        }
        const classGrid = await fetchWorldCoverClassGrid(surfaces.bounds);
        const regenerated = generateCourseSplatMap({
          geometry,
          grid: { width: surfaces.width, height: surfaces.height, bounds: surfaces.bounds },
          classGrid,
          landCoverSource: worldCoverSourceId(),
          localGrid: surfaces.localGrid
        });
        // Keep descriptor and bytes consistent in the exported package.
        coursePackage.surfaces = regenerated.splat;
        for (const layer of regenerated.layers) {
          artifacts.push({ path: layer.path, bytes: layer.bytes });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Surface layers could not be regenerated for the bundle.";
        return NextResponse.json({ error: message }, { status: 503 });
      }
    } else {
      return NextResponse.json(
        { error: "Surface layer bytes are unavailable and no provider course id is set to regenerate them." },
        { status: 409 }
      );
    }
  }

  const zip = buildCoursePackageBundle(coursePackage, artifacts);

  return new NextResponse(Buffer.from(zip), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="course-bundle.zip"',
      "cache-control": "no-store"
    }
  });
}
