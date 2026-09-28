import type { Program, ExerciseSlot, ProgramDay } from "@/lib/engine/types";
import { slug } from "./exercises";

// -----------------------------------------------------------------------------
// "Wedding Peak" — a 2-week aesthetic peak block that runs as an ISOLATED detour
// mesocycle (kind = "detour"), so it never pollutes normal progression carryover.
//
// Design intent (not the standard hypertrophy block):
//   - You can't build meaningful muscle in 2 weeks, so this preserves the muscle
//     you have, keeps it FULL (pump/glycogen), and biases volume toward the
//     muscles that show in a suit / photos: side delts, arms, upper chest,
//     upper back/lats (V-taper), and abs (waist). Legs get ONE maintenance day.
//   - Reps skew a touch higher (pump + joint-friendly in a deficit). Same weights
//     as your last real block carry over automatically (peak week 1 anchors to
//     Block 2's last hard week).
//   - It runs as a 2-week block (week_count = 2). Week 1 is full peak volume;
//     WEEK 2 is intentionally the app's built-in deload — half the sets, SAME
//     weights, easier effort. That doubles as a pre-event TAPER: it drops
//     systemic fatigue / inflammation / water so you look sharper and stay full
//     into the weekend. (The Today header will show "DELOAD WEEK" in week 2 —
//     that's the taper, by design.) See WEDDING-PEAK.md for the nutrition/water
//     side, which is the bigger lever than training over two weeks.
//   - Cardio is deliberately NOT in the template — you're running your own.
// -----------------------------------------------------------------------------

type SlotDef = {
  group: string;
  name: string; // exercise name -> id via slug()
  sets: number;
  reps: string; // "8-12" | "12-20"
  rir: string;
};

type DayDef = { name: string; slots: SlotDef[] };

const DAYS: DayDef[] = [
  {
    name: "Delts & Arms — Pump",
    slots: [
      { group: "A", name: "Seated DB Shoulder Press", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "A", name: "Cable Lateral Raise", sets: 4, reps: "12-20", rir: "0-1" },
      { group: "B", name: "Incline DB Curl", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "B", name: "Overhead Cable Triceps Extension", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Reverse Pec-Deck", sets: 3, reps: "12-20", rir: "0-1" },
      { group: "C", name: "Hammer Curl", sets: 2, reps: "12-15", rir: "0" },
      { group: "C", name: "Rope Pushdown", sets: 2, reps: "12-15", rir: "0" },
    ],
  },
  {
    name: "Chest & Back — Width",
    slots: [
      { group: "A", name: "Incline DB Press", sets: 4, reps: "8-12", rir: "1-2" },
      { group: "A", name: "Weighted Pull-Up", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "B", name: "Seated Cable Row (Neutral)", sets: 3, reps: "10-12", rir: "1-2" },
      { group: "B", name: "Lat Pulldown (Wide)", sets: 3, reps: "10-15", rir: "1-2" },
      { group: "C", name: "Cable Fly (low-to-high)", sets: 3, reps: "12-20", rir: "0-1" },
      { group: "C", name: "Cable Lateral Raise", sets: 3, reps: "12-20", rir: "0-1" },
    ],
  },
  {
    name: "Legs — Quads, Hams & Calves",
    slots: [
      { group: "A", name: "Hack Squat", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "A", name: "Romanian Deadlift", sets: 3, reps: "8-10", rir: "1-2" },
      { group: "B", name: "Leg Extension", sets: 3, reps: "12-20", rir: "0-1" },
      { group: "B", name: "Seated Leg Curl", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Standing Calf Raise", sets: 4, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Hanging Leg Raise", sets: 3, reps: "12-20", rir: "0-1" },
    ],
  },
  {
    name: "Delts, Arms & Chest — Pump",
    slots: [
      { group: "A", name: "Low-Incline Machine Press", sets: 3, reps: "10-12", rir: "1" },
      { group: "A", name: "DB Lateral Raise", sets: 4, reps: "12-20", rir: "0-1" },
      { group: "B", name: "Bayesian Cable Curl", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "B", name: "Overhead EZ Triceps Extension", sets: 3, reps: "10-15", rir: "0-1" },
      { group: "C", name: "Face Pull", sets: 3, reps: "15-20", rir: "0-1" },
      { group: "C", name: "Cable Crunch", sets: 3, reps: "10-15", rir: "0-1" },
    ],
  },
  {
    name: "Back & Shoulders — V-Taper",
    slots: [
      { group: "A", name: "Chest-Supported Row", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "A", name: "Neutral-Grip Pulldown", sets: 3, reps: "10-12", rir: "1-2" },
      { group: "B", name: "Machine Shoulder Press", sets: 3, reps: "8-12", rir: "1-2" },
      { group: "B", name: "Cable Lateral Raise", sets: 4, reps: "12-20", rir: "0-1" },
      { group: "C", name: "Preacher Curl", sets: 2, reps: "12-15", rir: "0-1" },
      { group: "C", name: "Triceps Pushdown", sets: 2, reps: "12-15", rir: "0-1" },
      { group: "C", name: "Reverse Pec-Deck", sets: 3, reps: "12-20", rir: "0-1" },
    ],
  },
];

/** Parse "8-12" -> {low, high}. Peak uses only plain numeric ranges. */
function parseReps(reps: string): { low: number; high: number } {
  const m = reps.match(/(\d+)\s*-\s*(\d+)/);
  return { low: m ? Number(m[1]) : 0, high: m ? Number(m[2]) : 0 };
}

function buildDay(def: DayDef, dayOrder: number): ProgramDay {
  const slots: ExerciseSlot[] = def.slots.map((s, i) => {
    const { low, high } = parseReps(s.reps);
    return {
      slot_id: `p${dayOrder}_${i + 1}`, // "p" = peak-block slots, distinct from the main program
      exercise_id: slug(s.name),
      group: s.group,
      sets: s.sets,
      reps_low: low,
      reps_high: high,
      rir_target: s.rir,
    };
  });
  return { day_order: dayOrder, name: def.name, slots };
}

/** Total weeks incl. the week-2 taper (the built-in deload). Peak runs 2 weeks. */
export const WEDDING_PEAK_WEEKS = 2;

export const WEDDING_PEAK_PROGRAM: Program = {
  name: "Wedding Peak",
  days_per_week: 5,
  days: DAYS.map((d, i) => buildDay(d, i + 1)),
};
