// Estimated 1RM via the Epley formula. Used for progress charts + PR detection.
// e1RM = weight * (1 + reps/30). At 1 rep this returns the weight itself.
// Weight may be negative for machine-assisted pull-ups/chin-ups (the machine
// unloads bodyweight), so the e1RM can legitimately be negative too.

export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface WeightReps {
  weight: number;
  reps: number;
}

/**
 * A set counts as real logged history if reps were performed. Weight can be any
 * finite number: negative (machine-assisted) or zero (bodyweight) are valid.
 */
export function isLoggedSet(s: WeightReps): boolean {
  return Number.isFinite(s.weight) && s.reps > 0;
}

/** Best set by estimated 1RM. Returns null if no valid sets. */
export function bestSetByE1RM(sets: WeightReps[]): WeightReps | null {
  let best: WeightReps | null = null;
  let bestE1RM = -Infinity;
  for (const s of sets) {
    const e = epley1RM(s.weight, s.reps);
    if (e > bestE1RM) {
      bestE1RM = e;
      best = s;
    }
  }
  return best;
}
