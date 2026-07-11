import { NextResponse } from "next/server";
import { getGoogleElevationProviderStatus } from "../../../../../lib/elevation/google-elevation-provider";

export async function GET() {
  return NextResponse.json([
    {
      id: "mock",
      name: "Mock elevation",
      enabled: true
    },
    getGoogleElevationProviderStatus()
  ]);
}
