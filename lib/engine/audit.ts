// Weekly plan audit — THE single gate every plan source (engine, swaps, travel
// mode, future AI programs) must pass before a week publishes to Today/Calendar.
//
// ERROR checks are hard blocks (week does not publish). WARN checks surface on
// the plan-review screen but do not block. Volume lives in WARN because exact
// optimums are debated; structural correctness lives in ERROR.

import type { Exercise, Muscle } from "./types";
import { deloadSets } from "./deload";
import { weeklyVolume, volumeIssues, type VolumeSlot } from "./volume";

// Upper days on this program run high on quick isolation work; 22 is the point
// where a single session is genuinely too long, not just "dense".
export const MAX_WORKING_SETS_PER_SESSION = 22;
export const MAX_SESSION_MINUTES = 70;
export const MAX_WEIGHT_JUMP_PCT = 0.1;

export interface AuditSlot {
  slot_id: string;
  /** The exercise currently occupying the slot (post swap / travel / rotation). */
  exercise: Exercise;
  /** The slot's intended primary muscle (what it's SUPPOSED to train). */
  slot_primary_muscle: Muscle | "cardio";
  sets: number;
  reps_low: number;
  reps_high: number;
  rir_target: string;
  rest_seconds: number;
  increment: number;
  target_weight: number | null;
  /** Same slot's target weight from the previous session, if any. */
  prev_target_weight?: number | null;
  /** Most recent deload weight for this slot, if any. */
  last_deload_weight?: number | null;
  is_warmup?: boolean;
  is_substituted?: boolean;
  /** For deload weeks: whether a non-deload progression hint would fire. */
  progression_hint_firing?: boolean;
  /** True on cold start / no history — target_weight is legitimately null. */
  cold_start?: boolean;
}

export interface AuditDay {
  day_order: number;
  name: string;
  is_lower_body: boolean;
  slots: AuditSlot[];
}

export interface WeekPlan {
  week: number;
  is_deload: boolean;
  days: AuditDay[];
}

export type Severity = "error" | "warn";

export interface AuditCheck {
  id: string;
  category: string;
  severity: Severity;
  passed: boolean;
  detail: string;
  /** Machine-readable hint for the one-tap fix on the plan-review screen. */
  fix?: { kind: string; slot_id?: string; day_order?: number; value?: number };
}

export interface AuditResult {
  passed: boolean; // true when there are no ERROR-level failures
  checks: AuditCheck[];
  errors: AuditCheck[];
  warnings: AuditCheck[];
}

function workingSlots(plan: WeekPlan): AuditSlot[] {
  return plan.days.flatMap((d) => d.slots).filter((s) => !s.is_warmup && s.exercise.primary_muscle !== "cardio");
}

// --- individual checks -------------------------------------------------------

function checkRequiredFields(plan: WeekPlan): AuditCheck[] {
  const out: AuditCheck[] = [];
  for (const slot of workingSlots(plan)) {
    const missing: string[] = [];
    if (!(slot.reps_low > 0 && slot.reps_high > 0)) missing.push("rep range");
    if (!slot.rir_target) missing.push("RIR");
    if (!(slot.rest_seconds >= 0)) missing.push("rest");
    if (slot.increment == null) missing.push("increment");
    // target weight may be null ONLY on cold start
    if (slot.target_weight == null && !slot.cold_start) missing.push("target weight");
    if (missing.length) {
      out.push({
        id: `fields:${slot.slot_id}`,
        category: "Required fields",
        severity: "error",
        passed: false,
        detail: `${slot.exercise.name}: missing ${missing.join(", ")}`,
        fix: { kind: "fill_fields", slot_id: slot.slot_id },
      });
    }
  }
  if (!out.length) {
    out.push({ id: "fields:ok", category: "Required fields", severity: "error", passed: true, detail: "All slots fully specified" });
  }
  return out;
}

function checkWeightJumps(plan: WeekPlan): AuditCheck[] {
  const out: AuditCheck[] = [];
  for (const slot of workingSlots(plan)) {
    if (slot.target_weight != null && slot.prev_target_weight != null && slot.prev_target_weight > 0) {
      const jump = (slot.target_weight - slot.prev_target_weight) / slot.prev_target_weight;
      if (jump > MAX_WEIGHT_JUMP_PCT + 1e-9) {
        out.push({
          id: `jump:${slot.slot_id}`,
          category: "Weight jump",
          severity: "error",
          passed: false,
          detail: `${slot.exercise.name}: +${Math.round(jump * 100)}% (${slot.prev_target_weight}→${slot.target_weight}) exceeds 10%`,
          fix: { kind: "cap_weight", slot_id: slot.slot_id, value: Math.round(slot.prev_target_weight * (1 + MAX_WEIGHT_JUMP_PCT)) },
        });
      }
    }
  }
  if (!out.length) {
    out.push({ id: "jump:ok", category: "Weight jump", severity: "error", passed: true, detail: "No session-over-session jump >10%" });
  }
  return out;
}

function checkBelowDeload(plan: WeekPlan): AuditCheck[] {
  const out: AuditCheck[] = [];
  for (const slot of workingSlots(plan)) {
    if (slot.target_weight != null && slot.last_deload_weight != null && slot.target_weight < slot.last_deload_weight - 1e-9) {
      out.push({
        id: `deloadfloor:${slot.slot_id}`,
        category: "Below deload floor",
        severity: "error",
        passed: false,
        detail: `${slot.exercise.name}: target ${slot.target_weight} is below last deload weight ${slot.last_deload_weight}`,
        fix: { kind: "raise_to_deload", slot_id: slot.slot_id, value: slot.last_deload_weight },
      });
    }
  }
  if (!out.length) {
    out.push({ id: "deloadfloor:ok", category: "Below deload floor", severity: "error", passed: true, detail: "No target below its deload weight" });
  }
  return out;
}

function checkDeloadApplied(plan: WeekPlan, fullSetsBySlot?: Record<string, number>): AuditCheck[] {
  if (!plan.is_deload) return [];
  const out: AuditCheck[] = [];
  for (const slot of workingSlots(plan)) {
    if (slot.progression_hint_firing) {
      out.push({
        id: `deloadhint:${slot.slot_id}`,
        category: "Deload integrity",
        severity: "error",
        passed: false,
        detail: `${slot.exercise.name}: progression hint firing during deload`,
        fix: { kind: "suppress_hint", slot_id: slot.slot_id },
      });
    }
    const full = fullSetsBySlot?.[slot.slot_id];
    if (full != null && slot.sets > deloadSets(full)) {
      out.push({
        id: `deloadsets:${slot.slot_id}`,
        category: "Deload integrity",
        severity: "error",
        passed: false,
        detail: `${slot.exercise.name}: ${slot.sets} sets not halved (expected ${deloadSets(full)})`,
        fix: { kind: "halve_sets", slot_id: slot.slot_id, value: deloadSets(full) },
      });
    }
  }
  if (!out.length) {
    out.push({ id: "deload:ok", category: "Deload integrity", severity: "error", passed: true, detail: "Deload week is properly deloaded" });
  }
  return out;
}

function checkLowerBackToBack(plan: WeekPlan): AuditCheck[] {
  const days = [...plan.days].sort((a, b) => a.day_order - b.day_order);
  for (let i = 1; i < days.length; i++) {
    if (days[i].is_lower_body && days[i - 1].is_lower_body) {
      return [
        {
          id: "lowerb2b",
          category: "Lower-body spacing",
          severity: "error",
          passed: false,
          detail: `${days[i - 1].name} and ${days[i].name} are scheduled back-to-back`,
          fix: { kind: "reorder_days", day_order: days[i].day_order },
        },
      ];
    }
  }
  return [{ id: "lowerb2b:ok", category: "Lower-body spacing", severity: "error", passed: true, detail: "Lower-body days are not back-to-back" }];
}

function checkSubstitutionMuscle(plan: WeekPlan): AuditCheck[] {
  const out: AuditCheck[] = [];
  for (const day of plan.days) {
    for (const slot of day.slots) {
      if (slot.is_warmup) continue;
      if (slot.is_substituted && slot.exercise.primary_muscle !== slot.slot_primary_muscle) {
        out.push({
          id: `sub:${slot.slot_id}`,
          category: "Substitution match",
          severity: "error",
          passed: false,
          detail: `${slot.exercise.name} (${slot.exercise.primary_muscle}) does not match slot muscle ${slot.slot_primary_muscle}`,
          fix: { kind: "revert_slot", slot_id: slot.slot_id },
        });
      }
    }
  }
  if (!out.length) {
    out.push({ id: "sub:ok", category: "Substitution match", severity: "error", passed: true, detail: "All substitutions match their slot muscle" });
  }
  return out;
}

function checkSessionSize(plan: WeekPlan): AuditCheck[] {
  const out: AuditCheck[] = [];
  for (const day of plan.days) {
    const working = day.slots.filter((s) => !s.is_warmup && s.exercise.primary_muscle !== "cardio");
    const totalSets = working.reduce((n, s) => n + s.sets, 0);
    // crude session length: sum(sets * (rest + ~40s work)) across working sets
    const seconds = working.reduce((t, s) => t + s.sets * (s.rest_seconds + 40), 0);
    const minutes = Math.round(seconds / 60);
    if (totalSets > MAX_WORKING_SETS_PER_SESSION) {
      out.push({
        id: `size:sets:${day.day_order}`,
        category: "Session size",
        severity: "warn",
        passed: false,
        detail: `${day.name}: ${totalSets} working sets (>${MAX_WORKING_SETS_PER_SESSION})`,
        fix: { kind: "trim_set", day_order: day.day_order },
      });
    }
    if (minutes > MAX_SESSION_MINUTES) {
      out.push({
        id: `size:mins:${day.day_order}`,
        category: "Session size",
        severity: "warn",
        passed: false,
        detail: `${day.name}: ~${minutes} min (>${MAX_SESSION_MINUTES})`,
        fix: { kind: "trim_set", day_order: day.day_order },
      });
    }
  }
  if (!out.length) {
    out.push({ id: "size:ok", category: "Session size", severity: "warn", passed: true, detail: "All sessions within ~18 sets / 60 min" });
  }
  return out;
}

function checkVolume(plan: WeekPlan): AuditCheck[] {
  const slots: VolumeSlot[] = workingSlots(plan).map((s) => ({ sets: s.sets, exercise: s.exercise }));
  const vol = weeklyVolume(slots);
  const issues = volumeIssues(vol);
  if (!issues.length) {
    return [{ id: "vol:ok", category: "Weekly volume", severity: "warn", passed: true, detail: "All trained muscles within 10-20 fractional sets" }];
  }
  return issues.map((iss) => ({
    id: `vol:${iss.muscle}:${iss.kind}`,
    category: "Weekly volume",
    severity: "warn" as const,
    passed: false,
    detail:
      iss.kind === "below_min"
        ? `${iss.muscle}: ${iss.sets} sets (starved — below 6)`
        : iss.kind === "above_max"
        ? `${iss.muscle}: ${iss.sets} sets (flooded — above 22)`
        : `${iss.muscle}: ${iss.sets} sets (below its bias target of 8)`,
  }));
}

// --- runner ------------------------------------------------------------------

export function auditWeek(plan: WeekPlan, fullSetsBySlot?: Record<string, number>): AuditResult {
  const checks: AuditCheck[] = [
    ...checkRequiredFields(plan),
    ...checkWeightJumps(plan),
    ...checkBelowDeload(plan),
    ...checkDeloadApplied(plan, fullSetsBySlot),
    ...checkLowerBackToBack(plan),
    ...checkSubstitutionMuscle(plan),
    ...checkSessionSize(plan),
    ...checkVolume(plan),
  ];
  const errors = checks.filter((c) => c.severity === "error" && !c.passed);
  const warnings = checks.filter((c) => c.severity === "warn" && !c.passed);
  return { passed: errors.length === 0, checks, errors, warnings };
}
