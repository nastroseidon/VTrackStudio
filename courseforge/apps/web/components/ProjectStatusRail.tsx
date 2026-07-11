"use client";

import type { CourseProject, CourseProjectStatus } from "../../../packages/course-schema/src";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import type { CoursePackageReadiness } from "../lib/course-package/build-course-package";
import { CollapsibleSection } from "./CollapsibleSection";
import { CoursePackagePreviewPanel } from "./CoursePackagePreviewPanel";

type ElevationProviderStatus = {
  id: "mock" | "google_elevation";
  name: string;
  enabled: boolean;
  reason?: string;
};

const statusItems: Array<{
  key: keyof CourseProjectStatus;
  label: string;
}> = [
  { key: "courseConfirmed", label: "Course confirmed" },
  { key: "locationConfirmed", label: "Location confirmed" },
  { key: "boundaryConfirmed", label: "Boundary confirmed" },
  { key: "scorecardConfirmed", label: "Scorecard confirmed" },
  { key: "holesTraced", label: "Holes traced" },
  { key: "elevationGenerated", label: "Elevation generated" },
  { key: "packageExported", label: "Package exported" }
];

type ProjectStatusRailProps = {
  activeHoleStatus: string;
  activeTracingHoleNumber: number | null;
  allHolesTraced: boolean;
  approvedHoleCount: number;
  autoBuilderOpen: boolean;
  boundaryDraftPointCount: number;
  clientSaveReady: boolean;
  currentTracePointCount: number;
  currentProject: CourseProject | null;
  coursePackageReadiness: CoursePackageReadiness;
  draftHolePlanCount: number;
  generatedGeometryExists: boolean;
  generatedGeometryGeneratedAt: string | null;
  generatedGeometryHoleCount: number;
  generatedGeometrySource: string;
  generatedGeometryStale: boolean;
  generatedGeometryVisible: boolean;
  elevationSamplesVisible: boolean;
  importError: string;
  isAdjustingLocation: boolean;
  isDrawingBoundary: boolean;
  lastSavedAt: string | null;
  onExportCoursePackage: () => void;
  onExportProject: () => void;
  onGenerateGoogleElevationProfile: () => void;
  onGenerateMockElevationProfile: () => void;
  onGenerateBasicGeometry: () => void;
  onToggleElevationSamples: () => void;
  onImportProject: (event: ChangeEvent<HTMLInputElement>) => void;
  onReviewHoleTraces: () => void;
  onResumeSavedProject: () => void;
  onSaveProject: () => void;
  onStartNewProject: () => void;
  remainingHoleCount: number;
  savedProjectExists: boolean;
  saveStatus: string;
  saveVersion: string;
  showResumePrompt: boolean;
  tracedHoleCount: number;
  tracingModeActive: boolean;
  selectedCourse: CourseProject;
  status: CourseProjectStatus;
};

export function ProjectStatusRail({
  activeHoleStatus,
  activeTracingHoleNumber,
  allHolesTraced,
  approvedHoleCount,
  autoBuilderOpen,
  boundaryDraftPointCount,
  clientSaveReady,
  currentTracePointCount,
  currentProject,
  coursePackageReadiness,
  draftHolePlanCount,
  generatedGeometryExists,
  generatedGeometryGeneratedAt,
  generatedGeometryHoleCount,
  generatedGeometrySource,
  generatedGeometryStale,
  generatedGeometryVisible,
  elevationSamplesVisible,
  importError,
  isAdjustingLocation,
  isDrawingBoundary,
  lastSavedAt,
  onExportCoursePackage,
  onExportProject,
  onGenerateGoogleElevationProfile,
  onGenerateMockElevationProfile,
  onGenerateBasicGeometry,
  onToggleElevationSamples,
  onImportProject,
  onReviewHoleTraces,
  onResumeSavedProject,
  onSaveProject,
  onStartNewProject,
  remainingHoleCount,
  savedProjectExists,
  saveStatus,
  saveVersion,
  showResumePrompt,
  selectedCourse,
  status,
  tracedHoleCount,
  tracingModeActive
}: ProjectStatusRailProps) {
  const visibleSaveStatus = clientSaveReady ? saveStatus : "Not saved yet";
  const [elevationProviderStatuses, setElevationProviderStatuses] = useState<ElevationProviderStatus[]>([]);
  const googleElevationStatus = elevationProviderStatuses.find((provider) => provider.id === "google_elevation");
  const elevationModel = currentProject?.elevationModel;
  const activeHoleElevationProfile = activeTracingHoleNumber
    ? elevationModel?.holeProfiles.find((profile) => profile.holeNumber === activeTracingHoleNumber)
    : undefined;
  const elevationModelIsStale = elevationModel?.status === "stale";
  const courseElevationRangeFeet =
    elevationModel?.minElevationMeters !== undefined && elevationModel.maxElevationMeters !== undefined
      ? {
          min: elevationMetersToFeet(elevationModel.minElevationMeters),
          max: elevationMetersToFeet(elevationModel.maxElevationMeters)
        }
      : null;
  const activeHoleTeeFeet =
    activeHoleElevationProfile?.teeElevationMeters !== undefined
      ? elevationMetersToFeet(activeHoleElevationProfile.teeElevationMeters)
      : null;
  const activeHoleGreenFeet =
    activeHoleElevationProfile?.greenElevationMeters !== undefined
      ? elevationMetersToFeet(activeHoleElevationProfile.greenElevationMeters)
      : null;
  const activeHoleChangeFeet =
    activeHoleElevationProfile?.elevationChangeMeters !== undefined
      ? elevationMetersToFeet(activeHoleElevationProfile.elevationChangeMeters)
      : null;

  useEffect(() => {
    let active = true;

    async function loadElevationProviderStatuses() {
      try {
        const response = await fetch("/api/elevation/providers/status");

        if (!response.ok) {
          throw new Error("Elevation provider status unavailable.");
        }

        const statuses = (await response.json()) as ElevationProviderStatus[];

        if (active) {
          setElevationProviderStatuses(statuses);
        }
      } catch {
        if (active) {
          setElevationProviderStatuses([
            {
              id: "mock",
              name: "Mock elevation",
              enabled: true
            },
            {
              id: "google_elevation",
              name: "Google Elevation",
              enabled: false,
              reason: "Provider status unavailable"
            }
          ]);
        }
      }
    }

    void loadElevationProviderStatuses();

    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="status-rail" aria-label="Project actions">
      <h2>Project actions</h2>
      <CollapsibleSection
        autoOpenKey={currentProject?.id ?? "no-project"}
        className="project-save-panel"
        defaultOpen
        summary={visibleSaveStatus}
        title="Project Save"
      >
        <section aria-label="Project save actions">
        <div className="save-status">{visibleSaveStatus}</div>
        {showResumePrompt ? (
          <div className="resume-prompt">
            <strong>Resume saved project?</strong>
            <p>Continue your last local CourseForge session on this browser.</p>
            <div className="save-action-row">
              <button className="primary-action compact-action" onClick={onResumeSavedProject} type="button">
                Resume
              </button>
              <button className="secondary-action compact-action" onClick={onStartNewProject} type="button">
                Start New
              </button>
            </div>
          </div>
        ) : null}
        <div className="save-action-grid">
          <button className="primary-action compact-action" disabled={!currentProject} onClick={onSaveProject} type="button">
            Save Project
          </button>
          <button
            className="secondary-action compact-action"
            disabled={!currentProject}
            onClick={onExportProject}
            type="button"
          >
            Export Project File
          </button>
          <label className="secondary-action compact-action import-file-button">
            Import Project File
            <input accept="application/json" onChange={onImportProject} type="file" />
          </label>
        </div>
        {importError ? <p className="inline-error">{importError}</p> : null}
        {draftHolePlanCount > 0 ? (
          <div className="completion-panel">
            <strong>{allHolesTraced ? "All holes have traces." : "Hole trace review"}</strong>
            <p>
              {tracedHoleCount > 0
                ? `${approvedHoleCount} of ${tracedHoleCount} saved traces approved.`
                : "Save a trace before starting review."}
            </p>
            <div className="save-action-grid">
              <button className="secondary-action compact-action" onClick={onReviewHoleTraces} type="button">
                Review Hole Traces
              </button>
              {allHolesTraced ? (
                <button className="secondary-action compact-action" onClick={onGenerateBasicGeometry} type="button">
                  Generate Basic Geometry
                </button>
              ) : null}
            </div>
            <p className="soft-status">This creates a visual preview only, not final simulator geometry.</p>
          </div>
        ) : null}
        </section>
      </CollapsibleSection>

      <CoursePackagePreviewPanel
        allHolesTraced={allHolesTraced}
        draftHolePlanCount={draftHolePlanCount}
        generatedGeometryHoleCount={generatedGeometryHoleCount}
        generatedGeometryStale={generatedGeometryStale}
        onExportCoursePackage={onExportCoursePackage}
        readiness={coursePackageReadiness}
        scorecardConfirmed={Boolean(currentProject?.status.scorecardConfirmed)}
        tracedHoleCount={tracedHoleCount}
      />

      <section className="action-rail-card progress-rail-card" aria-label="Trace progress">
        <div className="rail-card-heading">
          <span>Progress</span>
          <strong>{tracedHoleCount}/{draftHolePlanCount || 18}</strong>
        </div>
        <div className="rail-compact-grid">
          <span>Tracing</span>
          <strong>{tracingModeActive ? "Active" : "Inactive"}</strong>
          <span>Approved</span>
          <strong>{approvedHoleCount}</strong>
          <span>Remaining</span>
          <strong>{remainingHoleCount}</strong>
        </div>
      </section>

      <section className="action-rail-card geometry-rail-card" aria-label="Geometry preview status">
        <div className="rail-card-heading">
          <span>Geometry preview</span>
          <strong>{generatedGeometryExists ? "Ready" : "None"}</strong>
        </div>
        <p>
          {generatedGeometryExists
            ? `${generatedGeometryHoleCount} holes · ${generatedGeometryVisible ? "visible" : "hidden"}${
                generatedGeometryStale ? " · stale" : ""
              }`
            : "Generate basic geometry after tracing holes."}
        </p>
      </section>

      <section className="action-rail-card elevation-rail-card" aria-label="Elevation profile status">
        <div className="rail-card-heading">
          <span>Elevation</span>
          <strong>{elevationModel?.status ?? "Missing"}</strong>
        </div>
        <div className="rail-compact-grid">
          <span>Mock</span>
          <strong>Available</strong>
          <span>Google</span>
          <strong>{googleElevationStatus?.enabled ? "Configured" : "Missing key"}</strong>
          <span>Source</span>
          <strong>{formatElevationSource(elevationModel?.source)}</strong>
          <span>Course range</span>
          <strong>{courseElevationRangeFeet ? `${courseElevationRangeFeet.min}-${courseElevationRangeFeet.max} ft` : "n/a"}</strong>
          <span>Boundary samples</span>
          <strong>{elevationModel?.boundarySamplePoints.length ?? 0}</strong>
          <span>Hole profiles</span>
          <strong>{elevationModel?.holeProfiles.length ?? 0}</strong>
        </div>
        {elevationModelIsStale ? (
          <p className="elevation-warning-copy">Elevation may be stale. Regenerate after boundary/trace changes.</p>
        ) : (
          <p>
            {elevationModel?.source === "google_elevation"
              ? "Sampled from Google Elevation. No terrain heightmap yet."
              : "Mock/sample elevation only. Not real terrain yet."}
          </p>
        )}
        {elevationModel ? (
          <button
            className="secondary-action compact-action"
            disabled={elevationModelIsStale}
            onClick={onToggleElevationSamples}
            type="button"
          >
            {elevationSamplesVisible ? "Hide Elevation Samples" : "Show Elevation Samples"}
          </button>
        ) : null}
        <div className="elevation-summary-card">
          <strong>
            {activeTracingHoleNumber ? `Hole ${activeTracingHoleNumber} elevation` : "Active hole elevation"}
          </strong>
          {activeHoleTeeFeet !== null && activeHoleGreenFeet !== null && activeHoleChangeFeet !== null ? (
            <>
              <div className="rail-compact-grid">
                <span>Tee</span>
                <strong>{activeHoleTeeFeet} ft</strong>
                <span>Green</span>
                <strong>{activeHoleGreenFeet} ft</strong>
                <span>Change</span>
                <strong>
                  {activeHoleChangeFeet > 0 ? "+" : ""}
                  {activeHoleChangeFeet} ft{" "}
                  {activeHoleChangeFeet > 0 ? "uphill" : activeHoleChangeFeet < 0 ? "downhill" : "level"}
                </strong>
              </div>
              {activeHoleElevationProfile?.samplePoints.length ? (
                <div className="elevation-profile-list" aria-label="Active hole elevation profile">
                  {activeHoleElevationProfile.samplePoints.map((point, index) => (
                    <div className="elevation-profile-row" key={`${point.lat}-${point.lng}-profile-${index}`}>
                      <span>
                        {elevationProfilePointLabel(index, activeHoleElevationProfile.samplePoints.length)}
                      </span>
                      <strong>{elevationMetersToFeet(point.elevationMeters)} ft</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p>Elevation samples not available for this hole.</p>
          )}
        </div>
        <div className="elevation-action-grid">
          <button
            className="secondary-action compact-action"
            disabled={!currentProject?.status.boundaryConfirmed}
            onClick={onGenerateMockElevationProfile}
            type="button"
          >
            Generate Mock Elevation Profile
          </button>
          <button
            className="primary-action compact-action"
            disabled={!currentProject?.status.boundaryConfirmed || !googleElevationStatus?.enabled}
            onClick={onGenerateGoogleElevationProfile}
            type="button"
          >
            Generate Google Elevation Profile
          </button>
        </div>
        {!googleElevationStatus?.enabled ? (
          <p>Google Elevation requires GOOGLE_MAPS_SERVER_API_KEY in .env.local.</p>
        ) : null}
      </section>

      <CollapsibleSection
        autoOpenKey={currentProject?.id ?? "no-project"}
        className="debug-panel"
        defaultOpen={false}
        summary={currentProject ? `${tracedHoleCount} traced · ${generatedGeometryHoleCount} geometry` : "No project"}
        title="Project Debug"
      >
        <div className="debug-grid">
          <span>Current course</span>
          <strong>{currentProject?.name ?? "None confirmed"}</strong>

          <span>Selected coordinates</span>
          <strong>
            {selectedCourse.location.latitude.toFixed(4)},{" "}
            {selectedCourse.location.longitude.toFixed(4)}
          </strong>

          <span>Current course lat/lng</span>
          <strong>
            {currentProject
              ? `${currentProject.location.latitude.toFixed(6)}, ${currentProject.location.longitude.toFixed(6)}`
              : "none"}
          </strong>

          <span>Original lat/lng</span>
          <strong>
            {currentProject?.originalLocation
              ? `${currentProject.originalLocation.latitude.toFixed(6)}, ${currentProject.originalLocation.longitude.toFixed(6)}`
              : "not captured"}
          </strong>

          <span>Location confirmed</span>
          <strong>{String(Boolean(currentProject?.status.locationConfirmed))}</strong>

          <span>Location source</span>
          <strong>{currentProject?.locationSource ?? "none"}</strong>

          <span>Adjusting location</span>
          <strong>{String(isAdjustingLocation)}</strong>

          <span>Mock boundary</span>
          <strong>{currentProject?.boundary ? "true" : "false"}</strong>

          <span>Boundary point count</span>
          <strong>
            {currentProject?.boundary?.coordinates[0]?.length
              ? Math.max(currentProject.boundary.coordinates[0].length - 1, 0)
              : boundaryDraftPointCount}
          </strong>

          <span>Drawing mode active</span>
          <strong>{String(isDrawingBoundary)}</strong>

          <span>Boundary source</span>
          <strong>{currentProject?.boundary?.source ?? "none"}</strong>

          <span>Provider</span>
          <strong>{currentProject?.providerId ?? "none"}</strong>

          <span>Provider course id</span>
          <strong>{currentProject?.providerCourseId ?? "none"}</strong>

          <span>Geometry status</span>
          <strong>{currentProject?.geometryStatus ?? "none"}</strong>

          <span>Scorecard present</span>
          <strong>{String(Boolean(currentProject?.scorecard))}</strong>

          <span>Scorecard confirmed</span>
          <strong>{String(Boolean(currentProject?.status.scorecardConfirmed))}</strong>

          <span>Tee count</span>
          <strong>{currentProject?.scorecard?.tees.length ?? 0}</strong>

          <span>Scorecard hole count</span>
          <strong>{currentProject?.scorecard?.holes.length ?? 0}</strong>

          <span>Auto-Builder open</span>
          <strong>{String(autoBuilderOpen)}</strong>

          <span>Draft hole plan count</span>
          <strong>{draftHolePlanCount}</strong>

          <span>Traced hole count</span>
          <strong>{tracedHoleCount}</strong>

          <span>Approved hole count</span>
          <strong>{approvedHoleCount}</strong>

          <span>Remaining hole count</span>
          <strong>{remainingHoleCount}</strong>

          <span>Active tracing hole</span>
          <strong>{activeTracingHoleNumber ?? "none"}</strong>

          <span>Active hole status</span>
          <strong>{activeHoleStatus}</strong>

          <span>All holes traced</span>
          <strong>{String(allHolesTraced)}</strong>

          <span>Tracing mode active</span>
          <strong>{String(tracingModeActive)}</strong>

          <span>Current trace point count</span>
          <strong>{currentTracePointCount}</strong>

          <span>Generated geometry exists</span>
          <strong>{String(generatedGeometryExists)}</strong>

          <span>Generated geometry hole count</span>
          <strong>{generatedGeometryHoleCount}</strong>

          <span>Generated geometry source</span>
          <strong>{generatedGeometrySource}</strong>

          <span>Generated geometry generatedAt</span>
          <strong>{generatedGeometryGeneratedAt ? new Date(generatedGeometryGeneratedAt).toLocaleString() : "none"}</strong>

          <span>Generated geometry visible</span>
          <strong>{String(generatedGeometryVisible)}</strong>

          <span>Generated geometry stale</span>
          <strong>{String(generatedGeometryStale)}</strong>

          <span>Elevation model exists</span>
          <strong>{String(Boolean(currentProject?.elevationModel))}</strong>

          <span>Elevation source</span>
          <strong>{currentProject?.elevationModel?.source ?? "none"}</strong>

          <span>Elevation status</span>
          <strong>{currentProject?.elevationModel?.status ?? "none"}</strong>

          <span>Elevation profile count</span>
          <strong>{currentProject?.elevationModel?.holeProfiles.length ?? 0}</strong>

          <span>Elevation stale</span>
          <strong>{String(currentProject?.elevationModel?.status === "stale")}</strong>

          <span>Last saved time</span>
          <strong>{clientSaveReady && lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "not saved"}</strong>

          <span>Saved project exists</span>
          <strong>{String(savedProjectExists)}</strong>

          <span>Save version</span>
          <strong>{saveVersion}</strong>

          {statusItems.map((item) => (
            <div className="debug-row" key={`debug-${item.key}`}>
              <span>{item.key}</span>
              <strong>{String(status[item.key])}</strong>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </aside>
  );
}

function elevationMetersToFeet(elevationMeters: number) {
  return Math.round(elevationMeters * 3.28084);
}

function formatElevationSource(
  source: "mock" | "google_elevation" | "earth_engine" | "usgs" | "manual" | undefined
) {
  if (source === "google_elevation") {
    return "Google Elevation";
  }

  if (source === "mock") {
    return "Mock";
  }

  return source ?? "none";
}

function elevationProfilePointLabel(index: number, totalPoints: number) {
  if (index === 0) {
    return "Tee";
  }

  if (index === totalPoints - 1) {
    return "Green";
  }

  return `Bend ${index}`;
}
