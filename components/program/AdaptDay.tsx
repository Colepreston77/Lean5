"use client";

import { useEffect, useState } from "react";
import type { Program } from "@/lib/engine/types";
import { getExercise } from "@/lib/seed/exercises";
import { currentDaySlots, type DayAdaptChange, type DayAdaptResult } from "@/lib/ai/adaptDay";
import * as repo from "@/lib/db/repo";

// Adapt ONE day to a constraint (injury/equipment) via AI exercise swaps. Keeps
// sets/reps/structure; persists as swaps for the rest of the block; reversible.

export default function AdaptDay({
  currentProgram,
  mesocycleId,
  onApplied,
}: {
  currentProgram: Program;
  mesocycleId: string;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dayOrder, setDayOrder] = useState(currentProgram.days[0]?.day_order ?? 1);
  const [constraint, setConstraint] = useState("");
  const [busy, setBusy] = useState<null | "ai" | "apply" | "revert">(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DayAdaptResult | null>(null);
  const [swaps, setSwaps] = useState<Record<string, string>>({});

  const day = currentProgram.days.find((d) => d.day_order === dayOrder) ?? currentProgram.days[0];

  useEffect(() => {
    (async () => {
      try {
        const rows = await repo.getSwaps(mesocycleId);
        const map: Record<string, string> = {};
        for (const r of rows) map[r.slot_id] = r.to_exercise_id;
        setSwaps(map);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [mesocycleId]);

  // Slots this day currently resolves to (base program + any existing swaps).
  const hasSwapOnDay = day.slots.some((s) => swaps[s.slot_id]);

  async function adapt() {
    if (!day) return;
    setError("");
    setResult(null);
    setBusy("ai");
    try {
      const slots = currentDaySlots(day, swaps);
      const res = await fetch("/api/adapt-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayName: day.name, slots, constraint: constraint.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Adaptation failed.");
        return;
      }
      setResult(data as DayAdaptResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adaptation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!result?.ok || result.changes.length === 0) return;
    setBusy("apply");
    try {
      await repo.applyDaySwaps(
        mesocycleId,
        result.changes.map((c) => ({
          slot_id: c.slot_id,
          from_exercise_id: c.from_exercise_id,
          to_exercise_id: c.to_exercise_id,
        }))
      );
      const rows = await repo.getSwaps(mesocycleId);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.slot_id] = r.to_exercise_id;
      setSwaps(map);
      setResult(null);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply the changes.");
    } finally {
      setBusy(null);
    }
  }

  async function revert() {
    if (!day) return;
    setBusy("revert");
    try {
      for (const s of day.slots) if (swaps[s.slot_id]) await repo.clearSwapsForSlot(mesocycleId, s.slot_id);
      const rows = await repo.getSwaps(mesocycleId);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.slot_id] = r.to_exercise_id;
      setSwaps(map);
      setResult(null);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't revert.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <div>
          <div className="font-bold">Adapt a day for an injury or constraint</div>
          <div className="mt-0.5 text-xs text-ink-faint">
            Keep the day you like — AI swaps only the exercises that conflict (e.g. easy on a sprained ankle).
          </div>
        </div>
        <span className="ml-2 text-ink-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <label className="block text-xs font-semibold text-ink-soft">Which day</label>
          <select
            value={dayOrder}
            onChange={(e) => {
              setDayOrder(Number(e.target.value));
              setResult(null);
              setError("");
            }}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-ink"
          >
            {currentProgram.days.map((d) => (
              <option key={d.day_order} value={d.day_order}>
                {d.name}
              </option>
            ))}
          </select>

          {hasSwapOnDay && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--blue-bg)] px-3 py-2 text-xs text-[var(--blue)]">
              <span>This day has active swaps.</span>
              <button onClick={revert} disabled={busy !== null} className="font-bold underline disabled:opacity-50">
                {busy === "revert" ? "Reverting…" : "Revert to original"}
              </button>
            </div>
          )}

          <label className="mt-3 block text-xs font-semibold text-ink-soft">Constraint</label>
          <textarea
            value={constraint}
            onChange={(e) => setConstraint(e.target.value)}
            rows={2}
            placeholder="e.g. recovering from an ankle sprain — keep it as close as possible but easy on the ankle"
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-ink"
          />

          <button
            onClick={adapt}
            disabled={busy !== null || !constraint.trim()}
            className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "ai" ? "Adapting…" : "Adapt with AI"}
          </button>

          {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {result && <AdaptResultView result={result} onApply={apply} applying={busy === "apply"} />}
        </div>
      )}
    </div>
  );
}

function AdaptResultView({
  result,
  onApply,
  applying,
}: {
  result: DayAdaptResult;
  onApply: () => void;
  applying: boolean;
}) {
  const noChanges = result.ok && result.changes.length === 0;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div
        className={`mb-2 rounded-xl px-3 py-2 text-sm font-bold ${
          result.ok ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--yellow-bg)] text-[var(--yellow)]"
        }`}
      >
        {noChanges
          ? "Nothing needs changing for this constraint"
          : result.ok
            ? `✓ ${result.changes.length} swap${result.changes.length === 1 ? "" : "s"} — same muscles, easier on the joint`
            : "Blocked — the model returned invalid swaps"}
      </div>

      {result.rationale && <p className="mb-3 text-sm text-ink-soft">{result.rationale}</p>}

      {result.errors.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1">
          {result.errors.map((d, i) => (
            <li key={i} className="text-xs text-red-700">• {d}</li>
          ))}
        </ul>
      )}

      {result.changes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {result.changes.map((c: DayAdaptChange) => (
            <li key={c.slot_id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="text-ink-faint line-through">{c.from_name}</span>
                <span className="text-ink-faint">→</span>
                <span className="font-semibold">{c.to_name}</span>
              </div>
              <div className="text-xs text-ink-soft">
                {c.reason}
                {c.equipment_changed && (
                  <span className="ml-1 rounded bg-[var(--neutral-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                    {getExercise(c.to_exercise_id)?.equipment}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!noChanges && (
        <button
          onClick={onApply}
          disabled={!result.ok || applying}
          className="mt-4 w-full rounded-xl bg-ink py-3 font-bold text-white disabled:opacity-40"
        >
          {applying ? "Applying…" : "Apply to this day"}
        </button>
      )}
    </div>
  );
}
