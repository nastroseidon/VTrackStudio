import { NextResponse } from "next/server";
import { courseDataService } from "../../../../lib/course-data/course-data-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  const results = await courseDataService.searchCourses({ query });

  return NextResponse.json(results);
}
