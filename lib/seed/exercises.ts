import type { Exercise, Muscle, MovementPattern, Equipment } from "@/lib/engine/types";

// -----------------------------------------------------------------------------
// Exercise library. Every exercise that can occupy a slot — whether it ships in
// the default program or lives only in a rotation/swap pool — is defined here.
// The swap + travel systems match on primary_muscle + movement_pattern + equipment,
// and the volume audit credits secondary_muscles at 0.5 sets, so those tags matter.
// -----------------------------------------------------------------------------

type ExDef = {
  name: string;
  primary: Muscle | "cardio";
  secondary?: Muscle[];
  pattern: MovementPattern;
  equipment: Equipment;
  rir?: string;
  cue?: string;
  rest?: number;
  increment?: number;
  rotation?: string[]; // referenced by id (slug)
};

/** slugify a name into a stable id: "Incline DB Press" -> "incline_db_press" */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()°+]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Default rest by "size" of movement; overridable per exercise.
const COMPOUND_REST = 150;
const ISO_REST = 75;

const DEFS: ExDef[] = [
  // ---- Chest / horizontal press ----
  { name: "Incline DB Press", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "dumbbell", rir: "1-2", cue: "Deep stretch at the bottom, leave 1-2 in the tank", rest: 150, increment: 5, rotation: ["low_incline_smith_press", "incline_machine_press"] },
  { name: "Flat DB Press", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "dumbbell", rir: "1-2", cue: "Deeper stretch than a barbell allows — use it", rest: 150, increment: 5, rotation: ["machine_chest_press", "weighted_dip"] },
  { name: "Low-Incline Machine Press", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "machine", rir: "1", cue: "Upper chest focus, smooth tempo", rest: 120, increment: 5, rotation: ["incline_db_press", "cable_fly_low_to_high"] },
  { name: "Low-Incline Smith Press", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "smith", rir: "1-2", cue: "Upper chest, control the bar path", rest: 150, increment: 5 },
  { name: "Incline Machine Press", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "machine", rir: "1-2", cue: "Upper chest focus, full stretch", rest: 150, increment: 5 },
  { name: "Machine Chest Press", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "machine", rir: "1-2", cue: "Controlled stretch, drive through the mid-chest", rest: 150, increment: 5 },
  { name: "Weighted Dip", primary: "chest", secondary: ["front_delts", "triceps"], pattern: "horizontal_press", equipment: "bodyweight_loaded", rir: "1-2", cue: "Lean forward for chest, deep stretch", rest: 150, increment: 5 },
  { name: "Cable Fly (low-to-high)", primary: "chest", secondary: ["front_delts"], pattern: "horizontal_press", equipment: "cable", rir: "0-1", cue: "Squeeze up and in, stretch wide", rest: 75, increment: 2.5 },

  // ---- Back: vertical pull ----
  { name: "Weighted Pull-Up", primary: "lats", secondary: ["biceps", "mid_back", "rear_delts"], pattern: "vertical_pull", equipment: "bodyweight_loaded", rir: "1-2", cue: "Full hang at the bottom every rep", rest: 150, increment: 5, rotation: ["lat_pulldown", "neutral_grip_pulldown"] },
  { name: "Lat Pulldown (Wide)", primary: "lats", secondary: ["biceps", "mid_back"], pattern: "vertical_pull", equipment: "cable", rir: "1-2", cue: "Full stretch at the top, different grip than Day 1", rest: 120, increment: 5, rotation: ["close_grip_pulldown", "pull_up"] },
  { name: "Lat Pulldown", primary: "lats", secondary: ["biceps", "mid_back"], pattern: "vertical_pull", equipment: "cable", rir: "1-2", cue: "Drive elbows down, full stretch up top", rest: 120, increment: 5 },
  { name: "Neutral-Grip Pulldown", primary: "lats", secondary: ["biceps", "mid_back"], pattern: "vertical_pull", equipment: "cable", rir: "1-2", cue: "Neutral grip, elbows to hips", rest: 120, increment: 5 },
  { name: "Close-Grip Pulldown", primary: "lats", secondary: ["biceps", "mid_back"], pattern: "vertical_pull", equipment: "cable", rir: "1-2", cue: "Close grip, big stretch overhead", rest: 120, increment: 5 },
  { name: "Pull-Up", primary: "lats", secondary: ["biceps", "mid_back", "rear_delts"], pattern: "vertical_pull", equipment: "bodyweight", rir: "1-2", cue: "Dead hang to chin over bar", rest: 120, increment: 0 },

  // ---- Back: horizontal pull ----
  { name: "Seated Cable Row (Neutral)", primary: "mid_back", secondary: ["lats", "biceps", "rear_delts"], pattern: "horizontal_pull", equipment: "cable", rir: "1-2", cue: "Let the weight pull you into a stretch, then drive elbows back", rest: 120, increment: 5, rotation: ["chest_supported_row", "single_arm_cable_row"] },
  { name: "Chest-Supported Row", primary: "mid_back", secondary: ["lats", "biceps", "rear_delts"], pattern: "horizontal_pull", equipment: "machine", rir: "1-2", cue: "Chest stays pinned, no body english", rest: 150, increment: 5, rotation: ["t_bar_row", "seal_row"] },
  { name: "Single-Arm Cable Row", primary: "mid_back", secondary: ["lats", "biceps", "rear_delts"], pattern: "horizontal_pull", equipment: "cable", rir: "1-2", cue: "Big reach forward, drive the elbow past the ribs", rest: 90, increment: 5 },
  { name: "T-Bar Row", primary: "mid_back", secondary: ["lats", "biceps", "rear_delts"], pattern: "horizontal_pull", equipment: "barbell", rir: "1-2", cue: "Hinge, chest proud, row to the belly", rest: 150, increment: 5 },
  { name: "Seal Row", primary: "mid_back", secondary: ["lats", "biceps", "rear_delts"], pattern: "horizontal_pull", equipment: "barbell", rir: "1-2", cue: "Chest pinned to the bench, strict pull", rest: 150, increment: 5 },

  // ---- Shoulders: vertical press ----
  { name: "Seated DB Shoulder Press", primary: "front_delts", secondary: ["side_delts", "triceps"], pattern: "vertical_press", equipment: "dumbbell", rir: "1-2", cue: "DBs low in the bottom for stretch", rest: 150, increment: 5, rotation: ["machine_shoulder_press", "standing_barbell_ohp"] },
  { name: "Machine Shoulder Press", primary: "front_delts", secondary: ["side_delts", "triceps"], pattern: "vertical_press", equipment: "machine", rir: "1-2", cue: "Smooth press, full lockout", rest: 150, increment: 5 },
  { name: "Standing Barbell OHP", primary: "front_delts", secondary: ["side_delts", "triceps"], pattern: "vertical_press", equipment: "barbell", rir: "1-2", cue: "Tight core, bar over mid-foot", rest: 150, increment: 5 },

  // ---- Side delts: lateral raise ----
  { name: "Cable Lateral Raise", primary: "side_delts", secondary: [], pattern: "lateral_raise", equipment: "cable", rir: "0-1", cue: "Start behind the body. Last set to failure + lengthened partials", rest: 75, increment: 2.5, rotation: ["db_lateral_raise", "machine_lateral_raise"] },
  { name: "DB Lateral Raise", primary: "side_delts", secondary: [], pattern: "lateral_raise", equipment: "dumbbell", rir: "0-1", cue: "Last set: failure, then lengthened partials", rest: 75, increment: 2.5, rotation: ["cable_lateral_raise", "machine_lateral_raise"] },
  { name: "Machine Lateral Raise", primary: "side_delts", secondary: [], pattern: "lateral_raise", equipment: "machine", rir: "0-1", cue: "Lead with the elbows, controlled negative", rest: 75, increment: 2.5 },

  // ---- Rear delts ----
  { name: "Reverse Pec-Deck", primary: "rear_delts", secondary: ["mid_back"], pattern: "rear_delt_fly", equipment: "machine", rir: "0-1", cue: "Slow negatives, no swinging", rest: 75, increment: 5, rotation: ["cable_rear_delt_fly", "bent_over_db_fly"] },
  { name: "Cable Rear Delt Fly", primary: "rear_delts", secondary: ["mid_back"], pattern: "rear_delt_fly", equipment: "cable", rir: "0-1", cue: "Cross-body cables, pull wide", rest: 75, increment: 2.5 },
  { name: "Bent-Over DB Fly", primary: "rear_delts", secondary: ["mid_back"], pattern: "rear_delt_fly", equipment: "dumbbell", rir: "0-1", cue: "Hinge over, pinkies up, no swing", rest: 75, increment: 2.5 },
  { name: "Face Pull", primary: "rear_delts", secondary: ["mid_back"], pattern: "rear_delt_fly", equipment: "cable", rir: "0-1", cue: "Pull to eyebrows, external rotate", rest: 60, increment: 2.5, rotation: ["reverse_pec_deck"] },

  // ---- Triceps ----
  { name: "Overhead Cable Triceps Extension", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "cable", rir: "0-1", cue: "Big stretch behind the head", rest: 75, increment: 2.5, rotation: ["overhead_ez_extension", "cross_body_cable_extension"] },
  { name: "Overhead EZ Triceps Extension", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "barbell", rir: "0-1", cue: "Stretch the long head hard", rest: 75, increment: 2.5, rotation: ["overhead_cable_extension"] },
  { name: "Overhead EZ Extension", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "barbell", rir: "0-1", cue: "Deep stretch behind the head", rest: 75, increment: 2.5 },
  { name: "Overhead Cable Extension", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "cable", rir: "0-1", cue: "Long-head stretch, elbows tight", rest: 75, increment: 2.5 },
  { name: "Cross-Body Cable Extension", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "cable", rir: "0-1", cue: "Single arm across the body, full lockout", rest: 60, increment: 2.5 },
  { name: "Triceps Pushdown", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "cable", rir: "0-1", cue: "Push close to failure both sets", rest: 75, increment: 2.5, rotation: ["rope_pushdown", "dip_machine"] },
  { name: "Rope Pushdown", primary: "triceps", secondary: [], pattern: "elbow_extension", equipment: "cable", rir: "0-1", cue: "Spread the rope at the bottom", rest: 75, increment: 2.5 },
  { name: "Dip Machine", primary: "triceps", secondary: ["chest"], pattern: "elbow_extension", equipment: "machine", rir: "0-1", cue: "Full lockout, controlled negative", rest: 75, increment: 5 },

  // ---- Biceps ----
  { name: "Incline DB Curl", primary: "biceps", secondary: ["forearms"], pattern: "elbow_flexion", equipment: "dumbbell", rir: "0-1", cue: "Arms hang back, stretch the biceps hard", rest: 75, increment: 2.5, rotation: ["bayesian_cable_curl", "preacher_curl"] },
  { name: "Bayesian Cable Curl", primary: "biceps", secondary: ["forearms"], pattern: "elbow_flexion", equipment: "cable", rir: "0-1", cue: "Arm behind body = max stretch", rest: 75, increment: 2.5, rotation: ["incline_db_curl", "ez_bar_curl"] },
  { name: "Preacher Curl", primary: "biceps", secondary: ["forearms"], pattern: "elbow_flexion", equipment: "machine", rir: "0-1", cue: "Full stretch at the bottom, no bounce", rest: 75, increment: 2.5 },
  { name: "EZ Bar Curl", primary: "biceps", secondary: ["forearms"], pattern: "elbow_flexion", equipment: "barbell", rir: "0-1", cue: "Elbows pinned, no swing", rest: 75, increment: 2.5 },
  { name: "Hammer Curl", primary: "biceps", secondary: ["forearms"], pattern: "elbow_flexion", equipment: "dumbbell", rir: "0", cue: "Neutral grip, brachialis + forearm", rest: 75, increment: 2.5 },

  // ---- Quads ----
  { name: "Hack Squat", primary: "quads", secondary: ["glutes"], pattern: "squat", equipment: "machine", rir: "1-2", cue: "Deep as mobility allows, controlled descent", rest: 180, increment: 10, rotation: ["high_bar_squat", "pendulum_squat", "leg_press_low_feet"] },
  { name: "Leg Press", primary: "quads", secondary: ["glutes"], pattern: "squat", equipment: "machine", rir: "1-2", cue: "Full depth, no lockout rest", rest: 150, increment: 10, rotation: ["hack_squat", "smith_squat"] },
  { name: "High-Bar Squat", primary: "quads", secondary: ["glutes"], pattern: "squat", equipment: "barbell", rir: "1-2", cue: "Upright torso, break parallel", rest: 180, increment: 10 },
  { name: "Pendulum Squat", primary: "quads", secondary: ["glutes"], pattern: "squat", equipment: "machine", rir: "1-2", cue: "Deep knee travel, controlled", rest: 180, increment: 10 },
  { name: "Leg Press (low feet)", primary: "quads", secondary: ["glutes"], pattern: "squat", equipment: "machine", rir: "1-2", cue: "Low feet = more quad, full depth", rest: 150, increment: 10 },
  { name: "Smith Squat", primary: "quads", secondary: ["glutes"], pattern: "squat", equipment: "smith", rir: "1-2", cue: "Feet forward, deep and controlled", rest: 180, increment: 10 },

  // ---- Knee extension (quad iso) ----
  { name: "Leg Extension", primary: "quads", secondary: [], pattern: "knee_extension", equipment: "machine", rir: "0-1", cue: "Lean back for rectus femoris stretch. Last set to failure", rest: 75, increment: 5, rotation: ["sissy_squat", "reverse_nordic"] },
  { name: "Sissy Squat", primary: "quads", secondary: [], pattern: "knee_extension", equipment: "bodyweight", rir: "0-1", cue: "Knees forward, lean back, deep stretch", rest: 75, increment: 0 },
  { name: "Reverse Nordic", primary: "quads", secondary: [], pattern: "knee_extension", equipment: "bodyweight", rir: "0-1", cue: "Lean back slow, feel the quad stretch", rest: 75, increment: 0 },

  // ---- Hamstrings: knee flexion ----
  { name: "Seated Leg Curl", primary: "hamstrings", secondary: ["calves"], pattern: "knee_flexion", equipment: "machine", rir: "0-1", cue: "Seated beats lying — hams are lengthened. Squeeze and control", rest: 90, increment: 5, rotation: ["lying_leg_curl", "nordic_curl_assisted"] },
  { name: "Lying Leg Curl", primary: "hamstrings", secondary: ["calves"], pattern: "knee_flexion", equipment: "machine", rir: "0-1", cue: "Control the negative", rest: 90, increment: 5, rotation: ["seated_leg_curl"] },
  { name: "Nordic Curl (assisted)", primary: "hamstrings", secondary: ["calves"], pattern: "knee_flexion", equipment: "bodyweight", rir: "0-1", cue: "Fight the negative all the way down", rest: 90, increment: 0 },

  // ---- Hamstrings/glutes: hinge ----
  { name: "Romanian Deadlift", primary: "hamstrings", secondary: ["glutes", "spinal_erectors"], pattern: "hinge", equipment: "barbell", rir: "1-2", cue: "Push hips back, feel the ham stretch, don't chase depth with spine", rest: 180, increment: 10, rotation: ["db_rdl", "trap_bar_deadlift", "45_back_extension_loaded"] },
  { name: "DB RDL", primary: "hamstrings", secondary: ["glutes", "spinal_erectors"], pattern: "hinge", equipment: "dumbbell", rir: "1-2", cue: "Hips back, DBs graze the legs", rest: 150, increment: 5 },
  { name: "Trap Bar Deadlift", primary: "hamstrings", secondary: ["glutes", "spinal_erectors", "quads"], pattern: "hinge", equipment: "barbell", rir: "1-2", cue: "Hinge dominant, flat back", rest: 180, increment: 10 },
  { name: "45° Back Extension (loaded)", primary: "hamstrings", secondary: ["glutes", "spinal_erectors"], pattern: "hinge", equipment: "bodyweight_loaded", rir: "1-2", cue: "Round-back optional, squeeze glutes at top", rest: 120, increment: 5 },

  // ---- Glutes: lunge ----
  { name: "Bulgarian Split Squat", primary: "glutes", secondary: ["quads", "hamstrings"], pattern: "lunge", equipment: "dumbbell", rir: "1-2", cue: "Long stride = more glute. Brutal by design", rest: 120, increment: 5, rotation: ["walking_lunge", "smith_reverse_lunge"] },
  { name: "Walking Lunge", primary: "glutes", secondary: ["quads", "hamstrings"], pattern: "lunge", equipment: "dumbbell", rir: "1-2", cue: "Long steps, drive through the heel", rest: 120, increment: 5 },
  { name: "Smith Reverse Lunge", primary: "glutes", secondary: ["quads", "hamstrings"], pattern: "lunge", equipment: "smith", rir: "1-2", cue: "Step back, stay tall, glute stretch", rest: 120, increment: 5 },

  // ---- Calves ----
  { name: "Standing Calf Raise", primary: "calves", secondary: [], pattern: "calf_raise", equipment: "machine", rir: "0-1", cue: "2-second pause in the bottom stretch every rep", rest: 75, increment: 5, rotation: ["leg_press_calf_raise"] },
  { name: "Seated Calf Raise", primary: "calves", secondary: [], pattern: "calf_raise", equipment: "machine", rir: "0-1", cue: "Pause the stretch at the bottom", rest: 75, increment: 5, rotation: ["standing_calf_raise"] },
  { name: "Leg Press Calf Raise", primary: "calves", secondary: [], pattern: "calf_raise", equipment: "machine", rir: "0-1", cue: "Full stretch, full contraction on the sled", rest: 75, increment: 5 },

  // ---- Abs ----
  { name: "Cable Crunch", primary: "abs", secondary: [], pattern: "spinal_flexion", equipment: "cable", rir: "0-1", cue: "Round the spine, don't just hinge hips", rest: 60, increment: 5, rotation: ["ab_wheel", "machine_crunch"] },
  { name: "Ab Wheel", primary: "abs", secondary: [], pattern: "spinal_flexion", equipment: "bodyweight", rir: "0-1", cue: "Extend as far as control allows", rest: 60, increment: 0 },
  { name: "Machine Crunch", primary: "abs", secondary: [], pattern: "spinal_flexion", equipment: "machine", rir: "0-1", cue: "Crunch the ribs to the pelvis", rest: 60, increment: 5 },
  { name: "Hanging Leg Raise", primary: "abs", secondary: [], pattern: "hip_flexion", equipment: "bodyweight", rir: "0-1", cue: "No swinging, curl the pelvis", rest: 60, increment: 0, rotation: ["captains_chair_raise", "cable_crunch"] },
  { name: "Captain's Chair Raise", primary: "abs", secondary: [], pattern: "hip_flexion", equipment: "machine", rir: "0-1", cue: "Curl the pelvis, no momentum", rest: 60, increment: 0 },

  // ---- Cardio (excluded from volume/progression) ----
  { name: "Incline Walk", primary: "cardio", secondary: [], pattern: "cardio", equipment: "none", rir: "n/a", cue: "Optional swap 1x/week: bike intervals 30s hard / 90s easy x 8-10", rest: 0, increment: 0, rotation: ["bike_intervals"] },
  { name: "Bike Intervals", primary: "cardio", secondary: [], pattern: "cardio", equipment: "machine", rir: "n/a", cue: "30s hard / 90s easy x 8-10", rest: 0, increment: 0 },
];

function build(def: ExDef): Exercise {
  const isIso = def.rest !== undefined ? def.rest <= 90 : false;
  return {
    id: slug(def.name),
    name: def.name,
    primary_muscle: def.primary,
    secondary_muscles: def.secondary ?? [],
    movement_pattern: def.pattern,
    equipment: def.equipment,
    rir_target: def.rir ?? (isIso ? "0-1" : "1-2"),
    cue_text: def.cue ?? "",
    rest_seconds: def.rest ?? (isIso ? ISO_REST : COMPOUND_REST),
    weight_increment: def.increment ?? 5,
    rotation_pool: def.rotation ?? [],
  };
}

/** Map of exercise id -> Exercise. */
export const EXERCISES: Record<string, Exercise> = Object.fromEntries(
  DEFS.map((d) => {
    const ex = build(d);
    return [ex.id, ex];
  })
);

export const ALL_EXERCISES: Exercise[] = Object.values(EXERCISES);

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES[id];
}
