import type { CourseProject, DraftHolePlan, DraftHoleTrace } from "../../../packages/course-schema/src";

type SatelliteAutoBuilderPanelProps = {
  activeTracingHoleNumber: number | null;
  currentProject: CourseProject | null;
  currentTraceDraft: DraftHoleTrace;
  draftHolePlan: DraftHolePlan | null;
  onCancelHoleTracing: () => void;
  onClearCurrentTrace: () => void;
  onGenerateDraftHolePlan: () => void;
  onSaveHoleTrace: () => void;
  onSelectDraftHole: (holeNumber: number) => void;
  onSetTraceGreenStep: () => void;
  onStartHoleTrace: (holeNumber: number) => void;
  traceStep: "tee" | "centerline" | "green" | "review";
  tracingModeActive: boolean;
};

function readyLabel(isReady: boolean) {
  return isReady ? "Ready" : "Needed";
}

function mainYardage(yardages?: Record<string, number>) {
  if (!yardages) {
    return "-";
  }

  const entries = Object.entries(yardages);

  if (entries.length === 0) {
    return "-";
  }

  return entries.map(([tee, yards]) => `${tee}: ${yards}`).join(" / ");
}

export function SatelliteAutoBuilderPanel({
  activeTracingHoleNumber,
  currentProject,
  currentTraceDraft,
  draftHolePlan,
  onCancelHoleTracing,
  onClearCurrentTrace,
  onGenerateDraftHolePlan,
  onSaveHoleTrace,
  onSelectDraftHole,
  onSetTraceGreenStep,
  onStartHoleTrace,
  traceStep,
  tracingModeActive
}: SatelliteAutoBuilderPanelProps) {
  if (!currentProject) {
    return null;
  }

  const scorecard = currentProject.scorecard;
  const expectedHoles = scorecard?.holes.length || currentProject.holesCount || 18;
  const activeHole = draftHolePlan?.holes.find((hole) => hole.holeNumber === activeTracingHoleNumber);
  const tracedCount = draftHolePlan?.holes.filter((hole) => hole.trace).length ?? 0;
  const canSaveTrace = Boolean(currentTraceDraft.teePoint && currentTraceDraft.greenPoint);
  const canGenerate = Boolean(
    currentProject.status.courseConfirmed &&
      currentProject.status.locationConfirmed &&
      currentProject.status.boundaryConfirmed
  );

  return (
    <section className="auto-builder-panel" aria-label="Satellite Auto-Builder prep">
      <span className="section-label">Satellite Auto-Builder</span>
      <div className="drawing-state">Preparation workspace</div>
      <p>
        Draft hole plan is not traced geometry yet. This uses scorecard context to prepare the
        builder. Next milestone will add hole tracing tools.
      </p>

      <div className="metadata-card">
        <div className="summary-row">
          <span className="summary-label">Course</span>
          <span className="summary-value">{currentProject.name}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Location</span>
          <span className="summary-value">
            {currentProject.location.latitude.toFixed(5)}, {currentProject.location.longitude.toFixed(5)}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Expected holes</span>
          <span className="summary-value">{expectedHoles}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Tee sets</span>
          <span className="summary-value">{scorecard?.tees.length ?? 0}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Geometry</span>
          <span className={`geometry-chip ${currentProject.geometryStatus ?? "missing"}`}>
            {currentProject.geometryStatus ?? "missing"}
          </span>
        </div>
      </div>

      <div className="readiness-list">
        <div><span>Course confirmed</span><strong>{readyLabel(currentProject.status.courseConfirmed)}</strong></div>
        <div><span>Location confirmed</span><strong>{readyLabel(currentProject.status.locationConfirmed)}</strong></div>
        <div><span>Boundary confirmed</span><strong>{readyLabel(currentProject.status.boundaryConfirmed)}</strong></div>
        <div><span>Scorecard found</span><strong>{readyLabel(Boolean(scorecard))}</strong></div>
        <div><span>Scorecard confirmed</span><strong>{readyLabel(currentProject.status.scorecardConfirmed)}</strong></div>
      </div>

      {scorecard ? (
        <div className="scorecard-table-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Par</th>
                <th>Hcp</th>
                <th>Yardages</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.holes.map((hole) => (
                <tr key={hole.holeNumber}>
                  <td>{hole.holeNumber}</td>
                  <td>{hole.par ?? "-"}</td>
                  <td>{hole.handicapIndex ?? "-"}</td>
                  <td>{mainYardage(hole.yardagesByTee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No scorecard found yet. Draft hole plan will use generic hole placeholders.</p>
      )}

      <button className="primary-action" disabled={!canGenerate} onClick={onGenerateDraftHolePlan} type="button">
        Generate Draft Hole Plan
      </button>

      {draftHolePlan ? (
        <div className="draft-plan">
          <div className="drawing-state">Draft plan ready</div>
          <p>
            {tracedCount} of {draftHolePlan.holes.length} holes traced. Draft traces are not final
            playable geometry.
          </p>
          <div className="scorecard-table-wrap">
            <table className="scorecard-table">
              <thead>
                <tr>
                  <th>Hole</th>
                  <th>Par</th>
                  <th>Yardage</th>
                  <th>Status</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {draftHolePlan.holes.map((hole) => (
                  <tr
                    className={hole.holeNumber === activeTracingHoleNumber ? "is-active-row" : ""}
                    key={hole.holeNumber}
                    onClick={() => onSelectDraftHole(hole.holeNumber)}
                  >
                    <td>{hole.holeNumber}</td>
                    <td>{hole.par ?? "-"}</td>
                    <td>{mainYardage(hole.yardagesByTee)}</td>
                    <td>{hole.status}</td>
                    <td>{hole.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeHole ? (
            <div className="trace-panel">
              <span className="section-label">Hole {activeHole.holeNumber} trace</span>
              <p>
                {traceStep === "green"
                  ? "Next map click will place the green."
                  : "Click the tee, add any bend points, then mark the green."}
              </p>
              <div className="readiness-list">
                <div><span>Tracing mode</span><strong>{tracingModeActive ? "Active" : "Inactive"}</strong></div>
                <div><span>Next click</span><strong>{traceStep}</strong></div>
                <div><span>Tee point</span><strong>{currentTraceDraft.teePoint ? "Set" : "Needed"}</strong></div>
                <div><span>Bend points</span><strong>{currentTraceDraft.centerlinePoints.length}</strong></div>
                <div><span>Green point</span><strong>{currentTraceDraft.greenPoint ? "Set" : "Needed"}</strong></div>
              </div>
              <div className="boundary-controls">
                <button
                  className={`primary-action ${
                    tracingModeActive && traceStep !== "green" ? "active-action" : ""
                  }`}
                  onClick={() => onStartHoleTrace(activeHole.holeNumber)}
                  type="button"
                >
                  {tracingModeActive && traceStep !== "green" ? "Tracing Active" : "Trace This Hole"}
                </button>
                <button
                  className={`secondary-action ${traceStep === "green" ? "active-action" : ""}`}
                  onClick={onSetTraceGreenStep}
                  type="button"
                >
                  Set Next Click as Green
                </button>
                <button className="secondary-action" onClick={onClearCurrentTrace} type="button">
                  Clear Current Trace
                </button>
                <button className="secondary-action" onClick={onCancelHoleTracing} type="button">
                  Cancel Tracing
                </button>
                <button className="primary-action" disabled={!canSaveTrace} onClick={onSaveHoleTrace} type="button">
                  Save Hole Trace
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
