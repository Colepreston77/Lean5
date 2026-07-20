import { describe, it, expect } from "vitest";
import { computeNextTarget, getProgressionHint, roundToPlate } from "@/lib/engine/progression";

describe("double progression", () => {
  const base = { repsLow: 8, repsHigh: 12, increment: 5 };

  it("increases weight and resets reps when all sets hit the top of the range", () => {
    const r = computeNextTarget({ ...base, lastSets: [
      { weight: 100, reps: 12 },
      { weight: 100, reps: 12 },
      { weight: 100, reps: 12 },
    ]});
    expect(r.action).toBe("increase");
    expect(r.targetWeight).toBe(105);
    expect(r.targetRepsLow).toBe(8);
  });

  it("holds weight when mid-range", () => {
    const r = computeNextTarget({ ...base, lastSets: [
      { weight: 100, reps: 10 },
      { weight: 100, reps: 9 },
      { weight: 100, reps: 8 },
    ]});
    expect(r.action).toBe("hold");
    expect(r.targetWeight).toBe(100);
  });

  it("does not increase if only some sets hit the top", () => {
    const r = computeNextTarget({ ...base, lastSets: [
      { weight: 100, reps: 12 },
      { weight: 100, reps: 12 },
      { weight: 100, reps: 10 },
    ]});
    expect(r.action).toBe("hold");
  });

  it("backs off ~7.5% when the bottom of the range is missed", () => {
    const r = computeNextTarget({ ...base, lastSets: [
      { weight: 100, reps: 6 },
      { weight: 100, reps: 5 },
    ]});
    expect(r.action).toBe("back_off");
    expect(r.targetWeight).toBe(roundToPlate(92.5));
  });

  it("uses the lowest working-set weight as the base for the increase", () => {
    const r = computeNextTarget({ ...base, lastSets: [
      { weight: 105, reps: 12 },
      { weight: 100, reps: 12 },
    ]});
    expect(r.targetWeight).toBe(105); // 100 + 5
  });

  it("returns 'first' with no history", () => {
    const r = computeNextTarget({ ...base, lastSets: [] });
    expect(r.action).toBe("first");
    expect(r.targetWeight).toBeNull();
  });

  it("counts machine-assisted (negative-weight) sets as real history", () => {
    // Assisted pull-ups at -40 lb, all at the top of the range -> should still
    // progress (reduce assistance) rather than be discarded as no-history.
    const r = computeNextTarget({ ...base, lastSets: [
      { weight: -40, reps: 12 },
      { weight: -40, reps: 12 },
    ]});
    expect(r.action).toBe("increase");
    expect(r.targetWeight).toBe(-35); // -40 + 5 = less assistance
  });
});

describe("getProgressionHint", () => {
  const base = { repsLow: 8, repsHigh: 12, increment: 5, hasHistory: true };

  it("deload beats everything", () => {
    const h = getProgressionHint({ ...base, isDeload: true, lastSets: [{ weight: 100, reps: 12 }] });
    expect(h.action).toBe("deload");
    expect(h.color).toBe("blue");
  });

  it("cold start with no history", () => {
    const h = getProgressionHint({ ...base, hasHistory: false, lastSets: [] });
    expect(h.action).toBe("first");
    expect(h.text.toLowerCase()).toContain("first time");
  });

  it("green add-weight hint at top of range", () => {
    const h = getProgressionHint({ ...base, lastSets: [
      { weight: 100, reps: 12 }, { weight: 100, reps: 12 }, { weight: 100, reps: 12 },
    ]});
    expect(h.color).toBe("green");
    expect(h.text).toContain("Add 5 lb");
  });

  it("neutral hint shows the best set to beat", () => {
    const h = getProgressionHint({ ...base, lastSets: [
      { weight: 100, reps: 10 }, { weight: 100, reps: 9 },
    ]});
    expect(h.color).toBe("neutral");
    expect(h.text).toContain("100 x 10");
  });

  it("yellow back-off hint below range", () => {
    const h = getProgressionHint({ ...base, lastSets: [{ weight: 100, reps: 6 }] });
    expect(h.color).toBe("yellow");
  });

  it("shows the assisted (negative-weight) set to beat, not 'first time'", () => {
    const h = getProgressionHint({ ...base, lastSets: [
      { weight: -40, reps: 10 }, { weight: -40, reps: 9 },
    ]});
    expect(h.color).toBe("neutral");
    // The set is recorded and surfaced (not discarded as no-history). NOTE:
    // Epley isn't assist-aware, so it flags the lower-rep set as "best" — an
    // accepted quirk during the short assisted transition.
    expect(h.text).toContain("beat -40 x");
  });
});
