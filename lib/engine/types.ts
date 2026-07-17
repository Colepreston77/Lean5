// Core domain types for the LEAN 5 progression engine.
// These are pure data shapes — no DB, no React. The engine functions operate
// on these so they can be unit-tested in isolation.

/**
 * Muscles that count toward weekly volume math.
 * `cardio` is intentionally NOT here — conditioning work is excluded from
 * volume/progression/audit math (per spec). `arms` from the seed superset is
 * split into `biceps` + `triceps`.
 */
export const MUSCLES = [
  "chest",
  "front_delts",
  "side_delts",
  "rear_delts",
  "lats",
  "mid_back",
  "spinal_erectors",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type MovementPattern =
  | "horizontal_press"
  | "vertical_press"
  | "vertical_pull"
  | "horizontal_pull"
  | "lateral_raise"
  | "rear_delt_fly"
  | "elbow_flexion"
  | "elbow_extension"
  | "squat"
  | "hinge"
  | "lunge"
  | "knee_flexion"
  | "knee_extension"
  | "calf_raise"
  | "spinal_flexion"
  | "hip_flexion"
  | "superset"
  | "cardio";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "smith"
  | "bodyweight"
  | "bodyweight_loaded"
  | "none";

/** An exercise definition from the library. Static reference data. */
export interface Exercise {
  id: string;
  name: string;
  primary_muscle: Muscle | "cardio";
  secondary_muscles: Muscle[];
  movement_pattern: MovementPattern;
  equipment: Equipment;
  /** RIR target as a display string, e.g. "1-2" or "0-1". */
  rir_target: string;
  cue_text: string;
  rest_seconds: number;
  /** Load added when double progression triggers, in lb. */
  weight_increment: number;
  /** Exercise ids/names this slot may rotate to at mesocycle boundaries. */
  rotation_pool: string[];
}

/**
 * A slot in a program day: one exercise position with its prescribed scheme.
 * The exercise occupying a slot can change (swap / rotation / travel mode) but
 * the slot identity + muscle target persists so progression history stays clean.
 */
export interface ExerciseSlot {
  slot_id: string;
  exercise_id: string;
  group: string; // "A" | "B" | "C" | "Conditioning" ...
  sets: number;
  reps_low: number;
  reps_high: number;
  /** Free-form reps for non-numeric prescriptions like "12-15 min" or "8-12 each". */
  reps_label?: string;
  rir_target: string;
  is_warmup?: boolean;
  /** If true, this slot gains sets across weeks 1→3 (volume ramp), then deloads. */
  ramp?: boolean;
}

export interface ProgramDay {
  day_order: number;
  name: string;
  slots: ExerciseSlot[];
}

export interface Program {
  name: string;
  days_per_week: number;
  days: ProgramDay[];
}

export type MesocycleStatus = "active" | "completed";

export interface Mesocycle {
  id: string;
  program_name: string;
  start_date: string; // ISO date
  week_count: number; // total weeks incl. deload (typically 4)
  current_week: number; // 1-indexed
  status: MesocycleStatus;
}

export type SessionStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface Session {
  id: string;
  program_day_order: number;
  mesocycle_id: string;
  week: number;
  date: string | null;
  status: SessionStatus;
  duration_seconds?: number | null;
  notes?: string | null;
}

/** One logged (or targeted) set. Targets are set by the engine; actuals by the user. */
export interface SetLog {
  id: string;
  session_id: string;
  slot_id: string;
  exercise_id: string;
  set_number: number;
  target_reps_low: number;
  target_reps_high: number;
  target_weight: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  completed_at: string | null;
  is_warmup?: boolean;
}

export interface Swap {
  id: string;
  mesocycle_id: string;
  slot_id: string;
  from_exercise_id: string;
  to_exercise_id: string;
  created_at: string;
}
