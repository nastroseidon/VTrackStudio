import type { ConfidenceScore } from "../../../packages/course-schema/src";

type ConfidenceBadgeProps = {
  score: ConfidenceScore;
};

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const percent = Math.round(score * 100);
  const level = score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low";

  return <span className={`confidence-badge ${level}`}>{percent}%</span>;
}
