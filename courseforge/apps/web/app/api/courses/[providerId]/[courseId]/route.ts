import { NextResponse } from "next/server";
import { courseDataService } from "../../../../../lib/course-data/course-data-service";

type CourseRouteContext = {
  params: Promise<{
    providerId: string;
    courseId: string;
  }>;
};

export async function GET(_request: Request, context: CourseRouteContext) {
  const { providerId, courseId } = await context.params;
  const metadata = await courseDataService.getCourseMetadata(providerId, courseId);

  if (!metadata) {
    return NextResponse.json({ message: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(metadata);
}
