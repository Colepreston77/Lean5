import { describe, it, expect } from "vitest";
import { validateDayAdaptation, currentDaySlots, type AdaptSlotInput } from "@/lib/ai/adaptDay";
import type { ProgramDay } from "@/lib/engine/types";

const slots: AdaptSlotInput[] = [
  { slot_id: "d1_1", exercise_id: "high_bar_squat", sets: 3, reps_low: 6, reps_high: 10, group: "A" },
  { slot_id: "d1_2", exercise_id: "incline_db_press", sets: 3, reps_low: 8, reps_high: 12, group: "B" },
];

describe("validateDayAdaptation", () => {
  it("accepts a same-muscle swap and flags the pattern change", () => {
    const res = validateDayAdaptation(
      { rationale: "no ankle loading", changes: [{ slot_id: "d1_1", to_exercise_id: "leg_extension", reason: "seated, no ankle" }] },
      slots
    );
    expect(res.ok).toBe(true);
    expect(res.changes).toHaveLength(1);
    expect(res.changes[0].from_exercise_id).toBe("high_bar_squat");
    expect(res.changes[0].to_exercise_id).toBe("leg_extension");
    expect(res.changes[0].pattern_changed).toBe(true);
  });

  it("rejects a swap that changes the slot's primary muscle", () => {
    const res = validateDayAdaptation(
      { changes: [{ slot_id: "d1_1", to_exercise_id: "cable_lateral_raise", reason: "nope" }] },
      slots
    );
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("same primary muscle");
  });

  it("rejects an unknown exercise and an unknown slot", () => {
    expect(validateDayAdaptation({ changes: [{ slot_id: "d1_1", to_exercise_id: "unicorn_press" }] }, slots).ok).toBe(false);
    expect(validateDayAdaptation({ changes: [{ slot_id: "d9_9", to_exercise_id: "leg_extension" }] }, slots).ok).toBe(false);
  });

  it("treats a no-op (same exercise) as a kept slot, not a change", () => {
    const res = validateDayAdaptation({ changes: [{ slot_id: "d1_1", to_exercise_id: "high_bar_squat" }] }, slots);
    expect(res.ok).toBe(true);
    expect(res.changes).toHaveLength(0);
  });

  it("accepts an empty change set (nothing needs adapting)", () => {
    const res = validateDayAdaptation({ rationale: "all clear", changes: [] }, slots);
    expect(res.ok).toBe(true);
    expect(res.changes).toHaveLength(0);
  });
});

describe("currentDaySlots", () => {
  const day: ProgramDay = {
    day_order: 1,
    name: "Lower",
    slots: [
      { slot_id: "d1_1", exercise_id: "high_bar_squat", group: "A", sets: 3, reps_low: 6, reps_high: 10, rir_target: "1-2" },
    ],
  };

  it("applies an existing swap as the current exercise", () => {
    const out = currentDaySlots(day, { d1_1: "leg_press" });
    expect(out[0].exercise_id).toBe("leg_press");
    expect(out[0].sets).toBe(3);
  });

  it("falls back to the base exercise when no swap exists", () => {
    const out = currentDaySlots(day, {});
    expect(out[0].exercise_id).toBe("high_bar_squat");
  });
});
