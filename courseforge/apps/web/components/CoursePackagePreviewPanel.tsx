import type { CoursePackageReadiness } from "../lib/course-package/build-course-package";

type CoursePackagePreviewPanelProps = {
  allHolesTraced: boolean;
  draftHolePlanCount: number;
  generatedGeometryHoleCount: number;
  generatedGeometryStale: boolean;
  onExportCoursePackage: () => void;
  readiness: CoursePackageReadiness;
  scorecardConfirmed: boolean;
  tracedHoleCount: number;
};

export function CoursePackagePreviewPanel({
  allHolesTraced,
  draftHolePlanCount,
  generatedGeometryHoleCount,
  generatedGeometryStale,
  onExportCoursePackage,
  readiness,
  scorecardConfirmed,
  tracedHoleCount
}: CoursePackagePreviewPanelProps) {
  return (
    <details className="package-preview-panel" open={generatedGeometryHoleCount > 0}>
      <summary>
        <span>Course package preview</span>
        <strong>{readiness.canExport ? "Ready" : "Needs checks"}</strong>
      </summary>

      <div className="debug-grid compact-package-grid">
        <span>Hole count</span>
        <strong>{draftHolePlanCount}</strong>
        <span>Traced holes</span>
        <strong>{tracedHoleCount}</strong>
        <span>Scorecard confirmed</span>
        <strong>{String(scorecardConfirmed)}</strong>
        <span>All holes traced</span>
        <strong>{String(allHolesTraced)}</strong>
        <span>Geometry stale</span>
        <strong>{String(generatedGeometryStale)}</strong>
      </div>

      <button
        className="primary-action compact-action"
        disabled={!readiness.canExport}
        onClick={onExportCoursePackage}
        type="button"
      >
        Export Course JSON
      </button>
      <p className="soft-status">This is separate from Project File backup.</p>
      {readiness.blockingIssues.length > 0 || readiness.warnings.length > 0 ? (
        <details className="package-readiness-details">
          <summary>{readiness.blockingIssues.length + readiness.warnings.length} package notes</summary>
          {readiness.blockingIssues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
          {readiness.warnings.map((warning) => (
            <p key={warning.code}>{warning.message}</p>
          ))}
        </details>
      ) : null}
    </details>
  );
}
