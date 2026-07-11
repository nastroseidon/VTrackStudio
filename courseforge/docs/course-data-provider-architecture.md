# Course Data Provider Architecture

CourseForge uses a provider-based data layer so course search, metadata, scorecards, and geometry can evolve independently.

## Metadata Providers

Metadata providers answer questions like:

- What courses match this search?
- What is the course name and facility name?
- Where is the course located?
- How many holes does it have?
- What tee sets, ratings, slopes, pars, handicaps, and yardages are available?

These providers are useful for building the project record and validating the user's selected course. They should not be treated as visual hole geometry providers unless a specific provider is proven to license and return that data.

Current and future metadata provider candidates:

- Mock CourseForge provider for local development: active, includes mock scorecards.
- GolfCourseAPI: disabled until `GOLFCOURSEAPI_KEY` and endpoint/response mapping are confirmed.
- RapidAPI Golf Course API by foshesco: stubbed until `RAPIDAPI_KEY`, host, path, query parameters, and response mapping are confirmed.
- RapidAPI Golf Courses API by giancarlo: stubbed until endpoint mapping is confirmed.
- RapidAPI Golf Course Database Info by Alejandro99aru: stubbed until endpoint mapping is confirmed.

## Geometry Providers

Geometry providers answer visual and spatial questions like:

- Where are course boundaries?
- Where are tees, fairways, greens, bunkers, water hazards, and tree areas?
- What is the centerline of each hole?
- How confident is each geometry layer?

CourseForge keeps this separate from metadata because scorecard APIs are not enough to build simulator-ready visual holes.

Current and future geometry provider candidates:

- Manual user-drawn geometry
- Satellite-assisted CourseForge geometry
- OpenStreetMap geometry
- Mock geometry for development
- Commercial geometry only when explicitly licensed

## Normalized Model

CourseForge normalizes provider responses into internal types such as `CourseSearchResult`, `CourseMetadata`, `CourseScorecard`, and `CourseGeometry`.

This avoids hard-coding provider-specific response shapes into UI components. The UI talks to `CourseDataService` through API routes, and the service decides which enabled providers to call.

## OSM Fallback Strategy

OpenStreetMap may provide partial golf geometry when courses are well tagged. Future OSM support should look for:

- `leisure=golf_course`
- `golf=hole`
- `golf=tee`
- `golf=green`
- `golf=fairway`
- `golf=bunker`
- `golf=water_hazard`

OSM data will often be incomplete, so geometry should be marked as `available`, `partial`, or `missing` instead of assuming full course coverage.

## Environment Variables

Provider keys must remain server-side and must not be exposed to the browser.

```text
GOLFCOURSEAPI_KEY=
RAPIDAPI_KEY=
```

CourseForge exposes provider status through:

```text
GET /api/courses/providers/status
```

The status route returns provider ids, names, enabled state, disabled reasons, and capabilities only. It never returns API key values, request headers, or environment values.

Current live-provider behavior:

- If `GOLFCOURSEAPI_KEY` is missing, GolfCourseAPI reports `missing env key`.
- If `GOLFCOURSEAPI_KEY` is present, GolfCourseAPI still reports `endpoint not configured` until endpoint mapping is implemented.
- If `RAPIDAPI_KEY` is missing, RapidAPI providers report `missing env key`.
- If `RAPIDAPI_KEY` is present, RapidAPI providers report `stub only` until exact endpoint mappings are implemented.
- Mock metadata remains active so CourseForge can keep working locally.

The web map key remains client-side because Google Maps JavaScript requires it:

```text
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

All keys should be restricted according to provider guidance. The app must still run when optional provider keys are missing.

Scorecards from any live metadata provider must still be reviewed and explicitly confirmed by the user before being treated as verified.

## Legal Guardrails

Do not scrape BlueGolf, Garmin Golf, Golfshot, 18Birdies, RyzeGolf, or any proprietary golf app or site.

Only use provider data according to its license and terms. Do not copy proprietary imagery, course maps, meshes, or textures into simulator assets unless the license explicitly permits that use.
