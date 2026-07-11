export type ProviderCapability = "search" | "metadata" | "scorecard" | "geometry";

export type CourseDataProviderStatus = {
  id: string;
  name: string;
  enabled: boolean;
  reason?: "active" | "missing env key" | "endpoint not configured" | "stub only";
  capabilities: ProviderCapability[];
};

function liveProviderReason(hasKey: boolean, endpointConfigured = false) {
  if (!hasKey) {
    return "missing env key" as const;
  }

  if (!endpointConfigured) {
    return "endpoint not configured" as const;
  }

  return "active" as const;
}

export function getCourseDataProviderStatuses(): CourseDataProviderStatus[] {
  const golfCourseApiKeyConfigured = Boolean(process.env.GOLFCOURSEAPI_KEY);
  const rapidApiKeyConfigured = Boolean(process.env.RAPIDAPI_KEY);

  return [
    {
      id: "mock",
      name: "Mock Course Metadata",
      enabled: true,
      reason: "active",
      capabilities: ["search", "metadata", "scorecard"]
    },
    {
      id: "golfcourseapi",
      name: "GolfCourseAPI",
      enabled: false,
      reason: liveProviderReason(golfCourseApiKeyConfigured, false),
      capabilities: ["search", "metadata", "scorecard"]
    },
    {
      id: "rapidapi-foshesco",
      name: "RapidAPI Golf Course API by foshesco",
      enabled: false,
      reason: rapidApiKeyConfigured ? "stub only" : "missing env key",
      capabilities: ["search", "metadata", "scorecard"]
    },
    {
      id: "rapidapi-giancarlo",
      name: "RapidAPI Golf Courses API by giancarlo",
      enabled: false,
      reason: rapidApiKeyConfigured ? "stub only" : "missing env key",
      capabilities: ["search", "metadata"]
    },
    {
      id: "rapidapi-alejandro99aru",
      name: "RapidAPI Golf Course Database Info by Alejandro99aru",
      enabled: false,
      reason: rapidApiKeyConfigured ? "stub only" : "missing env key",
      capabilities: ["search", "metadata", "scorecard"]
    },
    {
      id: "mock-geometry",
      name: "Mock Course Geometry",
      enabled: true,
      reason: "active",
      capabilities: ["geometry"]
    },
    {
      id: "osm",
      name: "OpenStreetMap Golf Geometry",
      enabled: false,
      reason: "stub only",
      capabilities: ["geometry"]
    }
  ];
}
