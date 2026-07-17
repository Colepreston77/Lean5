// Deload logic. Research-backed choice (2024-2026): keep intensity (load),
// cut volume ~50%, RIR 3-4, no progression. Deload is every Nth (default 4th) week.

import type { ExerciseSlot } from "./types";

export const DEFAULT_MESO_WEEKS = 4;

/** Is this 1-indexed week the deload week of the mesocycle? (the last week). */
export function isDeloadWeek(week: number, weekCount = DEFAULT_MESO_WEEKS): boolean {
  return week === weekCount;
}

/** Half the sets, rounded, floor of 1. 3 -> 2, 2 -> 1, 4 -> 2, 1 -> 1. */
export function deloadSets(sets: number): number {
  return Math.max(1, Math.round(sets / 2));
}

/** Deload RIR cue shown on cards during the deload week. */
export const DELOAD_RIR = "3-4";

/** Max extra sets a ramp slot gains over its base by the peak (pre-deload) week. */
export const MAX_RAMP_SETS = 2;

/** Extra sets a ramp slot gets in a given training week (wk1: 0, wk2: 1, wk3: 2...). */
export function rampBonus(week: number): number {
  return Math.min(MAX_RAMP_SETS, Math.max(0, week - 1));
}

/**
 * Working set count for a slot in a given week, accounting for both the weekly
 * volume ramp (weeks 1..N-1) and the deload (final week halves the BASE sets).
 */
export function weeklySlotSets(
  baseSets: number,
  week: number,
  weekCount: number,
  isRamp: boolean
): number {
  if (isDeloadWeek(week, weekCount)) return deloadSets(baseSets);
  return baseSets + (isRamp ? rampBonus(week) : 0);
}

/**
 * Apply deload to a slot for display/scheduling: halve sets, bump RIR cue, keep
 * the weight (handled by progression staying flat). Warm-up/cardio slots are
 * passed through unchanged.
 */
export function deloadSlot(slot: ExerciseSlot): ExerciseSlot {
  if (slot.is_warmup) return slot;
  return { ...slot, sets: deloadSets(slot.sets), rir_target: DELOAD_RIR };
}
