// Double-progression engine + the progression-hint chip.
// Pure functions: given last session's working sets for a slot, decide the next
// target and the UI hint. No DB, no dates.

import { bestSetByE1RM, type WeightReps } from "./oneRepMax";

export type ProgressionAction =
  | "increase" // hit top of range on all sets -> add weight, reset reps to bottom
  | "hold" // mid-range -> same weight, beat last
  | "back_off" // missed bottom of range -> drop 5-10%, rebuild
  | "first"; // no history -> find your weight

export interface NextTarget {
  action: ProgressionAction;
  targetWeight: number | null;
  targetRepsLow: number;
  targetRepsHigh: number;
}

export interface ProgressionContext {
  /** Completed working sets from the most recent session for THIS slot. */
  lastSets: WeightReps[];
  repsLow: number;
  repsHigh: number;
  /** Load added when progression triggers (lb). */
  increment: number;
}

/** The weight sustained across all working sets = the lowest working-set weight. */
function workingWeight(sets: WeightReps[]): number {
  return sets.reduce((min, s) => (s.weight < min ? s.weight : min), Infinity);
}

/** Round to a sane gym increment (nearest 2.5 lb by default). */
export function roundToPlate(weight: number, step = 2.5): number {
  return Math.round(weight / step) * step;
}

/**
 * Double progression: when every working set hits the TOP of the rep range at a
 * given weight, next session adds weight and resets target reps to the bottom.
 * Otherwise hold the weight (beat last time). If the bottom of the range was
 * missed entirely, back off ~7.5% and rebuild.
 */
export function computeNextTarget(ctx: ProgressionContext): NextTarget {
  const { lastSets, repsLow, repsHigh, increment } = ctx;
  const sets = lastSets.filter((s) => s.weight > 0 && s.reps > 0);

  if (sets.length === 0) {
    return { action: "first", targetWeight: null, targetRepsLow: repsLow, targetRepsHigh: repsHigh };
  }

  const w = workingWeight(sets);
  const allHitTop = sets.every((s) => s.reps >= repsHigh);
  const bestReps = Math.max(...sets.map((s) => s.reps));

  if (allHitTop) {
    return {
      action: "increase",
      targetWeight: roundToPlate(w + increment),
      targetRepsLow: repsLow,
      targetRepsHigh: repsHigh,
    };
  }

  // Missed the bottom of the range even on the best set -> back off.
  if (bestReps < repsLow) {
    return {
      action: "back_off",
      targetWeight: roundToPlate(w * 0.925),
      targetRepsLow: repsLow,
      targetRepsHigh: repsHigh,
    };
  }

  // Mid-range: hold weight, aim to add reps toward the top.
  return { action: "hold", targetWeight: w, targetRepsLow: repsLow, targetRepsHigh: repsHigh };
}

export type HintColor = "green" | "neutral" | "yellow" | "blue" | "grey";

export interface ProgressionHint {
  color: HintColor;
  text: string;
  action: ProgressionAction | "deload";
}

export interface HintContext extends ProgressionContext {
  isDeload?: boolean;
  hasHistory?: boolean;
}

/**
 * The small chip on each exercise card. Deterministic — no AI.
 * Deload always wins; cold start (no history) shows "find your weight".
 */
export function getProgressionHint(ctx: HintContext): ProgressionHint {
  if (ctx.isDeload) {
    return { color: "blue", text: "Easy day — half sets, same weight", action: "deload" };
  }

  const sets = ctx.lastSets.filter((s) => s.weight > 0 && s.reps > 0);
  if (!ctx.hasHistory || sets.length === 0) {
    return { color: "grey", text: "First time — find your weight", action: "first" };
  }

  const next = computeNextTarget(ctx);
  switch (next.action) {
    case "increase":
      return {
        color: "green",
        text: `↑ Add ${ctx.increment} lb, aim for ${ctx.repsLow}s`,
        action: "increase",
      };
    case "back_off":
      return { color: "yellow", text: "↓ Drop 5-10%, rebuild", action: "back_off" };
    case "hold": {
      const best = bestSetByE1RM(sets);
      const beat = best ? `beat ${best.weight} x ${best.reps}` : "beat last time";
      return { color: "neutral", text: `→ Same weight, ${beat}`, action: "hold" };
    }
    default:
      return { color: "grey", text: "First time — find your weight", action: "first" };
  }
}
