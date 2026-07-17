"use client";

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
  function bump(delta: number) {
    const base = value ?? 0;
    const next = Math.max(min, Math.round((base + delta) * 100) / 100);
    onChange(next);
  }
  return (
    <div className="flex items-center gap-1">
      <button
        aria-label={`decrease ${ariaLabel ?? ""}`}
        onClick={() => bump(-step)}
        className="h-12 w-12 shrink-0 rounded-xl bg-[var(--neutral-bg)] text-2xl font-bold text-ink active:scale-90 transition-transform"
      >
        −
      </button>
      <div className="relative w-20">
        <input
          aria-label={ariaLabel}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(raw === "" ? null : Number(raw));
          }}
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
