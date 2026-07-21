// Single-day adaptation: keep a day's structure (sets, reps, groups) exactly, but
// rotate individual exercises to constraint-friendly variants — e.g. "recovering
// from an ankle sprain, keep it close but easy on the ankle". Applied as SWAPS,
// so it's reversible and persists for the rest of the block.
//
// The hard rule that keeps training math intact: a swap must stay on the SAME
// primary muscle as the slot it replaces. That guarantees weekly primary-muscle
// volume and the slot's progression history are unchanged — only the movement
// (and thus the joint stress) changes. Unlike the manual swap, we DO allow a
// different movement_pattern within that muscle, because that's exactly what an
// injury workaround needs (e.g. barbell squat → leg press for a bad ankle).

import type { ProgramDay } from "@/lib/engine/types";
import { EXERCISES, ALL_EXERCISES, getExercise } from "@/lib/seed/exercises";
import { resolveExerciseId } from "@/lib/ai/contract";

export const ADAPT_SYSTEM_PROMPT = `
You are the exercise-adaptation assistant for LEAN 5, one person's personal hypertrophy app. The athlete loves their current program and is NOT redesigning it. They have a temporary constraint (usually an injury or equipment limit) and want the SAME day, adjusted to work around it.

YOUR JOB — swap individual exercises ONLY:
- Keep everything you can. Change the FEWEST exercises needed to respect the constraint. If a slot's exercise does not stress the affected area, LEAVE IT ALONE (do not include it in your output).
- For a slot you must change, replace it with a library exercise that trains the SAME primary muscle (this is mandatory — it keeps the athlete's weekly volume and progress intact) but avoids the constrained joint/pattern. Prefer seated/supported, machine or cable, joint-friendly, stretch-biased options.
- NEVER change sets, reps, rep ranges, groups, or the day's structure. You only choose exercises.
- Use exercise_id values from the provided library ONLY. The replacement's primary muscle MUST match the original slot's primary muscle.

OUTPUT — return ONLY this JSON object (no prose, no markdown fences):
{
  "rationale": string,            // 1-3 sentences: what you changed and why (tie it to the constraint)
  "changes": [                    // ONLY slots you are changing; omit slots you keep. [] is valid if nothing needs changing.
    { "slot_id": string, "to_exercise_id": string, "reason": string }  // reason: one short phrase, e.g. "no ankle loading"
  ]
}
`.trim();

export interface AdaptSlotInput {
  slot_id: string;
  exercise_id: string;
  sets: number;
  reps_low: number;
  reps_high: number;
  reps_label?: string;
  group: string;
}

/** The current (post-swap) exercise sitting in each slot of a program day. */
export function currentDaySlots(day: ProgramDay, swaps: Record<string, string>): AdaptSlotInput[] {
  return day.slots.map((s) => ({
    slot_id: s.slot_id,
    exercise_id: swaps[s.slot_id] ?? s.exercise_id,
    sets: s.sets,
    reps_low: s.reps_low,
    reps_high: s.reps_high,
    reps_label: s.reps_label,
    group: s.group,
  }));
}

/** Library grouped by muscle, annotated with pattern + equipment so the model can
 *  pick joint-friendly variants. Cardio is excluded (not a hypertrophy swap). */
function libraryText(): string {
  const byMuscle = new Map<string, string[]>();
  for (const ex of ALL_EXERCISES) {
    if (ex.primary_muscle === "cardio") continue;
    const key = String(ex.primary_muscle);
    if (!byMuscle.has(key)) byMuscle.set(key, []);
    byMuscle.get(key)!.push(`${ex.id} [${ex.equipment}, ${ex.movement_pattern}]`);
  }
  const lines = ["EXERCISE LIBRARY (use ONLY these exercise_id values; stay on the slot's primary muscle):"];
  for (const [muscle, entries] of [...byMuscle.entries()].sort()) {
    lines.push(`- ${muscle}: ${entries.join(", ")}`);
  }
  return lines.join("\n");
}

export function buildDayAdaptPrompt(input: {
  dayName: string;
  slots: AdaptSlotInput[];
  constraint: string;
}): string {
  const { dayName, slots, constraint } = input;
  const slotLines = slots
    .map((s) => {
      const ex = getExercise(s.exercise_id);
      const muscle = ex?.primary_muscle ?? "?";
      const pattern = ex?.movement_pattern ?? "?";
      const scheme = s.reps_label ?? `${s.reps_low}-${s.reps_high}`;
      return `- slot ${s.slot_id}: ${ex?.name ?? s.exercise_id} (id ${s.exercise_id}) — primary muscle ${muscle}, pattern ${pattern}, ${s.sets}×${scheme}, group ${s.group}`;
    })
    .join("\n");

  return [
    `TASK: Adapt the single training day below to respect the athlete's constraint, following your system instructions. Change as few exercises as possible; keep the same primary muscle for any slot you change; never alter sets/reps/structure.`,
    "",
    `ATHLETE CONSTRAINT: ${constraint}`,
    "",
    `DAY: ${dayName}`,
    slotLines,
    "",
    libraryText(),
    "",
    `Return ONLY the JSON object defined in your instructions.`,
  ].join("\n");
}

export interface DayAdaptChange {
  slot_id: string;
  from_exercise_id: string;
  to_exercise_id: string;
  from_name: string;
  to_name: string;
  reason: string;
  pattern_changed: boolean;
  equipment_changed: boolean;
}

export interface DayAdaptResult {
  ok: boolean;
  rationale: string;
  changes: DayAdaptChange[];
  errors: string[];
  warnings: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Validate a model's day adaptation against the current slots. Blocks anything
 * that would break training math: unknown slot, unknown exercise, or a primary-
 * muscle change. Pattern/equipment changes are allowed but surfaced as notes.
 */
export function validateDayAdaptation(input: unknown, slots: AdaptSlotInput[]): DayAdaptResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const changes: DayAdaptChange[] = [];
  const bySlot = new Map(slots.map((s) => [s.slot_id, s]));
  const seen = new Set<string>();

  const rationale = isObj(input) && typeof input.rationale === "string" ? input.rationale : "";
  const rawChanges = isObj(input) && Array.isArray(input.changes) ? input.changes : [];

  for (const raw of rawChanges) {
    if (!isObj(raw)) {
      errors.push("A change entry was not an object.");
      continue;
    }
    const slotId = typeof raw.slot_id === "string" ? raw.slot_id : "";
    const slot = bySlot.get(slotId);
    if (!slot) {
      errors.push(`Unknown slot "${slotId}".`);
      continue;
    }
    if (seen.has(slotId)) {
      errors.push(`Slot ${slotId} changed more than once.`);
      continue;
    }
    const ref = typeof raw.to_exercise_id === "string" ? raw.to_exercise_id : "";
    const toId = ref ? resolveExerciseId(ref) : null;
    if (!toId) {
      errors.push(`${slot.slot_id}: unknown exercise "${ref}".`);
      continue;
    }
    const from = getExercise(slot.exercise_id);
    const to = EXERCISES[toId];
    if (toId === slot.exercise_id) {
      // No-op change — silently skip (model kept the exercise).
      continue;
    }
    if (from && to.primary_muscle !== from.primary_muscle) {
      errors.push(
        `${slot.slot_id}: "${to.name}" trains ${to.primary_muscle}, but the slot targets ${from.primary_muscle} — a swap must keep the same primary muscle.`
      );
      continue;
    }
    seen.add(slotId);
    const patternChanged = !!from && from.movement_pattern !== to.movement_pattern;
    const equipmentChanged = !!from && from.equipment !== to.equipment;
    changes.push({
      slot_id: slot.slot_id,
      from_exercise_id: slot.exercise_id,
      to_exercise_id: toId,
      from_name: from?.name ?? slot.exercise_id,
      to_name: to.name,
      reason: typeof raw.reason === "string" ? raw.reason : "",
      pattern_changed: patternChanged,
      equipment_changed: equipmentChanged,
    });
  }

  return { ok: errors.length === 0, rationale, changes, errors, warnings };
}
