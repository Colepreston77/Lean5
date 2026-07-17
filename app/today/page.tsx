"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEAN5_PROGRAM } from "@/lib/seed/program";
import { ALL_EXERCISES, getExercise } from "@/lib/seed/exercises";
import { schedulePosition } from "@/lib/engine/sequence";
import { isDeloadWeek } from "@/lib/engine/deload";
import { swapCandidates, swapsLocked } from "@/lib/engine/swap";
import { epley1RM } from "@/lib/engine/oneRepMax";
import { assembleDay, type DayView } from "@/lib/app/today";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import * as repo from "@/lib/db/repo";
import ExerciseCard from "@/components/today/ExerciseCard";
import SwapSheet from "@/components/today/SwapSheet";
import SessionComplete, { type SessionSummary } from "@/components/today/SessionComplete";
import type { LocalSet } from "@/components/today/SetRow";

type State = "loading" | "ready" | "error" | "meso_complete";

export default function TodayPage() {
  const [state, setState] = useState<State>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [model, setModel] = useState<DayView | null>(null);
  const [setsBySlot, setSetsBySlot] = useState<Record<string, LocalSet[]>>({});
  const [swapSlot, setSwapSlot] = useState<string | null>(null);
  const [swapCounts, setSwapCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const mesoRef = useRef<repo.MesocycleRow | null>(null);
  const sessionRef = useRef<repo.SessionRow | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      setState("loading");
      if (!hasSupabaseConfig()) {
        setErrMsg("Supabase isn't configured. Add your keys to .env.local.");
        return setState("error");
      }
      const meso = await repo.getOrCreateActiveMesocycle(LEAN5_PROGRAM.name);
      mesoRef.current = meso;

      const completed = await repo.getCompletedCount(meso.id);
      const pos = schedulePosition(completed, LEAN5_PROGRAM.days_per_week, meso.week_count);
      if (pos.mesocycleComplete) return setState("meso_complete");

      const week = pos.currentWeek;
      const dayOrder = pos.nextDayOrder;
      const isDeload = isDeloadWeek(week, meso.week_count);
      const day = LEAN5_PROGRAM.days[dayOrder - 1];

      const swapRows = await repo.getSwaps(meso.id);
      const swaps: Record<string, string> = {};
      for (const s of swapRows) swaps[s.slot_id] = s.to_exercise_id;

      const { cut_mode } = await repo.getSettings();

      const lastPairs = await Promise.all(
        day.slots.map(async (s) => [s.slot_id, await repo.getLastWorkingSets(meso.id, s.slot_id)] as const)
      );
      const lastSetsBySlot = Object.fromEntries(lastPairs);

      const dayView = assembleDay({ day, week, weekCount: meso.week_count, isDeload, cutMode: cut_mode, swaps, lastSetsBySlot });
      setModel(dayView);

      const session = await repo.getOrCreateSession(meso.id, dayOrder, week);
      sessionRef.current = session;
      const existing = await repo.getSetLogsForSession(session.id);

      // Seed local set state: target weight prefilled, reps blank unless logged.
      const initial: Record<string, LocalSet[]> = {};
      for (const g of dayView.groups) {
        for (const slot of g.slots) {
          if (slot.is_cardio) continue;
          const arr: LocalSet[] = [];
          for (let i = 0; i < slot.sets; i++) {
            const log = existing.find((e) => e.slot_id === slot.slot_id && e.set_number === i + 1);
            arr.push({
              weight: log?.actual_weight != null ? Number(log.actual_weight) : slot.target.targetWeight,
              reps: log?.actual_reps != null ? Number(log.actual_reps) : null,
              done: Boolean(log?.completed_at),
            });
          }
          initial[slot.slot_id] = arr;
        }
      }
      setSetsBySlot(initial);
      setState("ready");
    } catch (e) {
      console.error(e);
      setErrMsg(e instanceof Error ? e.message : "Something went wrong loading today.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function persist(slotId: string, exerciseId: string, i: number, s: LocalSet, done: boolean) {
    const session = sessionRef.current;
    const slot = model?.groups.flatMap((g) => g.slots).find((x) => x.slot_id === slotId);
    if (!session || !slot) return;
    const key = `${slotId}:${i}`;
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      repo
        .saveSetLog({
          session_id: session.id,
          slot_id: slotId,
          exercise_id: exerciseId,
          set_number: i + 1,
          target_reps_low: slot.reps_low,
          target_reps_high: slot.reps_high,
          target_weight: slot.target.targetWeight,
          actual_weight: s.weight,
          actual_reps: s.reps,
          is_warmup: false,
          completed: done,
        })
        .catch((e) => console.error("save failed", e));
    }, 500);
  }

  function updateSet(slotId: string, exerciseId: string, i: number, next: LocalSet) {
    setSetsBySlot((prev) => {
      const arr = [...(prev[slotId] ?? [])];
      arr[i] = next;
      return { ...prev, [slotId]: arr };
    });
    persist(slotId, exerciseId, i, next, next.done);
  }

  function toggleDone(slotId: string, exerciseId: string, i: number) {
    setSetsBySlot((prev) => {
      const arr = [...(prev[slotId] ?? [])];
      const cur = arr[i];
      const next = { ...cur, done: !cur.done };
      arr[i] = next;
      persist(slotId, exerciseId, i, next, next.done);
      return { ...prev, [slotId]: arr };
    });
  }

  async function doSwap(ex: (typeof ALL_EXERCISES)[number]) {
    const meso = mesoRef.current;
    const slotId = swapSlot;
    if (!meso || !slotId || !model) return;
    const slot = model.groups.flatMap((g) => g.slots).find((x) => x.slot_id === slotId);
    if (!slot) return;
    try {
      await repo.recordSwap({
        mesocycle_id: meso.id,
        slot_id: slotId,
        from_exercise_id: slot.exercise.id,
        to_exercise_id: ex.id,
      });
      setSwapCounts((c) => ({ ...c, [slotId]: (c[slotId] ?? 0) + 1 }));
      setSwapSlot(null);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function finish() {
    const session = sessionRef.current;
    const meso = mesoRef.current;
    if (!session || !meso || !model) return;

    let totalVolume = 0;
    let setsDone = 0;
    const prs: SessionSummary["prs"] = [];
    for (const g of model.groups) {
      for (const slot of g.slots) {
        if (slot.is_cardio) continue;
        const arr = setsBySlot[slot.slot_id] ?? [];
        let bestE = 0;
        let bestSet: LocalSet | null = null;
        for (const s of arr) {
          if (s.done && s.weight && s.reps) {
            totalVolume += s.weight * s.reps;
            setsDone += 1;
            const e = epley1RM(s.weight, s.reps);
            if (e > bestE) {
              bestE = e;
              bestSet = s;
            }
          }
        }
        const priorBest = Math.max(0, ...slot.lastSets.map((l) => epley1RM(l.weight, l.reps)));
        if (bestSet && bestE > priorBest && priorBest > 0) {
          prs.push({ name: slot.exercise.name, weight: bestSet.weight!, reps: bestSet.reps! });
        }
      }
    }

    const start = new Date(session.created_at ?? Date.now()).getTime();
    const durationSeconds = Math.max(60, Math.round((Date.now() - start) / 1000));
    await repo.completeSession(session.id, durationSeconds);

    const newCompleted = (await repo.getCompletedCount(meso.id));
    const pos = schedulePosition(newCompleted, LEAN5_PROGRAM.days_per_week, meso.week_count);
    await repo.setMesocycleWeek(meso.id, pos.currentWeek);
    if (pos.mesocycleComplete) await repo.completeMesocycle(meso.id);

    setSummary({ totalVolume, setsDone, durationSeconds, prs });
  }

  // ---- render ----
  if (state === "loading") return <CenterMsg>Loading today…</CenterMsg>;

  if (state === "error")
    return (
      <CenterMsg>
        <div className="mb-2 font-bold">Couldn&apos;t load</div>
        <div className="max-w-xs text-sm text-ink-soft">{errMsg}</div>
        <button onClick={load} className="mt-4 rounded-xl bg-ink px-5 py-2.5 font-semibold text-white">
          Retry
        </button>
      </CenterMsg>
    );

  if (state === "meso_complete")
    return (
      <CenterMsg>
        <div className="mb-2 text-xl font-black">Mesocycle complete 🎉</div>
        <div className="max-w-xs text-sm text-ink-soft">Time to generate your next block.</div>
        <Link href="/program" className="mt-4 rounded-xl bg-ink px-5 py-2.5 font-semibold text-white">
          Go to Program
        </Link>
      </CenterMsg>
    );

  if (!model) return null;

  const swapSlotView = swapSlot ? model.groups.flatMap((g) => g.slots).find((s) => s.slot_id === swapSlot) : null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <Header model={model} />

      <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
        <div className="text-sm font-bold uppercase tracking-wide text-ink-faint">Warm-up</div>
        <div className="mt-1 text-sm text-ink-soft">{model.warmupText}</div>
      </div>

      {model.groups.map((group) => (
        <section key={group.group} className="mt-5">
          {group.group !== "Conditioning" && (
            <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-faint">
              Group {group.group}
            </div>
          )}
          {group.group === "Conditioning" && (
            <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-faint">Conditioning</div>
          )}
          <div className="flex flex-col gap-3">
            {group.slots.map((slot, idx) => (
              <ExerciseCard
                key={slot.slot_id}
                slot={slot}
                sets={setsBySlot[slot.slot_id] ?? []}
                startExpanded={group.group === "A" && idx === 0}
                onSetChange={(i, next) => updateSet(slot.slot_id, slot.exercise.id, i, next)}
                onToggleDone={(i) => toggleDone(slot.slot_id, slot.exercise.id, i)}
                onSwap={() => setSwapSlot(slot.slot_id)}
              />
            ))}
          </div>
        </section>
      ))}

      <button
        onClick={finish}
        className="mt-8 w-full rounded-2xl bg-ink py-4 text-lg font-bold text-white active:scale-95 transition-transform"
      >
        Finish session
      </button>

      {swapSlotView && (
        <SwapSheet
          current={swapSlotView.exercise}
          candidates={swapCandidates(swapSlotView.exercise, ALL_EXERCISES)}
          swapCount={swapCounts[swapSlotView.slot_id] ?? 0}
          locked={swapsLocked(swapCounts[swapSlotView.slot_id] ?? 0)}
          onPick={doSwap}
          onClose={() => setSwapSlot(null)}
        />
      )}

      {summary && (
        <SessionComplete
          summary={summary}
          dayName={model.name}
          onDone={() => {
            setSummary(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Header({ model }: { model: DayView }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return (
    <header>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-faint">{today}</span>
        <div className="flex items-center gap-2">
          {model.isDeload ? (
            <Badge className="bg-[var(--blue-bg)] text-[var(--blue)]">DELOAD WEEK</Badge>
          ) : (
            <Badge className="bg-[var(--neutral-bg)] text-ink-soft">
              Week {model.week} of 4
            </Badge>
          )}
          {model.cutMode && !model.isDeload && <Badge className="bg-[var(--yellow-bg)] text-[var(--yellow)]">CUT</Badge>}
        </div>
      </div>
      <h1 className="mt-1 text-2xl font-black leading-tight">{model.name}</h1>
      {model.cutMode && !model.isDeload && (
        <p className="mt-1 text-xs text-ink-faint">Cut mode on — last exercise trimmed one set.</p>
      )}
    </header>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}>{children}</span>;
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center px-8 pt-24 text-center">{children}</div>;
}
