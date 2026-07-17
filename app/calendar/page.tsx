"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEAN5_PROGRAM } from "@/lib/seed/program";
import { schedulePosition } from "@/lib/engine/sequence";
import { isDeloadWeek } from "@/lib/engine/deload";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import * as repo from "@/lib/db/repo";
import type { Program } from "@/lib/engine/types";

interface DayCell {
  week: number;
  dayOrder: number;
  name: string;
  status: "completed" | "current" | "upcoming";
}

export default function CalendarPage() {
  const router = useRouter();
  const [cells, setCells] = useState<DayCell[]>([]);
  const [weekCount, setWeekCount] = useState(4);
  const [, setProgram] = useState<Program>(LEAN5_PROGRAM);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  function openDay(week: number, dayOrder: number) {
    router.push(`/today?week=${week}&day=${dayOrder}`);
  }

  useEffect(() => {
    (async () => {
      try {
        if (!hasSupabaseConfig()) throw new Error("Supabase not configured.");
        const meso = await repo.getOrCreateActiveMesocycle(LEAN5_PROGRAM.name);
        const prog = meso.program_json ?? LEAN5_PROGRAM;
        setProgram(prog);
        setWeekCount(meso.week_count);
        const completed = await repo.getCompletedCount(meso.id);
        const pos = schedulePosition(completed, prog.days_per_week, meso.week_count);

        const list: DayCell[] = [];
        let seq = 0;
        for (let w = 1; w <= meso.week_count; w++) {
          for (let d = 1; d <= prog.days_per_week; d++) {
            const isDone = seq < completed;
            const isCurrent = w === pos.currentWeek && d === pos.nextDayOrder && !pos.mesocycleComplete;
            list.push({
              week: w,
              dayOrder: d,
              name: prog.days[d - 1].name,
              status: isDone ? "completed" : isCurrent ? "current" : "upcoming",
            });
            seq++;
          }
        }
        setCells(list);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Center>Loading calendar…</Center>;
  if (err) return <Center>{err}</Center>;

  const byWeek = Array.from({ length: weekCount }, (_, i) =>
    cells.filter((c) => c.week === i + 1)
  );

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <h1 className="text-2xl font-black">Calendar</h1>
      <p className="mb-4 text-sm text-ink-faint">
        Workouts run in sequence — the actual day doesn&apos;t matter. Tap any day to open and log it.
      </p>

      {byWeek.map((week, i) => {
        const deload = isDeloadWeek(i + 1, weekCount);
        return (
          <section key={i} className="mb-5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">Week {i + 1}</span>
              {deload && <span className="rounded-full bg-[var(--blue-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--blue)]">DELOAD</span>}
            </div>
            <div className="flex flex-col gap-2">
              {week.map((c) => (
                <button
                  key={`${c.week}-${c.dayOrder}`}
                  onClick={() => openDay(c.week, c.dayOrder)}
                  className={`flex items-center justify-between rounded-2xl border p-3 text-left ${
                    c.status === "current"
                      ? "border-ink bg-card shadow-sm"
                      : c.status === "completed"
                      ? "border-transparent bg-card/60"
                      : "border-transparent bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={c.status} />
                    <div>
                      <div className={`text-sm font-bold ${c.status === "completed" ? "text-ink-soft" : "text-ink"}`}>
                        {c.name}
                      </div>
                      <div className="text-[11px] text-ink-faint capitalize">{c.status}</div>
                    </div>
                  </div>
                  <span className="text-ink-faint">›</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: DayCell["status"] }) {
  const cls =
    status === "completed"
      ? "bg-[var(--green)]"
      : status === "current"
      ? "bg-ink"
      : "bg-line";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-8 pt-24 text-center text-ink-soft">{children}</div>;
}
