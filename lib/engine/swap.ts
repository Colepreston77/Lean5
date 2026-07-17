// Swap system: cycle a slot to another exercise with the same primary_muscle and
// a compatible movement_pattern. After MAX_SWAPS in a session the slot locks.

import type { Exercise, Muscle } from "./types";

export const MAX_SWAPS_PER_SLOT = 3;
export const SWAP_LOCK_MESSAGE = "Pick one — the lift isn't the problem.";

/** Patterns that count as interchangeable for a given muscle (compatible swaps). */
const COMPATIBLE: Record<string, string[]> = {
  horizontal_press: ["horizontal_press"],
  vertical_press: ["vertical_press"],
  vertical_pull: ["vertical_pull"],
  horizontal_pull: ["horizontal_pull"],
  lateral_raise: ["lateral_raise"],
  rear_delt_fly: ["rear_delt_fly"],
  elbow_flexion: ["elbow_flexion"],
  elbow_extension: ["elbow_extension"],
  squat: ["squat", "lunge"],
  lunge: ["lunge", "squat"],
  hinge: ["hinge"],
  knee_flexion: ["knee_flexion"],
  knee_extension: ["knee_extension"],
  calf_raise: ["calf_raise"],
  spinal_flexion: ["spinal_flexion", "hip_flexion"],
  hip_flexion: ["hip_flexion", "spinal_flexion"],
  cardio: ["cardio"],
  superset: ["superset"],
};

/**
 * Candidate exercises a slot may swap to. Prefers the current exercise's own
 * rotation_pool order, then any library exercise matching muscle + pattern.
 * Excludes the current exercise. Deterministic order for stable cycling.
 */
export function swapCandidates(
  current: Exercise,
  library: Exercise[],
  opts?: { equipment?: Exercise["equipment"][] }
): Exercise[] {
  const compat = COMPATIBLE[current.movement_pattern] ?? [current.movement_pattern];
  const byId = new Map(library.map((e) => [e.id, e]));

  const pool: Exercise[] = [];
  const seen = new Set<string>([current.id]);

  // 1. rotation_pool first, in listed order
  for (const id of current.rotation_pool) {
    const ex = byId.get(id);
    if (ex && !seen.has(ex.id)) {
      pool.push(ex);
      seen.add(ex.id);
    }
  }
  // 2. everything else matching muscle + compatible pattern
  for (const ex of library) {
    if (seen.has(ex.id)) continue;
    if (ex.primary_muscle !== current.primary_muscle) continue;
    if (!compat.includes(ex.movement_pattern)) continue;
    pool.push(ex);
    seen.add(ex.id);
  }

  if (opts?.equipment && opts.equipment.length) {
    return pool.filter((e) => opts.equipment!.includes(e.equipment));
  }
  return pool;
}

/** Next exercise in the cycle after `current`, wrapping around the candidate list. */
export function nextSwap(current: Exercise, library: Exercise[]): Exercise | null {
  const cands = swapCandidates(current, library);
  return cands.length ? cands[0] : null;
}

export function swapsLocked(swapCount: number): boolean {
  return swapCount >= MAX_SWAPS_PER_SLOT;
}

/** Does a candidate still satisfy the slot's primary muscle? (audit safety) */
export function matchesSlotMuscle(candidate: Exercise, slotMuscle: Muscle | "cardio"): boolean {
  return candidate.primary_muscle === slotMuscle;
}
