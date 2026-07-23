import { NextResponse } from "next/server";
import type { CourseProject, DraftHolePlan } from "../../../../../../packages/course-schema/src";
import { buildCoursePackage } from "../../../../lib/course-package/build-course-package";
import { buildCoursePackageBundle, type BundleArtifact } from "../../../../lib/course-package/course-package-bundle";
import { generateCopernicusElevationModel } from "../../../../lib/elevation/copernicus-glo30-elevation-provider";

type BundleRequest = {
  project?: CourseProject;
  draftHolePlan?: DraftHolePlan | null;
  generatedGeometryStale?: boolean;
  exportedAt?: string;
  /** Client-cached heightmap PNG (base64). When absent, a Copernicus heightmap
   *  is regenerated server-side from the boundary (hybrid path). */
  heightmapPngBase64?: string;
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
