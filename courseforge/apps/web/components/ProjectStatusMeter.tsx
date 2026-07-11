import type { CourseProject, CourseProjectStatus } from "../../../packages/course-schema/src";

const meterItems: Array<{
  key: keyof CourseProjectStatus;
  label: string;
}> = [
  { key: "courseConfirmed", label: "Course" },
  { key: "locationConfirmed", label: "Location" },
  { key: "boundaryConfirmed", label: "Boundary" },
  { key: "scorecardConfirmed", label: "Scorecard" },
  { key: "holesTraced", label: "Holes" },
  { key: "elevationGenerated", label: "Elevation" },
  { key: "packageExported", label: "Package" }
];

function meterLabel(item: keyof CourseProjectStatus, status: CourseProjectStatus, project: CourseProject | null) {
  if (item === "elevationGenerated" && project?.elevationModel?.status === "mock") {
    return "Mock";
  }

  if (item === "elevationGenerated" && project?.elevationModel?.status === "stale") {
    return "Stale";
  }

  if (status[item]) {
    return "Ready";
  }

  if (item === "scorecardConfirmed") {
    return project?.scorecard ? "Review" : "Missing";
  }

  return "Pending";
}

export function ProjectStatusMeter({
  currentProject,
  status
}: {
  currentProject: CourseProject | null;
  status: CourseProjectStatus;
}) {
  return (
    <section className="project-status-meter" aria-label="Project status meter">
      {meterItems.map((item) => {
        const isReady = status[item.key];
        const label = meterLabel(item.key, status, currentProject);

        return (
          <div className={`meter-chip ${isReady ? "is-ready" : "is-pending"}`} key={item.key}>
            <span>{item.label}</span>
            <strong>{isReady && label === "Ready" ? "✓" : label}</strong>
          </div>
        );
      })}
    </section>
  );
}
