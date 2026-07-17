// The program-generation CONTRACT + validation layer.
//
// Both AI doors — the in-app OpenAI call and a block hand-authored by Claude —
// produce a GeneratedProgram (plain JSON). Nothing reaches training until it
// passes validateGeneratedProgram(): structural schema checks THEN the same
// weekly audit gate the deterministic engine uses. This is the safety net the
// spec requires — never run an unvalidated program.

import type { Program, ProgramDay, ExerciseSlot } from "@/lib/engine/types";
import { EXERCISES, slug } from "@/lib/seed/exercises";
import { auditWeek, type WeekPlan, type AuditDay, type AuditSlot, type AuditCheck } from "@/lib/engine/audit";
import { weeklySlotSets, DELOAD_RIR, isDeloadWeek } from "@/lib/engine/deload";

export interface GenSlot {
  exercise_id: string;
  group: string;
  sets: number;
  reps_low: number;
  reps_high: number;
  reps_label?: string;
  rir_target: string;
  ramp?: boolean;
  change_note?: string; // what changed vs last block (for the approve screen)
}

export interface GenDay {
  name: string;
  slots: GenSlot[];
}

export interface GeneratedProgram {
  name: string;
  days_per_week: number;
  week_count?: number;
  rationale?: string;
  days: GenDay[];
}

export interface ValidationResult {
  ok: boolean;
  /** Normalized internal program (stable slot ids), present when structurally valid. */
  program?: Program;
  /** Hard structural/schema errors — always block. */
  schemaErrors: string[];
  /** Audit ERROR checks across all weeks — block. */
  auditErrors: AuditCheck[];
  /** Audit WARN checks across all weeks — surfaced, don't block. */
  auditWarnings: AuditCheck[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Resolve an exercise reference (id or name) to a library id, or null. */
export function resolveExerciseId(ref: string): string | null {
  if (EXERCISES[ref]) return ref;
  const s = slug(ref);
  return EXERCISES[s] ? s : null;
}

/** Structural validation → normalized Program with stable slot ids. */
function toProgram(input: unknown, schemaErrors: string[]): Program | undefined {
  if (!isObj(input)) {
    schemaErrors.push("Program is not an object.");
    return undefined;
  }
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;
  if (!name) schemaErrors.push("Missing program name.");

  const days = Array.isArray(input.days) ? input.days : null;
  if (!days || days.length === 0) {
    schemaErrors.push("Program has no days.");
    return undefined;
  }
  const daysPerWeek = typeof input.days_per_week === "number" ? input.days_per_week : days.length;
  if (daysPerWeek !== days.length) {
    schemaErrors.push(`days_per_week (${daysPerWeek}) does not match number of days (${days.length}).`);
  }

  const outDays: ProgramDay[] = [];
  days.forEach((rawDay, di) => {
    if (!isObj(rawDay)) {
      schemaErrors.push(`Day ${di + 1} is not an object.`);
      return;
    }
    const dayName = typeof rawDay.name === "string" ? rawDay.name : `Day ${di + 1}`;
    const rawSlots = Array.isArray(rawDay.slots) ? rawDay.slots : [];
    if (rawSlots.length === 0) schemaErrors.push(`${dayName}: no slots.`);

    const slots: ExerciseSlot[] = [];
    rawSlots.forEach((rawSlot, si) => {
      if (!isObj(rawSlot)) {
        schemaErrors.push(`${dayName} slot ${si + 1}: not an object.`);
        return;
      }
      const ref = typeof rawSlot.exercise_id === "string" ? rawSlot.exercise_id : "";
      const exId = ref ? resolveExerciseId(ref) : null;
      if (!exId) {
        schemaErrors.push(`${dayName} slot ${si + 1}: unknown exercise "${ref}" (must be in the library).`);
      }
      const ex = exId ? EXERCISES[exId] : undefined;
      const isCardio = ex?.primary_muscle === "cardio";

      const sets = Number(rawSlot.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 8) {
        schemaErrors.push(`${dayName} slot ${si + 1}: sets must be an integer 1–8.`);
      }
      const lo = Number(rawSlot.reps_low);
      const hi = Number(rawSlot.reps_high);
      if (!isCardio && (!(lo > 0) || !(hi > 0) || lo > hi)) {
        schemaErrors.push(`${dayName} slot ${si + 1}: invalid rep range ${lo}–${hi}.`);
      }
      const rir = typeof rawSlot.rir_target === "string" ? rawSlot.rir_target : "";
      if (!rir && !isCardio) schemaErrors.push(`${dayName} slot ${si + 1}: missing RIR target.`);

      slots.push({
        slot_id: `d${di + 1}_${si + 1}`,
        exercise_id: exId ?? ref,
        group: typeof rawSlot.group === "string" ? rawSlot.group : "A",
        sets: Number.isFinite(sets) ? sets : 0,
        reps_low: Number.isFinite(lo) ? lo : 0,
        reps_high: Number.isFinite(hi) ? hi : 0,
        reps_label: typeof rawSlot.reps_label === "string" ? rawSlot.reps_label : undefined,
        rir_target: rir,
        ramp: rawSlot.ramp === true,
      });
    });
    outDays.push({ day_order: di + 1, name: dayName, slots });
  });

  if (!name) return undefined;
  return { name, days_per_week: daysPerWeek, days: outDays };
}

/** Build the audit WeekPlan for a given week of a normalized program. */
function weekPlan(program: Program, week: number, weekCount: number): WeekPlan {
  const isDeload = isDeloadWeek(week, weekCount);
  const days: AuditDay[] = program.days.map((day) => {
    const slots: AuditSlot[] = day.slots.map((slot) => {
      const ex = EXERCISES[slot.exercise_id];
      const isCardio = ex?.primary_muscle === "cardio";
      return {
        slot_id: slot.slot_id,
        exercise: ex,
        slot_primary_muscle: ex?.primary_muscle ?? "chest",
        sets: isCardio ? slot.sets : weeklySlotSets(slot.sets, week, weekCount, Boolean(slot.ramp)),
        reps_low: slot.reps_low,
        reps_high: slot.reps_high,
        rir_target: isDeload && !isCardio ? DELOAD_RIR : slot.rir_target,
        rest_seconds: ex?.rest_seconds ?? 90,
        increment: ex?.weight_increment ?? 5,
        target_weight: null,
        cold_start: true,
      };
    });
    return { day_order: day.day_order, name: day.name, is_lower_body: /lower/i.test(day.name), slots };
  });
  return { week, is_deload: isDeload, days };
}

/**
 * Validate a generated/imported program. Returns the normalized program plus any
 * schema errors and aggregated audit findings across all weeks of the block.
 */
export function validateGeneratedProgram(input: unknown, weekCount = 4): ValidationResult {
  const schemaErrors: string[] = [];
  const program = toProgram(input, schemaErrors);

  if (!program || schemaErrors.length) {
    return { ok: false, program, schemaErrors, auditErrors: [], auditWarnings: [] };
  }

  // Run the audit gate for every week. For GENERATED programs we hold a stricter
  // bar than the runtime engine: warnings (e.g. volume out of band, long sessions)
  // BLOCK, because no human is composing the plan. The deload week is exempt from
  // volume warnings — it's supposed to be low.
  const auditErrors: AuditCheck[] = [];
  const auditWarnings: AuditCheck[] = [];
  for (let w = 1; w <= weekCount; w++) {
    const deload = isDeloadWeek(w, weekCount);
    const result = auditWeek(weekPlan(program, w, weekCount));
    for (const e of result.errors) auditErrors.push({ ...e, detail: `Wk${w}: ${e.detail}` });
    if (!deload) {
      for (const warn of result.warnings) auditWarnings.push({ ...warn, detail: `Wk${w}: ${warn.detail}` });
    }
  }

  return {
    // Strict: a generated block must be clean — no schema errors, no audit errors,
    // and no training-week warnings.
    ok: schemaErrors.length === 0 && auditErrors.length === 0 && auditWarnings.length === 0,
    program,
    schemaErrors,
    auditErrors,
    auditWarnings,
  };
}
