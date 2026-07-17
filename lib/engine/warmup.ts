// Warm-up ramp sets for the FIRST working exercise of a day.
// ~50% x 8 and ~75% x 3 off the working weight. Checkable but excluded from
// volume/progression/audit math (is_warmup / not persisted as working sets).

import { roundToPlate } from "./progression";

export interface RampSet {
  percent: number;
  weight: number;
  reps: number;
  is_warmup: true;
}

/** Two ramp sets from a target working weight. Returns [] if no weight known. */
export function rampSets(workingWeight: number | null): RampSet[] {
  if (!workingWeight || workingWeight <= 0) return [];
  return [
    { percent: 0.5, weight: roundToPlate(workingWeight * 0.5), reps: 8, is_warmup: true },
    { percent: 0.75, weight: roundToPlate(workingWeight * 0.75), reps: 3, is_warmup: true },
  ];
}

export const WARMUP_CARD_TEXT = "5 min easy cardio + ramp sets below";
