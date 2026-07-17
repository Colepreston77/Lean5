"use client";

import type { Exercise } from "@/lib/engine/types";
import { SWAP_LOCK_MESSAGE } from "@/lib/engine/swap";

export default function SwapSheet({
  current,
  candidates,
  swapCount,
  locked,
  onPick,
  onClose,
}: {
  current: Exercise;
  candidates: Exercise[];
  swapCount: number;
  locked: boolean;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[75vh] overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-1 text-lg font-bold">Swap exercise</div>
        <div className="mb-4 text-sm text-ink-soft">
          Replacing <span className="font-semibold text-ink">{current.name}</span> · same muscle, compatible movement
        </div>

        {locked ? (
          <div className="rounded-xl bg-[var(--yellow-bg)] p-4 text-center text-sm font-semibold text-[var(--yellow)]">
            {SWAP_LOCK_MESSAGE}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => onPick(ex)}
                  className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left active:bg-[var(--neutral-bg)]"
                >
                  <div>
                    <div className="font-semibold">{ex.name}</div>
                    <div className="text-xs text-ink-faint capitalize">
                      {ex.equipment.replace(/_/g, " ")} · {ex.movement_pattern.replace(/_/g, " ")}
                    </div>
                  </div>
                  <span className="text-ink-faint">→</span>
                </button>
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="py-6 text-center text-sm text-ink-faint">No alternatives in the library.</li>
            )}
          </ul>
        )}

        <div className="mt-3 text-center text-[11px] text-ink-faint">
          {swapCount}/3 swaps used this session · a swap persists for the mesocycle
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-[var(--neutral-bg)] py-3 font-semibold">
          Close
        </button>
      </div>
    </div>
  );
}
