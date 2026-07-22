import type { Program, ExerciseSlot, ProgramDay } from "@/lib/engine/types";
import { slug } from "./exercises";

// -----------------------------------------------------------------------------
// The "Lean 5" default program. Slots reference exercises by id (slug of name).
// slot_id is STABLE and independent of the occupying exercise, so swaps and
// rotations keep progression history clean (history attaches to the slot).
// -----------------------------------------------------------------------------

type SlotDef = {
  group: string;
  name: string; // exercise name -> id via slug()
  sets: number;
  reps: string; // "8-12", "8-12 each", "12-15 min"
  rir: string;
  ramp?: boolean; // gains a set each week (volume ramp), then deloads
};

type DayDef = { name: string; slots: SlotDef[] };

const DAYS: DayDef[] = [
  {
    name: "Upper A — Width & Upper Chest",
    slots: [
      { group: "A", name: "Incline DB Press", sets: 4, reps: "8-12", rir: "1-2" },
      { group: "A", name: "Weighted Pull-Up", sets: 4, reps: "8-12", rir: "1-2" },
      { group: "B", name: "Seated Cable Row (Neutral)", sets: 3, reps: "10-12", rir: "1-2" },
      { group: "B", name: "Cable Lateral Raise", sets: 3, reps: "12-15", rir: "0-1", ramp: true },
      { group: "C", name: "Overhead Cable Triceps Extension", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Incline DB Curl", sets: 3, reps: "10-15", rir: "0-1" },
    ],
  },
  {
    name: "Lower A — Quad",
    slots: [
      { group: "A", name: "Hack Squat", sets: 3, reps: "6-10", rir: "1-2" },
      { group: "A", name: "Leg Press", sets: 3, reps: "10-12", rir: "1-2" },
      { group: "B", name: "Seated Leg Curl", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "B", name: "Leg Extension", sets: 2, reps: "12-15", rir: "0-1" },
      { group: "C", name: "Standing Calf Raise", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Cable Crunch", sets: 3, reps: "10-15", rir: "0-1" },
    ],
  },
  {
    name: "Upper B — Thickness & Delts",
    slots: [
      { group: "A", name: "Seated DB Shoulder Press", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "A", name: "Chest-Supported Row", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "B", name: "Flat DB Press", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "B", name: "Lat Pulldown (Wide)", sets: 3, reps: "10-12", rir: "1-2" },
      { group: "C", name: "DB Lateral Raise", sets: 3, reps: "12-20", rir: "0-1" },
      { group: "C", name: "Reverse Pec-Deck", sets: 3, reps: "12-15", rir: "0-1", ramp: true },
      { group: "C", name: "Triceps Pushdown", sets: 2, reps: "10-15", rir: "0-1" },
    ],
  },
  {
    name: "Lower B — Hinge & Glute",
    slots: [
      { group: "A", name: "Romanian Deadlift", sets: 3, reps: "8-10", rir: "1-2" },
      { group: "A", name: "Bulgarian Split Squat", sets: 3, reps: "8-12 each", rir: "1-2" },
      { group: "B", name: "Lying Leg Curl", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "B", name: "Leg Extension", sets: 2, reps: "12-15", rir: "0-1" },
      { group: "C", name: "Seated Calf Raise", sets: 3, reps: "12-15", rir: "0-1" },
      { group: "C", name: "Hanging Leg Raise", sets: 3, reps: "10-15", rir: "0-1" },
    ],
  },
  {
    name: "Day 5 — Aesthetic (Delts/Arms/Pump)",
    slots: [
      { group: "A", name: "Low-Incline Machine Press", sets: 3, reps: "10-12", rir: "1" },
      { group: "A", name: "Cable Lateral Raise", sets: 4, reps: "12-20", rir: "0-1", ramp: true },
      { group: "B", name: "Bayesian Cable Curl", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "B", name: "Overhead EZ Triceps Extension", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Face Pull", sets: 3, reps: "15-20", rir: "0-1" },
      // Original spec superset "Hammer Curl + Pushdown" split into two slots so
      // biceps and triceps each get honest volume credit.
      { group: "C", name: "Hammer Curl", sets: 2, reps: "12-15", rir: "0" },
      { group: "C", name: "Rope Pushdown", sets: 2, reps: "12-15", rir: "0" },
      { group: "Conditioning", name: "Incline Walk", sets: 1, reps: "12-15 min", rir: "n/a" },
    ],
  },
];

/** Parse "8-12" | "8-12 each" | "12-15 min" -> {low, high, label?} */
function parseReps(reps: string): { low: number; high: number; label?: string } {
  const m = reps.match(/(\d+)\s*-\s*(\d+)/);
  const low = m ? Number(m[1]) : 0;
  const high = m ? Number(m[2]) : 0;
  const isPlain = /^\d+\s*-\s*\d+$/.test(reps.trim());
  return isPlain ? { low, high } : { low, high, label: reps };
}

function buildDay(def: DayDef, dayOrder: number): ProgramDay {
  // per-day sequence counter for stable slot ids
  const slots: ExerciseSlot[] = def.slots.map((s, i) => {
    const { low, high, label } = parseReps(s.reps);
    return {
      slot_id: `d${dayOrder}_${i + 1}`,
      exercise_id: slug(s.name),
      group: s.group,
      sets: s.sets,
      reps_low: low,
      reps_high: high,
      reps_label: label,
      rir_target: s.rir,
      ramp: s.ramp,
    };
  });
  return { day_order: dayOrder, name: def.name, slots };
}

export const LEAN5_PROGRAM: Program = {
  name: "Lean 5",
  days_per_week: 5,
  days: DAYS.map((d, i) => buildDay(d, i + 1)),
};
