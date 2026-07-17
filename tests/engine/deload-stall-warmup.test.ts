import { describe, it, expect } from "vitest";
import { isDeloadWeek, deloadSets, deloadSlot } from "@/lib/engine/deload";
import { isStalled, stallFlag } from "@/lib/engine/stall";
import { rampSets } from "@/lib/engine/warmup";
import { epley1RM, bestSetByE1RM } from "@/lib/engine/oneRepMax";
import type { ExerciseSlot } from "@/lib/engine/types";

describe("deload", () => {
  it("flags the 4th week as deload", () => {
    expect(isDeloadWeek(4)).toBe(true);
    expect(isDeloadWeek(1)).toBe(false);
    expect(isDeloadWeek(3, 3)).toBe(true);
  });

  it("halves sets with a floor of 1", () => {
    expect(deloadSets(3)).toBe(2);
    expect(deloadSets(2)).toBe(1);
    expect(deloadSets(4)).toBe(2);
    expect(deloadSets(1)).toBe(1);
  });

  it("deloadSlot cuts sets and sets RIR 3-4, leaves warmups alone", () => {
    const slot: ExerciseSlot = { slot_id: "d1_1", exercise_id: "x", group: "A", sets: 3, reps_low: 8, reps_high: 12, rir_target: "1-2" };
    const d = deloadSlot(slot);
    expect(d.sets).toBe(2);
    expect(d.rir_target).toBe("3-4");
    const warm = deloadSlot({ ...slot, is_warmup: true });
    expect(warm.sets).toBe(3);
  });
});

describe("stall detection", () => {
  it("detects no e1RM improvement over 3 sessions", () => {
    const bests = [
      { weight: 100, reps: 8 },
      { weight: 100, reps: 8 },
      { weight: 100, reps: 8 },
    ];
    expect(isStalled(bests)).toBe(true);
    expect(stallFlag(bests).options).toContain("swap_variant");
  });

  it("not stalled if the most recent session improved", () => {
    const bests = [
      { weight: 100, reps: 8 },
      { weight: 100, reps: 8 },
      { weight: 105, reps: 8 },
    ];
    expect(isStalled(bests)).toBe(false);
  });

  it("needs at least 3 sessions", () => {
    expect(isStalled([{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }])).toBe(false);
  });
});

describe("warmup ramp", () => {
  it("generates 2 ramp sets at ~50% and ~75%", () => {
    const r = rampSets(200);
    expect(r).toHaveLength(2);
    expect(r[0].weight).toBe(100);
    expect(r[1].weight).toBe(150);
    expect(r[0].reps).toBe(8);
    expect(r[1].reps).toBe(3);
  });

  it("returns none without a working weight", () => {
    expect(rampSets(null)).toEqual([]);
    expect(rampSets(0)).toEqual([]);
  });
});

describe("epley", () => {
  it("returns the weight at 1 rep", () => {
    expect(epley1RM(225, 1)).toBe(225);
  });
  it("picks the best set by estimated 1RM", () => {
    const best = bestSetByE1RM([
      { weight: 100, reps: 10 }, // 133
      { weight: 120, reps: 5 },  // 140
    ]);
    expect(best).toEqual({ weight: 120, reps: 5 });
  });
});
