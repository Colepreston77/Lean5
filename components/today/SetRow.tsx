"use client";

import Stepper from "./Stepper";
import type { LastSet } from "@/lib/app/today";

export interface LocalSet {
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export default function SetRow({
  setNumber,
  local,
  last,
  weightStep,
  onChange,
  onToggleDone,
}: {
  setNumber: number;
  local: LocalSet;
  last?: LastSet;
  weightStep: number;
  onChange: (next: LocalSet) => void;
  onToggleDone: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-2 ${local.done ? "bg-[var(--green-bg)]/40" : ""}`}>
      <div className="w-6 shrink-0 text-center text-sm font-bold text-ink-soft">{setNumber}</div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Stepper
            ariaLabel={`set ${setNumber} weight`}
            value={local.weight}
            step={weightStep}
            onChange={(w) => onChange({ ...local, weight: w })}
            unit="lb"
          />
          <span className="text-ink-faint">×</span>
          <Stepper
            ariaLabel={`set ${setNumber} reps`}
            value={local.reps}
            step={1}
            onChange={(r) => onChange({ ...local, reps: r })}
          />
        </div>
        <div className="pl-1 text-[11px] text-ink-faint">
          {last ? `last: ${last.weight} × ${last.reps}` : "first time — find your weight"}
        </div>
      </div>

      <button
        aria-label={`complete set ${setNumber}`}
        onClick={onToggleDone}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          local.done ? "border-[var(--green)] bg-[var(--green)] text-white" : "border-line text-transparent"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>
    </div>
  );
}
