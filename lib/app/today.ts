// Assembles the Today view model from static program data + dynamic history.
// Pure function so the composition (swaps, deload, cut mode, hints, warmups) is
// testable without a DB.

import type { Exercise, ProgramDay } from "@/lib/engine/types";
import { getExercise } from "@/lib/seed/exercises";
import { computeNextTarget, getProgressionHint, type NextTarget, type ProgressionHint } from "@/lib/engine/progression";
import { weeklySlotSets, DELOAD_RIR } from "@/lib/engine/deload";
import { rampSets, WARMUP_CARD_TEXT, type RampSet } from "@/lib/engine/warmup";

export interface LastSet {
  weight: number;
  reps: number;
  set_number: number;
}

export interface SlotView {
  slot_id: string;
  group: string;
  exercise: Exercise;
  sets: number;
  reps_low: number;
  reps_high: number;
  reps_label?: string;
  rir_target: string;
  is_cardio: boolean;
  is_substituted: boolean;
  lastSets: LastSet[];
  target: NextTarget;
  hint: ProgressionHint;
  ramp: RampSet[];
}

export interface DayGroup {
  group: string;
  slots: SlotView[];
}

export interface DayView {
  day_order: number;
  name: string;
  week: number;
  isDeload: boolean;
  cutMode: boolean;
  warmupText: string;
  groups: DayGroup[];
}

export interface AssembleInput {
  day: ProgramDay;
  week: number;
  weekCount: number;
  isDeload: boolean;
  cutMode: boolean;
  /** slot_id -> substituted exercise_id (from swaps this mesocycle). */
  swaps: Record<string, string>;
  /** slot_id -> last session's working sets. */
  lastSetsBySlot: Record<string, LastSet[]>;
}

export function assembleDay(input: AssembleInput): DayView {
  const { day, week, weekCount, isDeload, cutMode, swaps, lastSetsBySlot } = input;

  // Identify the last WORKING (non-cardio) slot for cut-mode trimming.
  const workingIdx = day.slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      const ex = getExercise(swaps[s.slot_id] ?? s.exercise_id);
      return ex && ex.primary_muscle !== "cardio";
    });
  const lastWorkingSlotId = workingIdx.length ? workingIdx[workingIdx.length - 1].s.slot_id : null;

  // First working slot gets warm-up ramp sets.
  const firstWorkingSlotId = workingIdx.length ? workingIdx[0].s.slot_id : null;

  const slotViews: SlotView[] = day.slots.map((slot) => {
    const exerciseId = swaps[slot.slot_id] ?? slot.exercise_id;
    const exercise = getExercise(exerciseId)!;
    const isCardio = exercise.primary_muscle === "cardio";
    const lastSets = lastSetsBySlot[slot.slot_id] ?? [];

    let sets = slot.sets;
    let rir = slot.rir_target;
    if (!isCardio) {
      // Weekly volume ramp + deload are both folded into weeklySlotSets.
      sets = weeklySlotSets(slot.sets, week, weekCount, Boolean(slot.ramp));
      if (isDeload) {
        rir = DELOAD_RIR;
      } else if (cutMode && slot.slot_id === lastWorkingSlotId) {
        sets = Math.max(1, sets - 1); // trim one set from the last exercise of the day
      }
    }

    const target = computeNextTarget({
      lastSets,
      repsLow: slot.reps_low,
      repsHigh: slot.reps_high,
      increment: exercise.weight_increment,
    });

    const hint = getProgressionHint({
      lastSets,
      repsLow: slot.reps_low,
      repsHigh: slot.reps_high,
      increment: exercise.weight_increment,
      isDeload,
      hasHistory: lastSets.length > 0,
    });

    const ramp =
      !isCardio && slot.slot_id === firstWorkingSlotId ? rampSets(target.targetWeight) : [];

    return {
      slot_id: slot.slot_id,
      group: slot.group,
      exercise,
      sets,
      reps_low: slot.reps_low,
      reps_high: slot.reps_high,
      reps_label: slot.reps_label,
      rir_target: rir,
      is_cardio: isCardio,
      is_substituted: Boolean(swaps[slot.slot_id]) && swaps[slot.slot_id] !== slot.exercise_id,
      lastSets,
      target,
      hint,
      ramp,
    };
  });

  // Group slots by their group label, preserving order.
  const groups: DayGroup[] = [];
  for (const sv of slotViews) {
    let g = groups.find((x) => x.group === sv.group);
    if (!g) {
      g = { group: sv.group, slots: [] };
      groups.push(g);
    }
    g.slots.push(sv);
  }

  return {
    day_order: day.day_order,
    name: day.name,
    week,
    isDeload,
    cutMode,
    warmupText: WARMUP_CARD_TEXT,
    groups,
  };
}
