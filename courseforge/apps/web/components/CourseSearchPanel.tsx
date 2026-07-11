"use client";

import type { CourseProject } from "../../../packages/course-schema/src";
import type { CourseMetadata } from "../lib/course-data/types";
import { CollapsibleSection } from "./CollapsibleSection";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { CourseImportPanel } from "./CourseImportPanel";
import { ScorecardVerificationPanel } from "./ScorecardVerificationPanel";

type CourseSearchPanelProps = {
  courses: CourseProject[];
  currentProject: CourseProject | null;
  draftMessage: string;
  focusedTracingMode: boolean;
  isAdjustingLocation: boolean;
  isDrawingBoundary: boolean;
  onClearScorecardConfirmation: () => void;
  onConfirmScorecard: () => void;
  onSelectedImportedCourseChange: (metadata: CourseMetadata | null) => void;
  onUseImportedCourse: (metadata: CourseMetadata) => void;
  selectedCourse: CourseProject;
  selectedImportedCourseMetadata: CourseMetadata | null;
  onSelectCourse: (courseId: string) => void;
  onUseCourse: () => void;
};

export function CourseSearchPanel({
  courses,
  currentProject,
  draftMessage,
  focusedTracingMode,
  isAdjustingLocation,
  isDrawingBoundary,
  onClearScorecardConfirmation,
  onConfirmScorecard,
  onSelectedImportedCourseChange,
  onUseImportedCourse,
  selectedCourse,
  selectedImportedCourseMetadata,
  onSelectCourse,
  onUseCourse
}: CourseSearchPanelProps) {
  const courseConfirmed = Boolean(currentProject?.status.courseConfirmed);
  const locationConfirmed = Boolean(currentProject?.status.locationConfirmed);
  const boundaryConfirmed = Boolean(currentProject?.status.boundaryConfirmed);
  const scorecardNeedsReview = Boolean(currentProject?.scorecard && !currentProject.status.scorecardConfirmed);
  const workflowStep = focusedTracingMode
    ? "focused"
    : !courseConfirmed
      ? "search"
      : !locationConfirmed
        ? "location"
        : !boundaryConfirmed
          ? "boundary"
          : scorecardNeedsReview
            ? "scorecard"
            : "ready";
  const autoOpenKey = `${selectedCourse.id}-${workflowStep}`;
  const boundaryState = currentProject?.status.boundaryConfirmed
    ? "Boundary confirmed"
    : isDrawingBoundary
      ? "Drawing boundary"
      : "Boundary needed";
  const activeSource =
    currentProject?.source === "provider-import" ? "Provider import" : currentProject ? "Mock map selection" : "Not confirmed";
  const locationState = currentProject?.status.locationConfirmed
    ? "Location confirmed"
    : isAdjustingLocation
      ? "Adjusting location"
      : "Location needs verification";

  return (
    <aside className={`side-panel ${focusedTracingMode ? "is-focused-tracing" : ""}`} aria-label="Course search">
      <div className="brand-block">
        <h1>CourseForge</h1>
        {focusedTracingMode ? (
          <p>Focused tracing workspace</p>
        ) : (
          <>
            <p>Create simulator-ready golf courses from real-world course data.</p>
            <p className="milestone-note">
              Milestone 5 supports manual map boundary drawing. Auto Boundary is still a simple square
              estimate for quick testing.
            </p>
          </>
        )}
      </div>

      <CollapsibleSection
        autoOpenKey={autoOpenKey}
        className="active-course-section"
        defaultOpen={courseConfirmed && !focusedTracingMode}
        summary={`${selectedCourse.name} · ${locationState}`}
        title="Active Course"
      >
        <section className="selected-summary" aria-label="Selected course summary">
          <h2>{selectedCourse.name}</h2>
          <div className="compact-state-list">
            <span>Location {currentProject?.status.locationConfirmed ? "confirmed" : "needed"}</span>
            <span>Boundary {currentProject?.status.boundaryConfirmed ? "ready" : "needed"}</span>
            <span>Scorecard {currentProject?.status.scorecardConfirmed ? "confirmed" : currentProject?.scorecard ? "review" : "missing"}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Source</span>
            <span className="summary-value">{activeSource}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Location</span>
            <span className="summary-value">
              {selectedCourse.city}, {selectedCourse.region}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Match confidence</span>
            <ConfidenceBadge score={selectedCourse.confidence} />
          </div>
          <div className="summary-row">
            <span className="summary-label">Marker</span>
            <span className="summary-value">{locationState}</span>
          </div>
          {selectedCourse.geometryStatus ? (
            <div className="summary-row">
              <span className="summary-label">Geometry</span>
              <span className={`geometry-chip ${selectedCourse.geometryStatus}`}>
                {selectedCourse.geometryStatus}
              </span>
            </div>
          ) : null}
          {!currentProject || currentProject.source !== "provider-import" ? (
            <div className="action-stack" aria-label="Course setup actions">
              <button className="primary-action" onClick={onUseCourse} type="button">
                Use Selected Demo Course
              </button>
            </div>
          ) : null}
        </section>
      </CollapsibleSection>

      <CollapsibleSection
        autoOpenKey={autoOpenKey}
        className="course-search-section"
        defaultOpen={workflowStep === "search"}
        summary={courseConfirmed ? "Imported/mock course selected" : "Search mock provider data"}
        title="Course Search / Import"
      >
        <CourseImportPanel
          onSelectedMetadataChange={onSelectedImportedCourseChange}
          onUseImportedCourse={onUseImportedCourse}
          selectedMetadata={selectedImportedCourseMetadata}
        />
        <details className="demo-shortcuts">
          <summary>Demo shortcuts</summary>
          <p>Mock courses are still available for testing when live providers are not configured.</p>
          <div className="results-list compact-demo-results" aria-label="Demo course shortcuts">
            {courses.map((course) => (
              <button
                className={`result-button ${course.id === selectedCourse.id ? "is-selected" : ""}`}
                key={course.id}
                onClick={() => onSelectCourse(course.id)}
                type="button"
              >
                <span className="result-title-row">
                  <span className="result-name">{course.name}</span>
                  <ConfidenceBadge score={course.confidence} />
                </span>
                <span className="result-location">
                  {course.city}, {course.region}
                </span>
              </button>
            ))}
          </div>
        </details>
      </CollapsibleSection>

      <CollapsibleSection
        autoOpenKey={autoOpenKey}
        className="location-boundary-section"
        defaultOpen={workflowStep === "location" || workflowStep === "boundary"}
        summary={`${locationState} · ${boundaryState}`}
        title="Location / Boundary"
      >
        <section className="drawing-panel" aria-label="Boundary drawing status">
          <span className="section-label">Location</span>
          <div className="drawing-state">{locationState}</div>
          <p>
            {isAdjustingLocation
              ? "Click the center of the golf course or clubhouse area."
              : "Check that the marker is on the right golf course before drawing a boundary."}
          </p>
          <span className="section-label">Boundary</span>
          <div className="drawing-state">{boundaryState}</div>
          {currentProject?.boundary?.source ? (
            <div className="soft-status">
              Saved from {currentProject.boundary.source === "manual" ? "manual drawing" : "Auto Boundary"}
            </div>
          ) : null}
          <p>
            {isDrawingBoundary
              ? "Click around the outside of the golf course. Add at least 3 points, then confirm."
              : "Confirm a course, then draw its outside edge or use Auto Boundary as a simple placeholder."}
          </p>
        </section>
      </CollapsibleSection>

      <CollapsibleSection
        autoOpenKey={autoOpenKey}
        className="scorecard-section"
        defaultOpen={workflowStep === "scorecard"}
        summary={
          currentProject?.status.scorecardConfirmed
            ? "Confirmed"
            : currentProject?.scorecard
              ? "Needs review"
              : "Missing"
        }
        title="Scorecard Review"
      >
        <ScorecardVerificationPanel
          currentProject={currentProject}
          onClearConfirmation={onClearScorecardConfirmation}
          onConfirmScorecard={onConfirmScorecard}
        />
      </CollapsibleSection>

      {draftMessage && !focusedTracingMode ? <p className="inline-message">{draftMessage}</p> : null}
    </aside>
  );
}
