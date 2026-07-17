import { describe, it, expect } from "vitest";
import { LEAN5_PROGRAM } from "@/lib/seed/program";
import { EXERCISES, getExercise } from "@/lib/seed/exercises";
import { auditWeek, type WeekPlan, type AuditSlot, type AuditDay } from "@/lib/engine/audit";
import { weeklyVolume, volumeIssues, type VolumeSlot } from "@/lib/engine/volume";
import { weeklySlotSets, DELOAD_RIR, isDeloadWeek } from "@/lib/engine/deload";

const WEEK_COUNT = 4;

// Build an audit WeekPlan from the seed program for a given week (cold start).
function buildWeekPlan(week: number): WeekPlan {
  const isDeload = isDeloadWeek(week, WEEK_COUNT);
  const days: AuditDay[] = LEAN5_PROGRAM.days.map((day) => {
    const slots: AuditSlot[] = day.slots.map((slot) => {
      const ex = getExercise(slot.exercise_id)!;
      const isCardio = ex.primary_muscle === "cardio";
      return {
        slot_id: slot.slot_id,
        exercise: ex,
        slot_primary_muscle: ex.primary_muscle,
        sets: isCardio ? slot.sets : weeklySlotSets(slot.sets, week, WEEK_COUNT, Boolean(slot.ramp)),
        reps_low: slot.reps_low,
        reps_high: slot.reps_high,
        rir_target: isDeload && !isCardio ? DELOAD_RIR : slot.rir_target,
        rest_seconds: ex.rest_seconds,
        increment: ex.weight_increment,
        target_weight: null, // cold start
        cold_start: true,
      };
    });
    return {
      day_order: day.day_order,
      name: day.name,
      is_lower_body: /lower/i.test(day.name),
      slots,
    };
  });
  return { week, is_deload: isDeload, days };
}

// Weekly fractional volume for a given week, honoring the ramp.
function weekVolume(week: number) {
  const slots: VolumeSlot[] = LEAN5_PROGRAM.days.flatMap((d) =>
    d.slots.map((s) => ({
      sets: weeklySlotSets(s.sets, week, WEEK_COUNT, Boolean(s.ramp)),
      exercise: EXERCISES[s.exercise_id],
    }))
  );
  return weeklyVolume(slots);
}

describe("seed program passes its own audit gate", () => {
  for (const week of [1, 2, 3]) {
    it(`week ${week} (with volume ramp) publishes with no errors and no warnings`, () => {
      const result = auditWeek(buildWeekPlan(week));
      if (!result.passed) console.error(`WEEK ${week} ERRORS:`, result.errors.map((e) => e.detail));
      if (result.warnings.length) console.error(`WEEK ${week} WARNINGS:`, result.warnings.map((e) => e.detail));
      expect(result.passed).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  }

  it("deload week publishes with no errors", () => {
    const fullSets: Record<string, number> = {};
    for (const day of LEAN5_PROGRAM.days) for (const s of day.slots) fullSets[s.slot_id] = s.sets;
    const result = auditWeek(buildWeekPlan(4), fullSets);
    if (!result.passed) console.error("DELOAD ERRORS:", result.errors.map((e) => e.detail));
    expect(result.passed).toBe(true);
  });

  it("lower-body days (Lower A, Lower B) are not back-to-back", () => {
    const result = auditWeek(buildWeekPlan(1));
    const b2b = result.checks.find((c) => c.category === "Lower-body spacing");
    expect(b2b?.passed).toBe(true);
  });
});

describe("volume ramp behaves", () => {
  it("side + rear delts climb week over week, then deload", () => {
    const w1 = weekVolume(1);
    const w3 = weekVolume(3);
    const w4 = weekVolume(4);
    expect(w3.side_delts).toBeGreaterThan(w1.side_delts);
    expect(w3.rear_delts).toBeGreaterThan(w1.rear_delts);
    expect(w4.side_delts).toBeLessThan(w1.side_delts); // deload drops below wk1
    // eslint-disable-next-line no-console
    console.log("side_delts wk1/wk3/wk4:", w1.side_delts, w3.side_delts, w4.side_delts);
  });

  it("legs and arms do NOT ramp (fatigue management)", () => {
    expect(weekVolume(3).quads).toBe(weekVolume(1).quads);
    expect(weekVolume(3).biceps).toBe(weekVolume(1).biceps);
  });
});

describe("seed program weekly volume (fractional counting)", () => {
  const slots: VolumeSlot[] = LEAN5_PROGRAM.days.flatMap((d) =>
    d.slots.map((s) => ({ sets: s.sets, exercise: EXERCISES[s.exercise_id] }))
  );
  const vol = weeklyVolume(slots);

  it("every trained muscle gets a meaningful amount of weekly volume", () => {
    // Print the table so we can eyeball it during dev.
    // eslint-disable-next-line no-console
    console.log("Weekly fractional volume:", vol);
    // With fractional counting, no primary muscle should be starved.
    expect(vol.chest).toBeGreaterThanOrEqual(9);
    expect(vol.front_delts).toBeGreaterThanOrEqual(7); // fed by all the pressing
    expect(vol.biceps).toBeGreaterThanOrEqual(8);
    expect(vol.glutes).toBeGreaterThanOrEqual(6);
    expect(vol.side_delts).toBeGreaterThanOrEqual(10);
  });

  it("the baseline seed produces NO volume warnings (the gate is quiet on the plan it ships)", () => {
    const issues = volumeIssues(vol);
    if (issues.length) console.error("Unexpected volume warnings:", issues);
    expect(issues).toEqual([]);
  });

  it("no muscle is absurdly over-volumed", () => {
    for (const m of Object.keys(vol)) {
      expect(vol[m as keyof typeof vol]).toBeLessThanOrEqual(28);
    }
  });
});
