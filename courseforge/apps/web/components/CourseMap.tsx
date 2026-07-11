"use client";

import { APIProvider, AdvancedMarker, Map, Polygon, Polyline, useMap } from "@vis.gl/react-google-maps";
import type { MapMouseEvent } from "@vis.gl/react-google-maps";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type {
  CourseBoundary,
  ElevationPoint,
  CourseProject,
  DraftHoleTrace,
  GeneratedCourseGeometry,
  PolygonGeometry,
  TracePoint
} from "../../../packages/course-schema/src";

const fortWayneCenter = {
  lat: 41.0793,
  lng: -85.1394
};

type MapType = "satellite" | "hybrid" | "roadmap";

const mapTypeOptions: Array<{
  label: string;
  value: MapType;
}> = [
  { label: "Satellite", value: "satellite" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Map", value: "roadmap" }
];

type CourseMapProps = {
  apiKey?: string;
  boundaryDraftPoints: Array<{ latitude: number; longitude: number }>;
  currentProject: CourseProject | null;
  courses: CourseProject[];
  elevationSamplesVisible: boolean;
  activeElevationHoleNumber: number | null;
  generatedGeometry?: GeneratedCourseGeometry;
  generatedGeometryVisible: boolean;
  isAdjustingLocation: boolean;
  isDrawingBoundary: boolean;
  tracingModeActive: boolean;
  onAddBoundaryPoint: (point: { latitude: number; longitude: number }) => void;
  onAddTracePoint: (point: { latitude: number; longitude: number }) => void;
  onAdjustLocation: (point: { latitude: number; longitude: number }) => void;
  onMoveBoundaryDraftPoint: (index: number, point: { latitude: number; longitude: number }) => void;
  onMoveSavedBoundaryPoint: (index: number, point: { latitude: number; longitude: number }) => void;
  onMoveTracePoint: (
    pointType: "tee" | "centerline" | "green",
    point: { latitude: number; longitude: number },
    index?: number
  ) => void;
  selectedCourse: CourseProject;
  onSelectCourse: (courseId: string) => void;
  traceDraft: DraftHoleTrace;
};

type BoundaryPolygonProps = {
  boundary?: CourseBoundary;
  draftPoints?: Array<{ latitude: number; longitude: number }>;
  isPreview?: boolean;
};

type GeometryPolygonProps = {
  geometry?: PolygonGeometry;
  fillColor: string;
  strokeColor: string;
  fillOpacity?: number;
  strokeWeight?: number;
};

function isTracePoint(point: TracePoint | undefined): point is TracePoint {
  return Boolean(point);
}

function dragEventToPoint(event: google.maps.MapMouseEvent) {
  if (!event.latLng) {
    return null;
  }

  return {
    latitude: event.latLng.lat(),
    longitude: event.latLng.lng()
  };
}

function elevationMetersToFeet(elevationMeters: number) {
  return Math.round(elevationMeters * 3.28084);
}

function CourseCameraSync({ center }: { center: google.maps.LatLngLiteral }) {
  const map = useMap();

  useEffect(() => {
    map?.panTo(center);
  }, [center, map]);

  return null;
}

function BoundaryPolygon({ boundary, draftPoints = [], isPreview = false }: BoundaryPolygonProps) {
  const paths =
    boundary?.coordinates[0].map(([lng, lat]) => ({ lat, lng })) ??
    draftPoints.map((point) => ({ lat: point.latitude, lng: point.longitude }));

  if (paths.length < 3) {
    return null;
  }

  return (
    <Polygon
      clickable={false}
      fillColor={isPreview ? "#66d9ef" : "#f7c948"}
      fillOpacity={isPreview ? 0.2 : 0.28}
      paths={paths}
      strokeColor={isPreview ? "#00bcd4" : "#f7c948"}
      strokeOpacity={1}
      strokeWeight={3}
    />
  );
}

function GeometryPolygon({
  geometry,
  fillColor,
  strokeColor,
  fillOpacity = 0.28,
  strokeWeight = 2
}: GeometryPolygonProps) {
  const paths = geometry?.coordinates[0].map(([lng, lat]) => ({ lat, lng })) ?? [];

  if (paths.length < 3) {
    return null;
  }

  return (
    <Polygon
      clickable={false}
      fillColor={fillColor}
      fillOpacity={fillOpacity}
      paths={paths}
      strokeColor={strokeColor}
      strokeOpacity={0.95}
      strokeWeight={strokeWeight}
    />
  );
}

function ElevationSampleMarker({
  point,
  title,
  variant
}: {
  point: ElevationPoint;
  title: string;
  variant: "boundary" | "hole";
}) {
  return (
    <AdvancedMarker
      position={{ lat: point.lat, lng: point.lng }}
      title={`${title}: ${elevationMetersToFeet(point.elevationMeters)} ft`}
    >
      <span className={`elevation-sample-marker ${variant}-elevation-marker`}>
        {elevationMetersToFeet(point.elevationMeters)} ft
      </span>
    </AdvancedMarker>
  );
}

export function CourseMap({
  apiKey,
  boundaryDraftPoints,
  currentProject,
  courses,
  elevationSamplesVisible,
  activeElevationHoleNumber,
  generatedGeometry,
  generatedGeometryVisible,
  isAdjustingLocation,
  isDrawingBoundary,
  tracingModeActive,
  onAddBoundaryPoint,
  onAddTracePoint,
  onAdjustLocation,
  onMoveBoundaryDraftPoint,
  onMoveSavedBoundaryPoint,
  onMoveTracePoint,
  selectedCourse,
  onSelectCourse,
  traceDraft
}: CourseMapProps) {
  const [mapType, setMapType] = useState<MapType>("satellite");
  const isDraggingPoint = useRef(false);
  const mapCenter = useMemo(
    () => ({
      lat: selectedCourse.location.latitude,
      lng: selectedCourse.location.longitude
    }),
    [selectedCourse.location.latitude, selectedCourse.location.longitude]
  );
  const activeHoleElevationProfile = activeElevationHoleNumber
    ? currentProject?.elevationModel?.holeProfiles.find(
        (profile) => profile.holeNumber === activeElevationHoleNumber
      )
    : undefined;
  const markDragStart = () => {
    isDraggingPoint.current = true;
  };
  const markDragEnd = () => {
    window.setTimeout(() => {
      isDraggingPoint.current = false;
    }, 0);
  };
  const handleMapClick = (event: MapMouseEvent) => {
    if (isDraggingPoint.current) {
      return;
    }

    if (!event.detail.latLng) {
      return;
    }

    const point = {
      latitude: event.detail.latLng.lat,
      longitude: event.detail.latLng.lng
    };

    if (isAdjustingLocation) {
      onAdjustLocation(point);
      return;
    }

    if (isDrawingBoundary) {
      onAddBoundaryPoint(point);
      return;
    }

    if (tracingModeActive) {
      onAddTracePoint(point);
    }
  };
  const tracePath = [
    traceDraft.teePoint,
    ...traceDraft.centerlinePoints,
    traceDraft.greenPoint
  ].filter(isTracePoint).map((point) => ({
    lat: point.latitude,
    lng: point.longitude
  }));
  const mapModeHint = isDrawingBoundary
    ? "Drawing boundary: click around the outside edge of the course."
    : isAdjustingLocation
      ? "Adjusting location: click the center of the course or clubhouse area."
      : tracingModeActive
        ? "Tracing hole: click tee, optional bends, then green."
        : "";

  if (!apiKey) {
    return (
      <section className="map-stage" aria-label="Map placeholder">
        <div className="map-placeholder">
          <div className="placeholder-content">
            <h2>Map preview is ready for an API key</h2>
            <p>
              Add a restricted Google Maps key to the local environment file to enable the
              interactive map. Mock course results are still available in the search panel.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`map-stage ${isDrawingBoundary ? "is-drawing" : ""} ${
        tracingModeActive ? "is-tracing" : ""
      } ${isAdjustingLocation ? "is-adjusting-location" : ""}`}
      aria-label="Course map"
    >
      {mapModeHint ? <div className="map-mode-hint">{mapModeHint}</div> : null}
      <div className="map-type-toggle" aria-label="Map type">
        {mapTypeOptions.map((option) => (
          <button
            aria-pressed={mapType === option.value}
            className={`map-type-button ${mapType === option.value ? "is-active" : ""}`}
            key={option.value}
            onClick={() => setMapType(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <APIProvider apiKey={apiKey}>
        <Map
          className="map-canvas"
          defaultCenter={fortWayneCenter}
          defaultZoom={10}
          fullscreenControl={false}
          gestureHandling="greedy"
          mapId="courseforge-mvp-map"
          mapTypeControl={false}
          mapTypeId={mapType}
          onClick={handleMapClick}
          reuseMaps
          streetViewControl={false}
        >
          <CourseCameraSync center={mapCenter} />
          {courses.map((course) => (
            <AdvancedMarker
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              position={{
                lat: course.location.latitude,
                lng: course.location.longitude
              }}
              title={course.name}
            >
              <span
                aria-label={course.name}
                className={`marker-dot ${course.id === selectedCourse.id ? "is-selected" : ""} ${
                  isAdjustingLocation && course.id === selectedCourse.id ? "is-adjusting" : ""
                }`}
              />
            </AdvancedMarker>
          ))}
          {!courses.some((course) => course.id === selectedCourse.id) ? (
            <AdvancedMarker
              position={{
                lat: selectedCourse.location.latitude,
                lng: selectedCourse.location.longitude
              }}
              title={selectedCourse.name}
            >
              <span
                aria-label={selectedCourse.name}
                className={`marker-dot active-course-marker ${isAdjustingLocation ? "is-adjusting" : ""}`}
              />
            </AdvancedMarker>
          ) : null}
          {boundaryDraftPoints.map((point, index) => (
            <AdvancedMarker
              draggable
              key={`${point.latitude}-${point.longitude}-${index}`}
              onDragEnd={(event) => {
                const movedPoint = dragEventToPoint(event);
                markDragEnd();

                if (movedPoint) {
                  onMoveBoundaryDraftPoint(index, movedPoint);
                }
              }}
              onDragStart={markDragStart}
              position={{ lat: point.latitude, lng: point.longitude }}
              title={`Boundary point ${index + 1}`}
            >
              <span className="boundary-point">{index + 1}</span>
            </AdvancedMarker>
          ))}
          {currentProject?.boundary?.coordinates[0].slice(0, -1).map(([lng, lat], index) => (
            <AdvancedMarker
              draggable
              key={`${lat}-${lng}-saved-boundary-${index}`}
              onDragEnd={(event) => {
                const movedPoint = dragEventToPoint(event);
                markDragEnd();

                if (movedPoint) {
                  onMoveSavedBoundaryPoint(index, movedPoint);
                }
              }}
              onDragStart={markDragStart}
              position={{ lat, lng }}
              title={`Saved boundary point ${index + 1}`}
            >
              <span className="boundary-point saved-boundary-point">{index + 1}</span>
            </AdvancedMarker>
          ))}
          <BoundaryPolygon draftPoints={boundaryDraftPoints} isPreview />
          <BoundaryPolygon boundary={currentProject?.boundary} />
          {elevationSamplesVisible
            ? currentProject?.elevationModel?.boundarySamplePoints.map((point, index) => (
                <ElevationSampleMarker
                  key={`${point.lat}-${point.lng}-boundary-elevation-${index}`}
                  point={point}
                  title={`Boundary elevation sample ${index + 1}`}
                  variant="boundary"
                />
              ))
            : null}
          {elevationSamplesVisible
            ? activeHoleElevationProfile?.samplePoints.map((point, index) => (
                <ElevationSampleMarker
                  key={`${point.lat}-${point.lng}-hole-elevation-${index}`}
                  point={point}
                  title={`Hole ${activeHoleElevationProfile.holeNumber} elevation sample ${index + 1}`}
                  variant="hole"
                />
              ))
            : null}
          {generatedGeometryVisible
            ? generatedGeometry?.holes.map((hole) => (
                <Fragment key={`generated-hole-${hole.holeNumber}`}>
                  <GeometryPolygon
                    fillColor="#2f7d4b"
                    fillOpacity={0.18}
                    geometry={hole.fairway}
                    strokeColor="#7ad18b"
                    strokeWeight={3}
                  />
                  <GeometryPolygon
                    fillColor="#d6a85d"
                    fillOpacity={0.42}
                    geometry={hole.teeBox}
                    strokeColor="#ffe29a"
                    strokeWeight={2}
                  />
                  <GeometryPolygon
                    fillColor="#43c978"
                    fillOpacity={0.46}
                    geometry={hole.green}
                    strokeColor="#d8ffd8"
                    strokeWeight={2}
                  />
                </Fragment>
              ))
            : null}
          {tracePath.length > 1 ? (
            <Polyline
              path={tracePath}
              strokeColor="#ff4d8d"
              strokeOpacity={1}
              strokeWeight={4}
            />
          ) : null}
          {traceDraft.teePoint ? (
            <AdvancedMarker
              draggable
              onDragEnd={(event) => {
                const movedPoint = dragEventToPoint(event);
                markDragEnd();

                if (movedPoint) {
                  onMoveTracePoint("tee", movedPoint);
                }
              }}
              onDragStart={markDragStart}
              position={{ lat: traceDraft.teePoint.latitude, lng: traceDraft.teePoint.longitude }}
              title="Tee point"
            >
              <span className="trace-point tee-point">T</span>
            </AdvancedMarker>
          ) : null}
          {traceDraft.centerlinePoints.map((point, index) => (
            <AdvancedMarker
              draggable
              key={`${point.latitude}-${point.longitude}-trace-${index}`}
              onDragEnd={(event) => {
                const movedPoint = dragEventToPoint(event);
                markDragEnd();

                if (movedPoint) {
                  onMoveTracePoint("centerline", movedPoint, index);
                }
              }}
              onDragStart={markDragStart}
              position={{ lat: point.latitude, lng: point.longitude }}
              title={`Bend point ${index + 1}`}
            >
              <span className="trace-point bend-point">{index + 1}</span>
            </AdvancedMarker>
          ))}
          {traceDraft.greenPoint ? (
            <AdvancedMarker
              draggable
              onDragEnd={(event) => {
                const movedPoint = dragEventToPoint(event);
                markDragEnd();

                if (movedPoint) {
                  onMoveTracePoint("green", movedPoint);
                }
              }}
              onDragStart={markDragStart}
              position={{ lat: traceDraft.greenPoint.latitude, lng: traceDraft.greenPoint.longitude }}
              title="Green point"
            >
              <span className="trace-point green-point">G</span>
            </AdvancedMarker>
          ) : null}
        </Map>
      </APIProvider>
    </section>
  );
}
