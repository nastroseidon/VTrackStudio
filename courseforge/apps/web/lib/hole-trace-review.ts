import type { DraftHole, DraftHolePlan } from "../../../packages/course-schema/src";

export type HoleTraceProgress = {
  approved: number;
  remaining: number;
  traced: number;
};

export function hasSavedTrace(hole: DraftHole) {
  return Boolean(hole.trace);
}

export function needsTraceReview(hole: DraftHole) {
  return Boolean(hole.trace && hole.status !== "approved");
}

export function approveHoleTrace(plan: DraftHolePlan, holeNumber: number): DraftHolePlan {
  return {
    ...plan,
    holes: plan.holes.map((hole) =>
      hole.holeNumber === holeNumber && hole.trace ? { ...hole, status: "approved" } : hole
    )
  };
}

export function reopenHoleTrace(plan: DraftHolePlan, holeNumber: number): DraftHolePlan {
  return {
    ...plan,
    holes: plan.holes.map((hole) =>
      hole.holeNumber === holeNumber && hole.trace ? { ...hole, status: "needs review" } : hole
    )
  };
}

export function findReviewStartHole(plan: DraftHolePlan, preferredHoleNumber: number | null) {
  const preferred = plan.holes.find(
    (hole) => hole.holeNumber === preferredHoleNumber && hasSavedTrace(hole)
  );

  return preferred ?? plan.holes.find(needsTraceReview) ?? plan.holes.find(hasSavedTrace) ?? null;
}

export function findAdjacentSavedTrace(
  plan: DraftHolePlan,
  activeHoleNumber: number | null,
  direction: "previous" | "next"
) {
  const savedHoles = plan.holes.filter(hasSavedTrace);

  if (!savedHoles.length) {
    return null;
  }

  const activeIndex = savedHoles.findIndex((hole) => hole.holeNumber === activeHoleNumber);

  if (activeIndex < 0) {
    return savedHoles[0];
  }

  const adjacentIndex = direction === "next" ? activeIndex + 1 : activeIndex - 1;

  return savedHoles[adjacentIndex] ?? null;
}

export function findNextTraceNeedingReview(plan: DraftHolePlan, activeHoleNumber: number | null) {
  const activeIndex = plan.holes.findIndex((hole) => hole.holeNumber === activeHoleNumber);
  const orderedHoles =
    activeIndex < 0
      ? plan.holes
      : [...plan.holes.slice(activeIndex + 1), ...plan.holes.slice(0, activeIndex + 1)];

  return orderedHoles.find(needsTraceReview) ?? null;
}

export function getHoleTraceProgress(plan: DraftHolePlan | null): HoleTraceProgress {
  const holes = plan?.holes ?? [];
  const traced = holes.filter(hasSavedTrace).length;

  return {
    traced,
    approved: holes.filter((hole) => hole.status === "approved" && hasSavedTrace(hole)).length,
    remaining: Math.max(holes.length - traced, 0)
  };
}
