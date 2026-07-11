import { describe, expect, it } from "vitest";
import type { DraftHolePlan } from "../../../../packages/course-schema/src";
import {
  approveHoleTrace,
  findAdjacentSavedTrace,
  findNextTraceNeedingReview,
  findReviewStartHole,
  getHoleTraceProgress,
  reopenHoleTrace
} from "../../lib/hole-trace-review";
import { getCoursePackageWarnings } from "../../lib/course-package/build-course-package";

const trace = {
  teePoint: { latitude: 41.1, longitude: -85.1 },
  centerlinePoints: [{ latitude: 41.2, longitude: -85.2 }],
  greenPoint: { latitude: 41.3, longitude: -85.3 },
  source: "manual" as const,
  confidence: 0.8
};

function createReviewPlan(): DraftHolePlan {
  return {
    generatedAt: "2026-07-11T12:00:00.000Z",
    source: "placeholder",
    holes: [
      { holeNumber: 1, status: "trace saved", confidence: "low", trace },
      { holeNumber: 2, status: "needs tracing", confidence: "low" },
      { holeNumber: 3, status: "approved", confidence: "low", trace },
      { holeNumber: 4, status: "needs review", confidence: "low", trace }
    ]
  };
}

describe("hole trace review", () => {
  it("transitions a saved trace to approved and updates progress", () => {
    const approved = approveHoleTrace(createReviewPlan(), 1);

    expect(approved.holes[0].status).toBe("approved");
    expect(getHoleTraceProgress(approved)).toEqual({ traced: 3, approved: 2, remaining: 1 });
    expect(getCoursePackageWarnings(null, approved, false)).toContainEqual({
      code: "hole-traces-need-review",
      message: "1 saved hole trace needs review."
    });
  });

  it("reopens an approved trace without changing its geometry", () => {
    const plan = createReviewPlan();
    const reopened = reopenHoleTrace(plan, 3);

    expect(reopened.holes[2]).toMatchObject({ status: "needs review", trace });
    expect(getHoleTraceProgress(reopened)).toEqual({ traced: 3, approved: 0, remaining: 1 });
  });

  it("selects the preferred saved trace or the first trace needing review", () => {
    const plan = createReviewPlan();

    expect(findReviewStartHole(plan, 3)?.holeNumber).toBe(3);
    expect(findReviewStartHole(plan, 2)?.holeNumber).toBe(1);
  });

  it("moves only among saved traces and finds the next one needing review", () => {
    const plan = createReviewPlan();

    expect(findAdjacentSavedTrace(plan, 1, "next")?.holeNumber).toBe(3);
    expect(findAdjacentSavedTrace(plan, 3, "previous")?.holeNumber).toBe(1);
    expect(findNextTraceNeedingReview(plan, 1)?.holeNumber).toBe(4);
    expect(findNextTraceNeedingReview(plan, 4)?.holeNumber).toBe(1);
  });

  it("preserves review statuses through the existing JSON serialization path", () => {
    const reviewed = reopenHoleTrace(approveHoleTrace(createReviewPlan(), 1), 3);
    const restored = JSON.parse(JSON.stringify({ draftHolePlan: reviewed })) as {
      draftHolePlan: DraftHolePlan;
    };

    expect(restored.draftHolePlan).toEqual(reviewed);
    expect(restored.draftHolePlan.holes.map((hole) => hole.status)).toEqual([
      "approved",
      "needs tracing",
      "needs review",
      "needs review"
    ]);
  });
});
