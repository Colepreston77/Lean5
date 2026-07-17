"use client";

import { useState } from "react";
import type { SlotView } from "@/lib/app/today";
import ProgressionChip from "./ProgressionChip";
import SetRow, { type LocalSet } from "./SetRow";
import { rirGuide } from "@/lib/app/rir";

export default function ExerciseCard({
  slot,
  sets,
  onSetChange,
  onToggleDone,
  onSwap,
  startExpanded,
}: {
  slot: SlotView;
  sets: LocalSet[];
  onSetChange: (setIndex: number, next: LocalSet) => void;
  onToggleDone: (setIndex: number) => void;
  onSwap: () => void;
  startExpanded?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(startExpanded));
  const doneCount = sets.filter((s) => s.done).length;
  const repRange = slot.reps_label ?? `${slot.reps_low}-${slot.reps_high}`;
  const weightStep = slot.exercise.weight_increment >= 5 ? 5 : 2.5;

  if (slot.is_cardio) {
    return (
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="font-bold">{slot.exercise.name}</div>
        <div className="mt-1 text-sm text-ink-soft">{repRange}</div>
        <div className="mt-1 text-xs text-ink-faint">{slot.exercise.cue_text}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold leading-tight">{slot.exercise.name}</span>
            {slot.is_substituted && (
              <span className="rounded bg-[var(--blue-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--blue)]">
                swapped
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm font-medium text-ink-soft">
            {slot.sets} × {repRange} · RIR {slot.rir_target}
          </div>
          {rirGuide(slot.rir_target) && (
            <div className="mt-1 text-xs leading-snug text-ink-soft">
              <span className="font-semibold text-ink">Effort:</span> {rirGuide(slot.rir_target)}
            </div>
          )}
          <div className="mt-1 text-xs leading-snug text-ink-faint">
            <span className="font-semibold">Tip:</span> {slot.exercise.cue_text}
          </div>
          <div className="mt-2">
            <ProgressionChip hint={slot.hint} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            role="button"
            tabIndex={0}
            aria-label="swap exercise"
            onClick={(e) => {
              e.stopPropagation();
              onSwap();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--neutral-bg)] text-ink-soft active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </span>
          <span className="text-[11px] font-semibold text-ink-faint">
            {doneCount}/{slot.sets}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-line px-2 pb-3 pt-2">
          {slot.ramp.length > 0 && (
            <div className="mb-2 rounded-xl bg-[var(--neutral-bg)] px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Ramp-up</div>
              {slot.ramp.map((r, i) => (
                <div key={i} className="text-xs text-ink-soft">
                  {Math.round(r.percent * 100)}%: {r.weight} × {r.reps}
                </div>
              ))}
            </div>
          )}
          {sets.map((s, i) => (
            <SetRow
              key={i}
              setNumber={i + 1}
              local={s}
              last={slot.lastSets.find((l) => l.set_number === i + 1) ?? slot.lastSets[i]}
              weightStep={weightStep}
              onChange={(next) => onSetChange(i, next)}
              onToggleDone={() => onToggleDone(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
