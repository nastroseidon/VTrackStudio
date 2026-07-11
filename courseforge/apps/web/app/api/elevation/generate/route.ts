import { NextResponse } from "next/server";
import type { CourseProject, DraftHolePlan } from "../../../../../../packages/course-schema/src";
import { generateMockElevationProfile } from "../../../../lib/elevation/elevation-service";
import { generateGoogleElevationModel } from "../../../../lib/elevation/google-elevation-provider";

type ElevationGenerateRequest = {
  project?: CourseProject;
  draftHolePlan?: DraftHolePlan | null;
  source?: "mock" | "google_elevation";
};

export async function POST(request: Request) {
  let body: ElevationGenerateRequest;

  try {
    body = (await request.json()) as ElevationGenerateRequest;
  } catch {
    return NextResponse.json({ error: "Elevation request body could not be read." }, { status: 400 });
  }

  if (!body.project) {
    return NextResponse.json({ error: "No course project was provided." }, { status: 400 });
  }

  if (!body.project.status.boundaryConfirmed || !body.project.boundary) {
    return NextResponse.json(
      { error: "Confirm a course boundary before generating elevation." },
      { status: 400 }
    );
  }

  if (body.source === "google_elevation") {
    try {
      const elevationModel = await generateGoogleElevationModel(body.project, body.draftHolePlan ?? null);

      return NextResponse.json(elevationModel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Elevation profile could not be generated.";

      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  const result = generateMockElevationProfile(body.project, body.draftHolePlan ?? null);

  if (!result.elevationModel) {
    return NextResponse.json(
      { error: result.warnings[0] ?? "Mock elevation profile could not be generated." },
      { status: 400 }
    );
  }

  return NextResponse.json(result.elevationModel);
}
