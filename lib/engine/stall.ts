// Stall detection: no increase in best set (by e1RM) for N consecutive sessions.

import { epley1RM, type WeightReps } from "./oneRepMax";

export const STALL_THRESHOLD = 3;

/**
 * `sessionBests` is ordered oldest -> newest, one best set per session for a slot.
 * Returns true if the last STALL_THRESHOLD sessions show no improvement in e1RM
 * (each session <= the best seen before that run).
 */
export function isStalled(sessionBests: WeightReps[], threshold = STALL_THRESHOLD): boolean {
  const valid = sessionBests.filter((s) => s.weight > 0 && s.reps > 0);
  if (valid.length < threshold) return false;

  const e1rms = valid.map((s) => epley1RM(s.weight, s.reps));
  const window = e1rms.slice(e1rms.length - threshold);
  const prior = e1rms.slice(0, e1rms.length - threshold);
  // Baseline = best achieved before the window. With no prior history, use the
  // first session of the window so a flat run (e.g. 100x8 x3) counts as a stall.
  const baseline = prior.length ? Math.max(...prior) : window[0];

  // Stalled if nothing in the window beats the baseline (tiny epsilon for FP).
  const eps = 0.01;
  return window.every((e) => e <= baseline + eps);
}

export type StallOption = "swap_variant" | "back_off_rebuild";

export interface StallFlag {
  stalled: boolean;
  options: StallOption[];
}

export function stallFlag(sessionBests: WeightReps[], threshold = STALL_THRESHOLD): StallFlag {
  const stalled = isStalled(sessionBests, threshold);
  return {
    stalled,
    options: stalled ? ["swap_variant", "back_off_rebuild"] : [],
  };
}
