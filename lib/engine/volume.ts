// Weekly volume per muscle using FRACTIONAL set counting (2024 dose-response
// methodology): the primary muscle gets 1.0 set, each secondary gets 0.5.
// Cardio and warm-up sets are excluded.

import type { Exercise, Muscle } from "./types";
import { MUSCLES } from "./types";

// Display "ideal" band shown in the Progress view.
export const VOLUME_IDEAL_MIN = 12;
export const VOLUME_IDEAL_MAX = 18;

// Audit WARN band — deliberately wide. It exists to catch a generated/swapped
// plan that genuinely STARVES or FLOODS a muscle, not to nitpick the baseline.
// (~4 fractional sets is the stimulation threshold; we warn a hair below that.)
export const VOLUME_WARN_MIN = 6;
export const VOLUME_WARN_MAX = 22;

// Muscles this program biases toward — warn if they dip below their target.
export const BIAS_MUSCLES: Muscle[] = ["side_delts", "rear_delts", "lats", "mid_back"];
export const BIAS_MIN = 8;

// Muscles this program never trains directly by design — they only ever accrue
// fractional (secondary) volume, so a low count is expected, not a problem.
export const SECONDARY_ONLY_MUSCLES: Muscle[] = ["forearms", "spinal_erectors"];

export interface VolumeSlot {
  sets: number;
  exercise: Pick<Exercise, "primary_muscle" | "secondary_muscles">;
  is_warmup?: boolean;
}

export type VolumeMap = Record<Muscle, number>;

function emptyVolume(): VolumeMap {
  return MUSCLES.reduce((acc, m) => {
    acc[m] = 0;
    return acc;
  }, {} as VolumeMap);
}

/** Fractional weekly sets per muscle across all given slots. */
export function weeklyVolume(slots: VolumeSlot[]): VolumeMap {
  const vol = emptyVolume();
  for (const slot of slots) {
    if (slot.is_warmup) continue;
    const { primary_muscle, secondary_muscles } = slot.exercise;
    if (primary_muscle === "cardio") continue;
    vol[primary_muscle] += slot.sets * 1.0;
    for (const sec of secondary_muscles) {
      vol[sec] += slot.sets * 0.5;
    }
  }
  return vol;
}

export interface VolumeIssue {
  muscle: Muscle;
  sets: number;
  kind: "below_min" | "above_max" | "below_bias";
}

/** Muscles outside the audit band, plus bias muscles below their soft floor. */
export function volumeIssues(vol: VolumeMap): VolumeIssue[] {
  const issues: VolumeIssue[] = [];
  for (const m of MUSCLES) {
    const sets = vol[m];
    if (sets === 0) continue; // muscle not trained at all this week is fine to skip here
    const secondaryOnly = SECONDARY_ONLY_MUSCLES.includes(m);
    if (sets < VOLUME_WARN_MIN && !secondaryOnly) {
      issues.push({ muscle: m, sets, kind: "below_min" });
    } else if (sets > VOLUME_WARN_MAX) {
      issues.push({ muscle: m, sets, kind: "above_max" });
    }
    if (BIAS_MUSCLES.includes(m) && sets < BIAS_MIN) {
      issues.push({ muscle: m, sets, kind: "below_bias" });
    }
  }
  return issues;
}
