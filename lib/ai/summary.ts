// Condenses a mesocycle's raw set logs into a compact per-slot progression
// summary — the factual input the AI reviews. Pure; no DB, no network.

import type { Program } from "@/lib/engine/types";
import { EXERCISES } from "@/lib/seed/exercises";
import { epley1RM } from "@/lib/engine/oneRepMax";
import { isStalled } from "@/lib/engine/stall";

export interface RawLog {
  slot_id: string;
  exercise_id: string;
  actual_weight: number | null;
  actual_reps: number | null;
  date: string | null;
  created_at: string;
}

export interface SlotProgress {
  slot_id: string;
  exercise_id: string;
  exercise_name: string;
  primary_muscle: string;
  sessions: number;
  first_e1rm: number;
  last_e1rm: number;
  best_e1rm: number;
  trend_pct: number; // (last - first) / first, %
  stalled: boolean;
  top_set: { weight: number; reps: number } | null;
}

export interface BlockSummary {
  program_name: string;
  total_logged_sessions: number;
  slots: SlotProgress[];
}

/** One best set (by e1RM) per session for a slot, ordered oldest→newest. */
function sessionBests(logs: RawLog[]): { weight: number; reps: number; e1rm: number; day: string }[] {
  const byDay = new Map<string, { weight: number; reps: number; e1rm: number }>();
  for (const l of logs) {
    if (!l.actual_weight || !l.actual_reps) continue;
    const day = (l.date ?? l.created_at).slice(0, 10);
    const e = epley1RM(Number(l.actual_weight), Number(l.actual_reps));
    const cur = byDay.get(day);
    if (!cur || e > cur.e1rm) byDay.set(day, { weight: Number(l.actual_weight), reps: Number(l.actual_reps), e1rm: e });
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ ...v, day }));
}

export function buildBlockSummary(program: Program, logs: RawLog[]): BlockSummary {
  const bySlot = new Map<string, RawLog[]>();
  for (const l of logs) {
    if (!bySlot.has(l.slot_id)) bySlot.set(l.slot_id, []);
    bySlot.get(l.slot_id)!.push(l);
  }

  const slots: SlotProgress[] = [];
  const sessionDays = new Set<string>();

  for (const day of program.days) {
    for (const slot of day.slots) {
      const logsForSlot = bySlot.get(slot.slot_id) ?? [];
      const bests = sessionBests(logsForSlot);
      bests.forEach((b) => sessionDays.add(b.day));
      const ex = EXERCISES[slot.exercise_id];
      if (bests.length === 0) continue;

      const first = bests[0].e1rm;
      const last = bests[bests.length - 1].e1rm;
      const best = Math.max(...bests.map((b) => b.e1rm));
      const topBest = bests.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), bests[0]);

      slots.push({
        slot_id: slot.slot_id,
        exercise_id: slot.exercise_id,
        exercise_name: ex?.name ?? slot.exercise_id,
        primary_muscle: (ex?.primary_muscle as string) ?? "?",
        sessions: bests.length,
        first_e1rm: Math.round(first),
        last_e1rm: Math.round(last),
        best_e1rm: Math.round(best),
        trend_pct: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
        stalled: isStalled(bests.map((b) => ({ weight: b.weight, reps: b.reps }))),
        top_set: { weight: topBest.weight, reps: topBest.reps },
      });
    }
  }

  return {
    program_name: program.name,
    total_logged_sessions: sessionDays.size,
    slots,
  };
}

/** Human/AI-readable rendering of the block summary. */
export function summaryToText(summary: BlockSummary): string {
  const lines: string[] = [
    `Program: ${summary.program_name}`,
    `Logged sessions this block: ${summary.total_logged_sessions}`,
    ``,
    `Per-exercise progression (est. 1RM, oldest→newest):`,
  ];
  for (const s of summary.slots) {
    const flag = s.stalled ? " [STALLED]" : s.trend_pct >= 5 ? " [progressing]" : s.trend_pct <= -3 ? " [regressing]" : " [flat]";
    lines.push(
      `- ${s.exercise_name} (${s.primary_muscle}): ${s.first_e1rm}→${s.last_e1rm} lb over ${s.sessions} sessions (${s.trend_pct >= 0 ? "+" : ""}${s.trend_pct}%)${flag}`
    );
  }
  return lines.join("\n");
}
