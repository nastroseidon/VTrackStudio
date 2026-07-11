import type { CourseProject } from "../../../packages/course-schema/src";

type ScorecardVerificationPanelProps = {
  currentProject: CourseProject | null;
  onClearConfirmation: () => void;
  onConfirmScorecard: () => void;
};

function teeMeta(tee: NonNullable<CourseProject["scorecard"]>["tees"][number]) {
  const facts = [
    tee.totalYardage ? `${tee.totalYardage} yd` : null,
    tee.courseRating ? `Rating ${tee.courseRating}` : null,
    tee.slopeRating ? `Slope ${tee.slopeRating}` : null
  ].filter(Boolean);

  return facts.join(" / ") || "Details unavailable";
}

export function ScorecardVerificationPanel({
  currentProject,
  onClearConfirmation,
  onConfirmScorecard
}: ScorecardVerificationPanelProps) {
  const scorecard = currentProject?.scorecard;
  const isConfirmed = Boolean(currentProject?.status.scorecardConfirmed);

  if (!currentProject?.status.courseConfirmed) {
    return null;
  }

  return (
    <section className="scorecard-panel" aria-label="Scorecard verification">
      <span className="section-label">Scorecard review</span>
      <div className="drawing-state">
        {scorecard ? (isConfirmed ? "Scorecard confirmed" : "Scorecard found, needs review") : "No scorecard found yet"}
      </div>
      <p>
        Provider scorecards are helpful starting points. Review tee sets, pars, yardages, and
        handicap rows before marking them ready.
      </p>

      {scorecard ? (
        <>
          <div className="scorecard-course-name">{currentProject.name}</div>
          <div className="tee-summary compact-tee-summary">
            {scorecard.tees.map((tee) => (
              <div className="tee-row" key={tee.id}>
                <strong>{tee.name}</strong>
                <span>{teeMeta(tee)}</span>
              </div>
            ))}
          </div>

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
                    <td>
                      {scorecard.tees
                        .map((tee) => {
                          const yardage = hole.yardagesByTee[tee.id];

                          return yardage ? `${tee.name}: ${yardage}` : null;
                        })
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isConfirmed ? (
            <button className="secondary-action" onClick={onClearConfirmation} type="button">
              Mark Needs Correction
            </button>
          ) : (
            <button className="primary-action" onClick={onConfirmScorecard} type="button">
              Confirm Scorecard
            </button>
          )}
        </>
      ) : (
        <button className="secondary-action" disabled type="button">
          Confirm Scorecard
        </button>
      )}
    </section>
  );
}
