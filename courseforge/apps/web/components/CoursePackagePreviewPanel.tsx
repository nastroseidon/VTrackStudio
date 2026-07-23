import type { CoursePackageReadiness } from "../lib/course-package/build-course-package";

type CoursePackagePreviewPanelProps = {
  onExportCoursePackage: () => void;
  onDownloadCourseBundle: () => void;
  readiness: CoursePackageReadiness;
};

export function CoursePackagePreviewPanel({
  onExportCoursePackage,
  onDownloadCourseBundle,
  readiness
}: CoursePackagePreviewPanelProps) {
  const { coverage } = readiness;

  return (
    <details className="package-preview-panel" open>
      <summary>
        <span>Preview JSON readiness</span>
        <strong>{readiness.canExport ? "Ready" : "Action required"}</strong>
      </summary>

      <div className="debug-grid compact-package-grid">
        <span>Expected holes</span>
        <strong>{coverage.expectedHoles}</strong>
        <span>Complete traces</span>
        <strong>{coverage.completeTraces}/{coverage.expectedHoles}</strong>
        <span>Approved traces</span>
        <strong>{coverage.approvedTraces}/{coverage.expectedHoles}</strong>
        <span>Current preview geometry</span>
        <strong>{coverage.currentGeometry}/{coverage.expectedHoles}</strong>
      </div>

      <button
        className="primary-action compact-action"
        disabled={!readiness.canExport}
        onClick={onExportCoursePackage}
        type="button"
      >
        Export Preview JSON
      </button>
      <button
        className="secondary-action compact-action"
        disabled={!readiness.canExport}
        onClick={onDownloadCourseBundle}
        type="button"
      >
        Download Course Bundle (.zip)
      </button>
      <p className="soft-status">Neutral preview JSON only. This is not a simulator-ready package or a Project File backup. The bundle adds any heightmap artifact.</p>
      {readiness.blockingIssues.length > 0 ? (
        <section className="package-readiness-details" aria-label="Preview export blocking issues">
          <strong>Complete these next</strong>
          {readiness.blockingIssues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </section>
      ) : null}
      {readiness.warnings.length > 0 ? (
        <details className="package-readiness-details">
          <summary>{readiness.warnings.length} non-blocking preview warnings</summary>
          {readiness.warnings.map((warning) => (
            <p key={warning.code}>{warning.message}</p>
          ))}
        </details>
      ) : null}
    </details>
  );
}
