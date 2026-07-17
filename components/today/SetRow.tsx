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
    <div className={`flex items-stretch gap-2 rounded-xl px-1 py-2 ${local.done ? "bg-[var(--green-bg)]/40" : ""}`}>
      <div className="flex w-5 shrink-0 items-center justify-center text-sm font-bold text-ink-soft">{setNumber}</div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Wt</span>
          <Stepper
            ariaLabel={`set ${setNumber} weight`}
            value={local.weight}
            step={weightStep}
            onChange={(w) => onChange({ ...local, weight: w })}
            unit="lb"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Reps</span>
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
        className={`flex w-14 shrink-0 items-center justify-center rounded-2xl border-2 transition-colors ${
          local.done ? "border-[var(--green)] bg-[var(--green)] text-white" : "border-line text-ink-faint"
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>
    </div>
  );
}
