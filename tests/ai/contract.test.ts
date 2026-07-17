import { describe, it, expect } from "vitest";
import { validateGeneratedProgram, type GeneratedProgram } from "@/lib/ai/contract";
import { LEAN5_PROGRAM } from "@/lib/seed/program";

// Convert the built-in program into the external GeneratedProgram shape.
function lean5AsGenerated(): GeneratedProgram {
  return {
    name: "Lean 5 (next block)",
    days_per_week: LEAN5_PROGRAM.days_per_week,
    days: LEAN5_PROGRAM.days.map((d) => ({
      name: d.name,
      slots: d.slots.map((s) => ({
        exercise_id: s.exercise_id,
        group: s.group,
        sets: s.sets,
        reps_low: s.reps_low,
        reps_high: s.reps_high,
        reps_label: s.reps_label,
        rir_target: s.rir_target,
        ramp: s.ramp,
      })),
    })),
  };
}

describe("validateGeneratedProgram", () => {
  it("accepts the Lean 5 program round-tripped through the contract", () => {
    const res = validateGeneratedProgram(lean5AsGenerated());
    if (!res.ok) console.error(res.schemaErrors, res.auditErrors.map((e) => e.detail));
    expect(res.ok).toBe(true);
    expect(res.program?.days).toHaveLength(5);
  });

  it("rejects an unknown exercise (must be in the library)", () => {
    const p = lean5AsGenerated();
    p.days[0].slots[0].exercise_id = "unicorn_press";
    const res = validateGeneratedProgram(p);
    expect(res.ok).toBe(false);
    expect(res.schemaErrors.join(" ")).toContain("unknown exercise");
  });

  it("rejects an invalid rep range", () => {
    const p = lean5AsGenerated();
    p.days[0].slots[0].reps_low = 12;
    p.days[0].slots[0].reps_high = 8;
    const res = validateGeneratedProgram(p);
    expect(res.ok).toBe(false);
    expect(res.schemaErrors.join(" ")).toContain("rep range");
  });

  it("rejects days_per_week mismatch", () => {
    const p = lean5AsGenerated();
    p.days_per_week = 6;
    const res = validateGeneratedProgram(p);
    expect(res.ok).toBe(false);
  });

  it("blocks a plan that floods a muscle past the audit ceiling", () => {
    const p = lean5AsGenerated();
    // Jam 8 sets of cable laterals onto every day -> side delts way over the band.
    for (const d of p.days) d.slots.push({ exercise_id: "cable_lateral_raise", group: "C", sets: 8, reps_low: 12, reps_high: 20, rir_target: "0-1" });
    const res = validateGeneratedProgram(p);
    expect(res.ok).toBe(false);
    // volume warnings are surfaced even though they are WARN-level
    expect(res.auditWarnings.length + res.auditErrors.length).toBeGreaterThan(0);
  });

  it("resolves exercise references by name, not just id", () => {
    const p = lean5AsGenerated();
    p.days[0].slots[0].exercise_id = "Incline DB Press"; // name, should slug-resolve
    const res = validateGeneratedProgram(p);
    expect(res.ok).toBe(true);
  });
});
