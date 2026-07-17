// Estimated 1RM via the Epley formula. Used for progress charts + PR detection.
// e1RM = weight * (1 + reps/30). At 1 rep this returns the weight itself.

export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface WeightReps {
  weight: number;
  reps: number;
}

/** Best set by estimated 1RM. Returns null if no valid sets. */
export function bestSetByE1RM(sets: WeightReps[]): WeightReps | null {
  let best: WeightReps | null = null;
  let bestE1RM = -1;
  for (const s of sets) {
    const e = epley1RM(s.weight, s.reps);
    if (e > bestE1RM) {
      bestE1RM = e;
      best = s;
    }
  }
  return best;
}
