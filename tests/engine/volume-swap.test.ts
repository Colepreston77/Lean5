import { describe, it, expect } from "vitest";
import { weeklyVolume } from "@/lib/engine/volume";
import { swapCandidates, nextSwap, swapsLocked, matchesSlotMuscle } from "@/lib/engine/swap";
import { ALL_EXERCISES, getExercise } from "@/lib/seed/exercises";
import type { Exercise } from "@/lib/engine/types";

describe("fractional volume counting", () => {
  it("credits primary 1.0 and each secondary 0.5", () => {
    const ex: Pick<Exercise, "primary_muscle" | "secondary_muscles"> = {
      primary_muscle: "chest",
      secondary_muscles: ["front_delts", "triceps"],
    };
    const vol = weeklyVolume([{ sets: 3, exercise: ex }]);
    expect(vol.chest).toBe(3);
    expect(vol.front_delts).toBe(1.5);
    expect(vol.triceps).toBe(1.5);
  });

  it("excludes cardio and warmups", () => {
    const cardio = { primary_muscle: "cardio" as const, secondary_muscles: [] };
    const chest = { primary_muscle: "chest" as const, secondary_muscles: [] };
    const vol = weeklyVolume([
      { sets: 5, exercise: cardio },
      { sets: 3, exercise: chest, is_warmup: true },
    ]);
    expect(vol.chest).toBe(0);
  });
});

describe("swap system", () => {
  it("offers same-muscle, compatible-pattern alternatives excluding the current", () => {
    const incline = getExercise("incline_db_press")!;
    const cands = swapCandidates(incline, ALL_EXERCISES);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every((c) => c.primary_muscle === "chest")).toBe(true);
    expect(cands.find((c) => c.id === "incline_db_press")).toBeUndefined();
  });

  it("prioritizes the rotation pool first", () => {
    const incline = getExercise("incline_db_press")!;
    const cands = swapCandidates(incline, ALL_EXERCISES);
    expect(cands[0].id).toBe("low_incline_smith_press");
  });

  it("nextSwap returns a different exercise", () => {
    const incline = getExercise("incline_db_press")!;
    const next = nextSwap(incline, ALL_EXERCISES);
    expect(next?.id).not.toBe("incline_db_press");
  });

  it("locks after 3 swaps", () => {
    expect(swapsLocked(2)).toBe(false);
    expect(swapsLocked(3)).toBe(true);
  });

  it("matchesSlotMuscle enforces the slot's primary muscle", () => {
    const legext = getExercise("leg_extension")!;
    expect(matchesSlotMuscle(legext, "quads")).toBe(true);
    expect(matchesSlotMuscle(legext, "chest")).toBe(false);
  });
});
