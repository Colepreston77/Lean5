"use client";

import { useEffect, useState } from "react";
import { LEAN5_PROGRAM } from "@/lib/seed/program";
import { getExercise } from "@/lib/seed/exercises";
import { isDeloadWeek, weeklySlotSets, DELOAD_RIR } from "@/lib/engine/deload";
import { auditWeek, type WeekPlan, type AuditDay, type AuditSlot, type AuditResult } from "@/lib/engine/audit";
import { schedulePosition } from "@/lib/engine/sequence";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import * as repo from "@/lib/db/repo";
import type { Program } from "@/lib/engine/types";
import NextBlock from "@/components/program/NextBlock";

// Build an audit WeekPlan for a given week (cold-start style: null targets ok).
function buildPlan(program: Program, week: number, weekCount: number): WeekPlan {
  const isDeload = isDeloadWeek(week, weekCount);
  const days: AuditDay[] = program.days.map((day) => {
    const slots: AuditSlot[] = day.slots.map((slot) => {
      const ex = getExercise(slot.exercise_id)!;
      const sets = ex.primary_muscle === "cardio"
        ? slot.sets
        : weeklySlotSets(slot.sets, week, weekCount, Boolean(slot.ramp));
      return {
        slot_id: slot.slot_id,
        exercise: ex,
        slot_primary_muscle: ex.primary_muscle,
        sets,
        reps_low: slot.reps_low,
        reps_high: slot.reps_high,
        rir_target: isDeload && ex.primary_muscle !== "cardio" ? DELOAD_RIR : slot.rir_target,
        rest_seconds: ex.rest_seconds,
        increment: ex.weight_increment,
        target_weight: null,
        cold_start: true,
      };
    });
    return { day_order: day.day_order, name: day.name, is_lower_body: /lower/i.test(day.name), slots };
  });
  return { week, is_deload: isDeload, days };
}

export default function ProgramPage() {
  const [week, setWeek] = useState(1);
  const [weekCount, setWeekCount] = useState(4);
  const [complete, setComplete] = useState(false);
  const [cutMode, setCutMode] = useState(true);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [program, setProgram] = useState<Program>(LEAN5_PROGRAM);
  const [mesoId, setMesoId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      if (!hasSupabaseConfig()) return;
      try {
        const meso = await repo.getOrCreateActiveMesocycle(LEAN5_PROGRAM.name);
        const prog = meso.program_json ?? LEAN5_PROGRAM;
        setProgram(prog);
        setMesoId(meso.id);
        setWeekCount(meso.week_count);
        const completed = await repo.getCompletedCount(meso.id);
        const pos = schedulePosition(completed, prog.days_per_week, meso.week_count);
        setWeek(pos.currentWeek);
        setComplete(pos.mesocycleComplete);
        const s = await repo.getSettings();
        setCutMode(s.cut_mode);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [reloadKey]);

  const deloadNow = isDeloadWeek(week, weekCount);

  function runAudit() {
    setAudit(auditWeek(buildPlan(program, week, weekCount)));
  }

  async function toggleCut() {
    const next = !cutMode;
    setCutMode(next);
    try {
      await repo.setCutMode(next);
    } catch (e) {
      console.error(e);
    }
  }

  async function exportCsv() {
    setBusy(true);
    try {
      const rows = await repo.getExportRows();
      const header = ["date", "week", "workout", "exercise", "set_number", "weight", "reps", "target_low", "target_high", "target_weight"];
      const lines = [header.join(",")];
      for (const r of rows) {
        const workout = LEAN5_PROGRAM.days[r.program_day_order - 1]?.name ?? `Day ${r.program_day_order}`;
        const exercise = getExercise(r.exercise_id)?.name ?? r.exercise_id;
        lines.push(
          [
            r.date ?? "",
            r.week,
            `"${workout}"`,
            `"${exercise}"`,
            r.set_number,
            r.actual_weight ?? "",
            r.actual_reps ?? "",
            r.target_reps_low ?? "",
            r.target_reps_high ?? "",
            r.target_weight ?? "",
          ].join(",")
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lean5-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed — is the database seeded?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <h1 className="text-2xl font-black">{program.name}</h1>
      <p className="text-sm text-ink-faint">
        {program.days_per_week} days/week ·{" "}
        {complete ? "mesocycle complete" : deloadNow ? "deload week" : `week ${week} of ${weekCount}`}
      </p>

      {/* Next block — AI review + import (prominent when the block is done) */}
      {mesoId && (
        <div className="mt-4">
          {complete && (
            <div className="mb-2 rounded-xl bg-[var(--green-bg)] px-3 py-2 text-sm font-bold text-[var(--green)]">
              Block complete — review it and start the next one.
            </div>
          )}
          <NextBlock
            currentProgram={program}
            mesocycleId={mesoId}
            weekCount={weekCount}
            onApplied={() => setReloadKey((k) => k + 1)}
          />
        </div>
      )}

      {/* Audit gate */}
      <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold">Plan check</div>
            <div className="text-xs text-ink-faint">Every plan runs through the audit gate before it publishes.</div>
          </div>
          <button onClick={runAudit} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">
            Run
          </button>
        </div>
        {audit && <PlanReview result={audit} />}
      </div>

      {/* Structure */}
      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-ink-faint">Structure</h2>
      <div className="flex flex-col gap-2">
        {program.days.map((day) => (
          <div key={day.day_order} className="overflow-hidden rounded-2xl bg-card shadow-sm">
            <button
              onClick={() => setOpenDay((o) => (o === day.day_order ? null : day.day_order))}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="font-bold">{day.name}</span>
              <span className="text-ink-faint">{openDay === day.day_order ? "−" : "+"}</span>
            </button>
            {openDay === day.day_order && (
              <ul className="border-t border-line px-4 py-2">
                {day.slots.map((s) => {
                  const ex = getExercise(s.exercise_id)!;
                  return (
                    <li key={s.slot_id} className="flex justify-between py-1.5 text-sm">
                      <span className="text-ink">{ex.name}</span>
                      <span className="text-ink-soft">
                        {s.sets} × {s.reps_label ?? `${s.reps_low}-${s.reps_high}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Settings */}
      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-ink-faint">Settings</h2>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
          <div>
            <div className="font-semibold">Cut mode</div>
            <div className="text-xs text-ink-faint">Trims one set from the last exercise each day.</div>
          </div>
          <button
            onClick={toggleCut}
            className={`relative h-7 w-12 rounded-full transition-colors ${cutMode ? "bg-ink" : "bg-line"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${cutMode ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        <button
          onClick={exportCsv}
          disabled={busy}
          className="flex items-center justify-between rounded-2xl bg-card p-4 text-left shadow-sm disabled:opacity-50"
        >
          <div>
            <div className="font-semibold">Export data (CSV)</div>
            <div className="text-xs text-ink-faint">All set logs. Your history is never trapped in the app.</div>
          </div>
          <span className="text-ink-faint">↓</span>
        </button>

      </div>

      <div className="h-6" />
    </div>
  );
}

function PlanReview({ result }: { result: AuditResult }) {
  return (
    <div className="mt-3">
      <div
        className={`mb-2 rounded-xl px-3 py-2 text-sm font-bold ${
          result.passed ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--yellow-bg)] text-[var(--yellow)]"
        }`}
      >
        {result.passed ? "✓ Plan passes — safe to publish" : `${result.errors.length} issue(s) block publishing`}
      </div>
      <ul className="flex flex-col gap-1">
        {result.checks
          .filter((c) => !c.passed)
          .map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              <span className={c.severity === "error" ? "text-red-600" : "text-[var(--yellow)]"}>
                {c.severity === "error" ? "✕" : "!"}
              </span>
              <span className="text-ink-soft">{c.detail}</span>
            </li>
          ))}
        {result.checks.every((c) => c.passed) && (
          <li className="text-xs text-ink-faint">
            All {result.checks.length} invariants pass: required fields, weight jumps, deload floor, deload integrity,
            lower-body spacing, substitution match, session size, weekly volume.
          </li>
        )}
      </ul>
    </div>
  );
}
