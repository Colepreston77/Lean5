"use client";

export interface SessionSummary {
  totalVolume: number;
  setsDone: number;
  durationSeconds: number;
  prs: { name: string; weight: number; reps: number }[];
}

function fmtDuration(s: number): string {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function SessionComplete({
  summary,
  dayName,
  onDone,
}: {
  summary: SessionSummary;
  dayName: string;
  onDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg px-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--green)] text-white">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-2xl font-black">Session complete</div>
        <div className="text-ink-soft">{dayName}</div>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        <Stat label="Volume" value={`${Math.round(summary.totalVolume).toLocaleString()}`} unit="lb" />
        <Stat label="Sets" value={`${summary.setsDone}`} />
        <Stat label="Time" value={fmtDuration(summary.durationSeconds)} />
      </div>

      {summary.prs.length > 0 && (
        <div className="w-full max-w-xs rounded-2xl bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-[var(--green)]">🏆 New PRs</div>
          {summary.prs.map((pr, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-ink-soft">{pr.name}</span>
              <span className="font-semibold">{pr.weight} × {pr.reps}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onDone} className="w-full max-w-xs rounded-2xl bg-ink py-4 font-bold text-white active:scale-95 transition-transform">
        Done
      </button>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-sm">
      <div className="text-lg font-black leading-tight">
        {value}
        {unit && <span className="text-xs font-medium text-ink-faint"> {unit}</span>}
      </div>
      <div className="text-[11px] font-medium text-ink-faint">{label}</div>
    </div>
  );
}
