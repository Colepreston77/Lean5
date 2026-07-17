import { describe, it, expect } from "vitest";
import { schedulePosition, nextDayOrder, shouldPromptRepeatWeek } from "@/lib/engine/sequence";

describe("schedule position (sequence, not calendar)", () => {
  it("starts at week 1 day 1", () => {
    expect(schedulePosition(0, 5, 4)).toEqual({ currentWeek: 1, nextDayOrder: 1, mesocycleComplete: false });
  });

  it("advances the cursor only on completion", () => {
    expect(schedulePosition(3, 5, 4).nextDayOrder).toBe(4);
  });

  it("rolls into the next week after finishing a week's days", () => {
    const p = schedulePosition(5, 5, 4);
    expect(p.currentWeek).toBe(2);
    expect(p.nextDayOrder).toBe(1);
  });

  it("marks the mesocycle complete at the end", () => {
    expect(schedulePosition(20, 5, 4).mesocycleComplete).toBe(true);
  });

  it("nextDayOrder wraps within the week", () => {
    expect(nextDayOrder(5, 5)).toBe(1);
    expect(nextDayOrder(2, 5)).toBe(3);
    expect(nextDayOrder(null, 5)).toBe(1);
  });
});

describe("missed week", () => {
  it("one skipped day absorbs silently", () => {
    expect(shouldPromptRepeatWeek(4, 5)).toBe(false);
  });
  it("prompts to repeat when 3+ missed", () => {
    expect(shouldPromptRepeatWeek(2, 5)).toBe(true);
  });
});
