"use client";

import { useState } from "react";

// Big +/- stepper with an editable center value. Built for sweaty-hands mid-set
// use — large tap targets, tap the number to type.

export default function Stepper({
  value,
  onChange,
  step = 5,
  min = 0,
  unit,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  unit?: string;
  ariaLabel?: string;
}) {
  // Hold the raw text so partial entries like "2." or ".5" survive keystrokes —
  // a controlled number input would reparse and strip the trailing dot, making
  // fractional (0.5 lb) increments impossible to type.
  const [text, setText] = useState(value == null ? "" : String(value));

  // Adopt the numeric value when it changes for reasons other than typing here
  // (the +/- buttons, a reload). Adjusting state during render — per React's
  // "storing info from previous renders" pattern — keeps the current text if it
  // already represents that number, so "2." isn't clobbered mid-entry.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const cur = text.trim() === "" ? null : Number(text);
    if (cur !== value) setText(value == null ? "" : String(value));
  }

  function bump(delta: number) {
    const base = value ?? 0;
    const next = Math.max(min, Math.round((base + delta) * 100) / 100);
    onChange(next);
  }

  function handleText(raw: string) {
    setText(raw);
    const t = raw.trim();
    if (t === "") return onChange(null);
    const n = Number(t);
    // Ignore intermediate, not-yet-valid entries ("-", ".") — don't push NaN up.
    if (!Number.isNaN(n)) onChange(n);
  }

  return (
    <div className="flex w-full items-center gap-1.5">
      <button
        aria-label={`decrease ${ariaLabel ?? ""}`}
        onClick={() => bump(-step)}
        className="h-12 w-12 shrink-0 rounded-xl bg-[var(--neutral-bg)] text-2xl font-bold text-ink active:scale-90 transition-transform"
      >
        −
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          aria-label={ariaLabel}
          inputMode="decimal"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          placeholder="—"
          className="h-12 w-full rounded-xl border border-line bg-card text-center text-lg font-bold outline-none focus:border-ink"
        />
        {unit && value != null && (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-ink-faint">
            {unit}
          </span>
        )}
      </div>
      <button
        aria-label={`increase ${ariaLabel ?? ""}`}
        onClick={() => bump(step)}
        className="h-12 w-12 shrink-0 rounded-xl bg-[var(--neutral-bg)] text-2xl font-bold text-ink active:scale-90 transition-transform"
      >
        +
      </button>
    </div>
  );
}
