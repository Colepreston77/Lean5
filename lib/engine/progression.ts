// Double-progression engine + the progression-hint chip.
// Pure functions: given last session's working sets for a slot, decide the next
// target and the UI hint. No DB, no dates.

import { bestSetByE1RM, isLoggedSet, type WeightReps } from "./oneRepMax";

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

/** Round to a sane gym increment (nearest 2.5 lb by default). */
export function roundToPlate(weight: number, step = 2.5): number {
  return Math.round(weight / step) * step;
}

/**
 * Double progression, anchored to the BEST set (highest estimated 1RM) from last
 * time — not the lightest. This matches how the athlete actually loads: if you
 * ramp 135 -> 185 -> 235, the 235 set is your real working level, so that's what
 * the next target builds on. From that best set:
 *   - hit the TOP of the rep range  -> add weight, reset reps to the bottom
 *   - landed mid-range              -> hold that weight, beat the reps
 *   - fell short of the bottom      -> too heavy, back off ~7.5% and rebuild
 */
export function computeNextTarget(ctx: ProgressionContext): NextTarget {
  const { lastSets, repsLow, repsHigh, increment } = ctx;
  const sets = lastSets.filter(isLoggedSet);

  if (sets.length === 0) {
    return { action: "first", targetWeight: null, targetRepsLow: repsLow, targetRepsHigh: repsHigh };
  }

  // The strongest set last time is the anchor for the next target.
  const best = bestSetByE1RM(sets)!;
  const w = best.weight;

  if (best.reps >= repsHigh) {
    return {
      action: "increase",
      targetWeight: roundToPlate(w + increment),
      targetRepsLow: repsLow,
      targetRepsHigh: repsHigh,
    };
  }

  // Even the best set missed the bottom of the range -> back off.
  if (best.reps < repsLow) {
    return {
      action: "back_off",
      targetWeight: roundToPlate(w * 0.925),
      targetRepsLow: repsLow,
      targetRepsHigh: repsHigh,
    };
  }

  // Mid-range: hold the best set's weight, aim to add reps toward the top.
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

  const sets = ctx.lastSets.filter(isLoggedSet);
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
