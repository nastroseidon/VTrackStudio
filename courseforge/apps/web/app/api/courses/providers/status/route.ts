import { NextResponse } from "next/server";
import { getCourseDataProviderStatuses } from "../../../../../lib/course-data/provider-status";

export async function GET() {
  return NextResponse.json(getCourseDataProviderStatuses());
}
