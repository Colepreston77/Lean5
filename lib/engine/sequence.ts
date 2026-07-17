// Session sequencing. Workouts are a SEQUENCE, not calendar-locked: the cursor
// advances only when a session is completed, so skipping a calendar day never
// skips a workout's content — the next gym day just serves the next workout.

export const MISSED_WEEK_THRESHOLD = 3;

export interface SchedulePosition {
  /** 1-indexed mesocycle week the next session belongs to. */
  currentWeek: number;
  /** day_order (1..daysPerWeek) of the next session to serve. */
  nextDayOrder: number;
  /** true when all weeks * days have been completed. */
  mesocycleComplete: boolean;
}

/**
 * Given how many sessions have been completed in this mesocycle, where are we?
 * completedCount advances on completion only.
 */
export function schedulePosition(
  completedCount: number,
  daysPerWeek: number,
  weekCount: number
): SchedulePosition {
  const total = daysPerWeek * weekCount;
  const mesocycleComplete = completedCount >= total;
  const currentWeek = Math.min(weekCount, Math.floor(completedCount / daysPerWeek) + 1);
  const nextDayOrder = (completedCount % daysPerWeek) + 1;
  return { currentWeek, nextDayOrder, mesocycleComplete };
}

/** Just the next workout's day_order given the last completed one. */
export function nextDayOrder(lastCompletedDayOrder: number | null, daysPerWeek: number): number {
  if (lastCompletedDayOrder == null) return 1;
  return (lastCompletedDayOrder % daysPerWeek) + 1;
}

/**
 * A rough week is 3+ missed workouts in a calendar week. Caller supplies how many
 * were actually completed in the current calendar week; we compare to target.
 * One skipped day absorbs silently (threshold is 3).
 */
export function shouldPromptRepeatWeek(completedThisWeek: number, daysPerWeek: number): boolean {
  return daysPerWeek - completedThisWeek >= MISSED_WEEK_THRESHOLD;
}
