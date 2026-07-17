"use client";

import { useEffect, useMemo, useState } from "react";
import { LEAN5_PROGRAM } from "@/lib/seed/program";
import { EXERCISES, getExercise } from "@/lib/seed/exercises";
import { weeklyVolume, VOLUME_IDEAL_MIN, VOLUME_IDEAL_MAX, type VolumeSlot } from "@/lib/engine/volume";
import { epley1RM } from "@/lib/engine/oneRepMax";
import { MUSCLES, type Muscle } from "@/lib/engine/types";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import * as repo from "@/lib/db/repo";

export default function ProgressPage() {
  const [history, setHistory] = useState<repo.HistoryLog[]>([]);
  const [program, setProgram] = useState(LEAN5_PROGRAM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!hasSupabaseConfig()) return;
        const meso = await repo.getOrCreateActiveMesocycle(LEAN5_PROGRAM.name);
        setProgram(meso.program_json ?? LEAN5_PROGRAM);
        setHistory(await repo.getMesocycleHistory(meso.id));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Planned weekly volume (fractional) from the active program.
  const volume = useMemo(() => {
    const slots: VolumeSlot[] = program.days.flatMap((d) =>
      d.slots.map((s) => ({ sets: s.sets, exercise: EXERCISES[s.exercise_id] }))
    );
    return weeklyVolume(slots);
  }, [program]);

  // e1RM series per exercise from logged history (grouped by day).
  const series = useMemo(() => {
    const byEx: Record<string, { day: string; e1rm: number }[]> = {};
    for (const h of history) {
      if (!h.actual_weight || !h.actual_reps) continue;
      const key = h.exercise_id;
      const day = (h.date ?? h.created_at).slice(0, 10);
      const e = epley1RM(Number(h.actual_weight), Number(h.actual_reps));
      byEx[key] ??= [];
      const existing = byEx[key].find((p) => p.day === day);
      if (existing) existing.e1rm = Math.max(existing.e1rm, e);
      else byEx[key].push({ day, e1rm: e });
    }
    for (const k of Object.keys(byEx)) byEx[k].sort((a, b) => a.day.localeCompare(b.day));
    return byEx;
  }, [history]);

  const trackedExercises = Object.keys(series).filter((k) => series[k].length >= 1);

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <h1 className="text-2xl font-black">Progress</h1>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-ink-faint">
        Weekly sets / muscle
      </h2>
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="mb-3 text-xs text-ink-faint">
          Fractional sets (primary 1.0 + secondary 0.5). Shaded band = ideal {VOLUME_IDEAL_MIN}–{VOLUME_IDEAL_MAX}.
        </div>
        <div className="flex flex-col gap-2">
          {MUSCLES.filter((m) => volume[m] > 0).map((m) => (
            <VolumeBar key={m} muscle={m} sets={volume[m]} />
          ))}
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-ink-faint">
        Estimated 1RM (Epley)
      </h2>
      {loading ? (
        <div className="rounded-2xl bg-card p-6 text-center text-sm text-ink-faint shadow-sm">Loading…</div>
      ) : trackedExercises.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center text-sm text-ink-faint shadow-sm">
          No logged sets yet. Finish a session and your strength curves show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trackedExercises.map((exId) => (
            <div key={exId} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="mb-1 font-bold">{getExercise(exId)?.name ?? exId}</div>
              <Sparkline points={series[exId].map((p) => p.e1rm)} />
              <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
                <span>{series[exId][0]?.e1rm ? Math.round(series[exId][0].e1rm) : 0} lb</span>
                <span>{Math.round(series[exId][series[exId].length - 1].e1rm)} lb est.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VolumeBar({ muscle, sets }: { muscle: Muscle; sets: number }) {
  const max = 22;
  const pct = Math.min(100, (sets / max) * 100);
  const idealLo = (VOLUME_IDEAL_MIN / max) * 100;
  const idealHi = (VOLUME_IDEAL_MAX / max) * 100;
  const inRange = sets >= VOLUME_IDEAL_MIN && sets <= VOLUME_IDEAL_MAX;
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="capitalize text-ink-soft">{muscle.replace(/_/g, " ")}</span>
        <span className={`font-semibold ${inRange ? "text-[var(--green)]" : "text-ink-faint"}`}>{sets}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--neutral-bg)]">
        <div
          className="absolute inset-y-0 bg-[var(--green-bg)]"
          style={{ left: `${idealLo}%`, width: `${idealHi - idealLo}%` }}
        />
        <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const w = 300;
  const h = 60;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? w / 2 : i * step;
    const y = h - ((p - min) / range) * (h - 8) - 4;
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--ink)" />
      ))}
    </svg>
  );
}
