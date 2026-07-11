import type {
  CourseProject,
  DraftHole,
  DraftHolePlan,
  DraftHoleTrace
} from "../../../packages/course-schema/src";

type MapEditingTrayProps = {
  activeTracingHoleNumber: number | null;
  allHolesTraced: boolean;
  autoBuilderOpen: boolean;
  approvedHoleCount: number;
  boundaryDraftPointCount: number;
  currentProject: CourseProject | null;
  currentTraceDraft: DraftHoleTrace;
  draftHolePlan: DraftHolePlan | null;
  draftMessage: string;
  generatedGeometryExists: boolean;
  generatedGeometryHoleCount: number;
  generatedGeometryStale: boolean;
  generatedGeometryVisible: boolean;
  holeTraceReviewMode: boolean;
  isAdjustingLocation: boolean;
  isDrawingBoundary: boolean;
  onApproveTrace: () => void;
  onAutoBoundary: () => void;
  onCancelDrawing: () => void;
  onCancelHoleTracing: () => void;
  onClearHoleTrace: () => void;
  onClearBoundary: () => void;
  onClearCurrentTrace: () => void;
  onConfirmBoundary: () => void;
  onConfirmLocation: () => void;
  onGenerateDraftHolePlan: () => void;
  onExitHoleTraceReview: () => void;
  onGenerateBasicGeometry: () => void;
  onOpenAutoBuilder: () => void;
  onSaveHoleTrace: () => void;
  onSelectDraftHole: (holeNumber: number) => void;
  onEditTrace: () => void;
  onNextUntracedHole: () => void;
  onMoveSavedTrace: (direction: "previous" | "next") => void;
  onNextTraceNeedingReview: () => void;
  onSetTraceGreenStep: () => void;
  onStartAdjustLocation: () => void;
  onStartHoleTrace: (holeNumber: number) => void;
  onStartManualBoundary: () => void;
  onToggleGeneratedGeometry: () => void;
  remainingHoleCount: number;
  traceStep: "tee" | "centerline" | "green" | "review";
  tracedHoleCount: number;
  tracingModeActive: boolean;
};

function readyLabel(isReady: boolean) {
  return isReady ? "Ready" : "Needed";
}

function mainYardage(hole: DraftHole) {
  const entries = Object.entries(hole.yardagesByTee ?? {});

  if (entries.length === 0) {
    return "-";
  }

  const [, yards] = entries[0];

  return `${yards} yd`;
}

function holeCircleClass(hole: DraftHole, activeTracingHoleNumber: number | null) {
  return [
    "hole-circle",
    hole.holeNumber === activeTracingHoleNumber ? "is-selected" : "",
    hole.trace ? "has-trace" : "",
    hole.status === "approved" ? "is-approved" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export function MapEditingTray({
  activeTracingHoleNumber,
  allHolesTraced,
  autoBuilderOpen,
  approvedHoleCount,
  boundaryDraftPointCount,
  currentProject,
  currentTraceDraft,
  draftHolePlan,
  draftMessage,
  generatedGeometryExists,
  generatedGeometryHoleCount,
  generatedGeometryStale,
  generatedGeometryVisible,
  holeTraceReviewMode,
  isAdjustingLocation,
  isDrawingBoundary,
  onApproveTrace,
  onAutoBoundary,
  onCancelDrawing,
  onCancelHoleTracing,
  onClearHoleTrace,
  onClearBoundary,
  onClearCurrentTrace,
  onConfirmBoundary,
  onConfirmLocation,
  onGenerateDraftHolePlan,
  onExitHoleTraceReview,
  onGenerateBasicGeometry,
  onOpenAutoBuilder,
  onSaveHoleTrace,
  onSelectDraftHole,
  onEditTrace,
  onNextUntracedHole,
  onMoveSavedTrace,
  onNextTraceNeedingReview,
  onSetTraceGreenStep,
  onStartAdjustLocation,
  onStartHoleTrace,
  onStartManualBoundary,
  onToggleGeneratedGeometry,
  remainingHoleCount,
  traceStep,
  tracedHoleCount,
  tracingModeActive
}: MapEditingTrayProps) {
  const activeHole =
    draftHolePlan?.holes.find((hole) => hole.holeNumber === activeTracingHoleNumber) ??
    draftHolePlan?.holes[0];
  const canConfirmBoundary = boundaryDraftPointCount >= 3;
  const canSaveTrace = Boolean(currentTraceDraft.teePoint && currentTraceDraft.greenPoint);
  const canApproveTrace = Boolean(activeHole?.trace);
  const canGenerateGeometry = tracedHoleCount > 0;
  const bendCount = currentTraceDraft.centerlinePoints.length;
  const traceInstruction =
    traceStep === "green"
      ? "Next map click will place the green."
      : "Choose a hole, then place the tee and green. Optional: add up to 6 bend points between tee and green.";
  const nextClickLabel = traceStep === "centerline" ? "bend" : traceStep;
  const canShowGeometryAction = generatedGeometryExists || canGenerateGeometry;

  if (!currentProject?.status.courseConfirmed && !autoBuilderOpen) {
    return (
      <section className="map-editing-tray is-idle" aria-label="Map editing tools">
        <div className="tray-copy">
          <span className="section-label">Map tools</span>
          <p>Map editing tools appear here when needed.</p>
        </div>
      </section>
    );
  }

  if (draftHolePlan && activeHole) {
    const frontNine = draftHolePlan.holes.filter((hole) => hole.holeNumber <= 9);
    const backNine = draftHolePlan.holes.filter((hole) => hole.holeNumber > 9);
    const renderHoleCircle = (hole: DraftHole) => (
      <button
        aria-label={`Hole ${hole.holeNumber}, ${hole.status}`}
        className={holeCircleClass(hole, activeTracingHoleNumber)}
        key={hole.holeNumber}
        onClick={() => onSelectDraftHole(hole.holeNumber)}
        title={`Hole ${hole.holeNumber}: ${hole.status}`}
        type="button"
      >
        <span>{hole.holeNumber}</span>
        {hole.trace ? <small aria-hidden="true">✓</small> : null}
      </button>
    );

    return (
      <section className="map-editing-tray focused-tracing-tray" aria-label="Hole tracing tools">
        <div className="focused-tray-header">
          <span className="section-label">Hole tracing</span>
          <div className="tray-status">
            {holeTraceReviewMode
              ? "Review mode"
              : tracingModeActive
                ? traceStep === "green"
                  ? "Placing green"
                  : "Tracing active"
                : "Choose a hole"}
          </div>
          <div className="trace-progress-line">
            Progress: {tracedHoleCount} of {draftHolePlan.holes.length} traced · {approvedHoleCount} approved ·{" "}
            {remainingHoleCount} remaining
          </div>
          {draftMessage ? <p className="focused-tray-message">{draftMessage}</p> : null}
        </div>

        <div className="focused-tray-grid">
          <section className="tray-section trace-summary-section" aria-label="Hole trace summary">
            <div className="tray-section-header">
              <span>Hole Trace Summary</span>
              <strong>Hole {activeHole.holeNumber}</strong>
            </div>
            <div className="trace-summary-grid">
              <span>Status</span>
              <strong>{activeHole.status}</strong>
              <span>Next click</span>
              <strong>{nextClickLabel}</strong>
              <span>Tee</span>
              <strong>{currentTraceDraft.teePoint ? "Set" : "Needed"}</strong>
              <span>Bends</span>
              <strong>{bendCount}/6</strong>
              <span>Green</span>
              <strong>{currentTraceDraft.greenPoint ? "Set" : "Needed"}</strong>
              <span>Par / yards</span>
              <strong>
                Par {activeHole.par ?? "-"} · {mainYardage(activeHole)}
              </strong>
            </div>
          </section>

          <section className="tray-section trace-workspace-section" aria-label="Hole selector and editing tools">
            <div className="trace-workspace-row">
              <div className="tray-section-header">
                <span>Hole Selector</span>
                <strong>{allHolesTraced ? "All traced" : `${remainingHoleCount} remaining`}</strong>
              </div>
              <div className="hole-circle-selector">
                <div className="hole-circle-row">
                  <span>Front</span>
                  <div className="hole-circle-list">{frontNine.map(renderHoleCircle)}</div>
                </div>
                <div className="hole-circle-row">
                  <span>Back</span>
                  <div className="hole-circle-list">{backNine.map(renderHoleCircle)}</div>
                </div>
              </div>
            </div>
            <div className="trace-workspace-row">
              <div className="tray-section-header">
                <span>Course Editing Tools</span>
                <strong>Hole {activeHole.holeNumber}</strong>
              </div>
              <div className="trace-tool-buttons">
                {!holeTraceReviewMode ? <div className="trace-tool-row primary-tool-row">
                  <button
                    className={`secondary-action tray-button ${
                      tracingModeActive && traceStep !== "green" ? "active-action" : ""
                    }`}
                    onClick={() => onStartHoleTrace(activeHole.holeNumber)}
                    type="button"
                  >
                    {tracingModeActive && traceStep !== "green" ? "Tracing Active" : "Trace This Hole"}
                  </button>
                  {tracingModeActive || currentTraceDraft.teePoint ? (
                    <button
                      className={`secondary-action tray-button ${traceStep === "green" ? "active-action" : ""}`}
                      disabled={!tracingModeActive || !currentTraceDraft.teePoint}
                      onClick={onSetTraceGreenStep}
                      type="button"
                    >
                      Set Green
                    </button>
                  ) : null}
                  <button
                    className="primary-action save-trace-button"
                    disabled={!canSaveTrace}
                    onClick={onSaveHoleTrace}
                    type="button"
                  >
                    Save Trace
                  </button>
                </div> : null}
                {!holeTraceReviewMode ? <div className="trace-tool-row secondary-tool-row">
                  <button className="secondary-action tray-button" onClick={onClearCurrentTrace} type="button">
                    Clear Draft
                  </button>
                  <button className="secondary-action tray-button" onClick={onCancelHoleTracing} type="button">
                    Cancel
                  </button>
                  <button className="secondary-action tray-button" onClick={onNextUntracedHole} type="button">
                    Next Untraced
                  </button>
                </div> : null}
                {activeHole.trace || canShowGeometryAction ? (
                  <div className="trace-tool-row review-tool-row">
                    {holeTraceReviewMode ? (
                      <div className="trace-review-navigation" aria-label="Hole trace review navigation">
                        <button className="secondary-action tray-button" onClick={() => onMoveSavedTrace("previous")} type="button">
                          Previous Saved
                        </button>
                        <button className="secondary-action tray-button" onClick={() => onMoveSavedTrace("next")} type="button">
                          Next Saved
                        </button>
                        <button className="primary-action tray-button" onClick={onNextTraceNeedingReview} type="button">
                          Next Needing Review
                        </button>
                        <button className="secondary-action tray-button" onClick={onExitHoleTraceReview} type="button">
                          Exit Review
                        </button>
                      </div>
                    ) : null}
                    {activeHole.trace ? (
                      <>
                        <button
                          className="secondary-action tray-button"
                          disabled={!canApproveTrace || activeHole.status === "approved"}
                          onClick={onApproveTrace}
                          type="button"
                        >
                          {activeHole.status === "approved" ? "Approved" : "Approve Trace"}
                        </button>
                        <button className="secondary-action tray-button" onClick={onEditTrace} type="button">
                          {activeHole.status === "approved" ? "Reopen & Edit" : "Edit Trace"}
                        </button>
                        {!holeTraceReviewMode ? (
                          <button className="secondary-action tray-button" onClick={onClearHoleTrace} type="button">
                            Clear Saved
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {canShowGeometryAction && !holeTraceReviewMode ? (
                      <button
                        className="primary-action save-trace-button"
                        disabled={!canGenerateGeometry}
                        onClick={onGenerateBasicGeometry}
                        type="button"
                      >
                        {generatedGeometryExists ? "Regenerate" : "Generate Geometry"}
                      </button>
                    ) : null}
                    {generatedGeometryExists && !holeTraceReviewMode ? (
                      <button className="secondary-action tray-button" onClick={onToggleGeneratedGeometry} type="button">
                        {generatedGeometryVisible ? "Hide Geometry" : "Show Geometry"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="tray-section trace-progress-section" aria-label="Trace progress">
            <div className="tray-section-header">
              <span>Progress</span>
              <strong>{tracedHoleCount}/{draftHolePlan.holes.length}</strong>
            </div>
            <div className="trace-summary-grid">
              <span>Tracing</span>
              <strong>{tracingModeActive ? "Active" : "Inactive"}</strong>
              <span>Approved</span>
              <strong>{approvedHoleCount}</strong>
              <span>Remaining</span>
              <strong>{remainingHoleCount}</strong>
            </div>
            {allHolesTraced ? (
              <p className="trace-complete-copy">
                All holes have traces. Next: review traces, then generate basic course geometry.
              </p>
            ) : null}
            {generatedGeometryExists ? (
              <p className="geometry-preview-copy">
                Geometry preview: {generatedGeometryHoleCount} holes ·{" "}
                {generatedGeometryVisible ? "visible" : "hidden"}
                {generatedGeometryStale ? " · trace changed, regenerate to update" : ""}
              </p>
            ) : null}
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="map-editing-tray" aria-label="Map editing tools">
      <div className="tray-header">
        <div>
          <span className="section-label">Map tools</span>
          <h2>{currentProject?.name ?? "Course workspace"}</h2>
        </div>
        <div className="tray-status">
          {isAdjustingLocation
            ? "Adjusting location"
            : isDrawingBoundary
              ? "Drawing boundary"
              : tracingModeActive
                ? traceStep === "green"
                  ? "Placing green"
                  : "Tracing hole"
                : currentProject?.status.boundaryConfirmed
                  ? "Boundary ready"
                  : currentProject?.status.locationConfirmed
                    ? "Boundary needed"
                    : "Location needs review"}
        </div>
      </div>

      {draftMessage ? <p className="tray-message">{draftMessage}</p> : null}

      <div className="tray-body">
        <div className="tray-guidance">
          <p>
            {isDrawingBoundary
              ? "Click around the outside of the golf course. Add at least 3 points, then confirm."
              : tracingModeActive || draftHolePlan
                ? traceInstruction
                : currentProject?.status.locationConfirmed
                  ? "Use the satellite map to draw or prepare this course."
                  : "Check that the marker is on the correct golf course before drawing."}
          </p>
          {isDrawingBoundary ? (
            <strong>{boundaryDraftPointCount} boundary points</strong>
          ) : tracingModeActive || draftHolePlan ? (
            <strong>
              Tee {currentTraceDraft.teePoint ? "set" : "needed"} · Green{" "}
              {currentTraceDraft.greenPoint ? "set" : "needed"} · Bends {bendCount}/6
            </strong>
          ) : null}
        </div>

        <div className="tray-actions">
          {!currentProject?.status.locationConfirmed ? (
            <>
              <button
                className="primary-action tray-button"
                disabled={isAdjustingLocation}
                onClick={onConfirmLocation}
                type="button"
              >
                Confirm Location
              </button>
              <button className="secondary-action tray-button" onClick={onStartAdjustLocation} type="button">
                Adjust Location
              </button>
            </>
          ) : null}

          {currentProject?.status.locationConfirmed &&
          !currentProject.status.boundaryConfirmed &&
          !isDrawingBoundary ? (
            <>
              <button className="primary-action tray-button" onClick={onStartManualBoundary} type="button">
                Draw Manually
              </button>
              <button className="secondary-action tray-button" onClick={onAutoBoundary} type="button">
                Auto Boundary
              </button>
            </>
          ) : null}

          {isDrawingBoundary ? (
            <>
              <button
                className="primary-action tray-button"
                disabled={!canConfirmBoundary}
                onClick={onConfirmBoundary}
                type="button"
              >
                Confirm Boundary
              </button>
              <button className="secondary-action tray-button" onClick={onClearBoundary} type="button">
                Clear Boundary
              </button>
              <button className="secondary-action tray-button" onClick={onCancelDrawing} type="button">
                Cancel Drawing
              </button>
            </>
          ) : null}

          {currentProject?.status.boundaryConfirmed && !autoBuilderOpen ? (
            <button className="primary-action tray-button" onClick={onOpenAutoBuilder} type="button">
              Open Satellite Auto-Builder
            </button>
          ) : null}

          {autoBuilderOpen && !draftHolePlan ? (
            <button className="primary-action tray-button" onClick={onGenerateDraftHolePlan} type="button">
              Generate Draft Hole Plan
            </button>
          ) : null}

        </div>
      </div>

      {autoBuilderOpen && !draftHolePlan ? (
        <div className="tray-readiness" aria-label="Satellite Auto-Builder readiness">
          <span>Course {readyLabel(Boolean(currentProject?.status.courseConfirmed))}</span>
          <span>Location {readyLabel(Boolean(currentProject?.status.locationConfirmed))}</span>
          <span>Boundary {readyLabel(Boolean(currentProject?.status.boundaryConfirmed))}</span>
          <span>Scorecard {currentProject?.scorecard ? "Found" : "Missing"}</span>
          <span>Draft plan needed</span>
        </div>
      ) : null}
    </section>
  );
}
