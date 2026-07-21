"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { Program } from "@/lib/engine/types";
import { LEAN5_PROGRAM } from "@/lib/seed/program";

// Data-access layer for the dynamic training data. Program + exercise
// definitions come from lib/seed (code), everything here is per-user history.

export interface MesocycleRow {
  id: string;
  program_name: string;
  start_date: string;
  week_count: number;
  current_week: number;
  status: string;
  program_json: Program | null;
  goal: string | null;
}

export interface SessionRow {
  id: string;
  mesocycle_id: string;
  program_day_order: number;
  week: number;
  date: string | null;
  status: string;
  started_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export interface SetLogRow {
  id: string;
  session_id: string;
  slot_id: string;
  exercise_id: string;
  set_number: number;
  target_reps_low: number | null;
  target_reps_high: number | null;
  target_weight: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  is_warmup: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface SwapRow {
  id: string;
  mesocycle_id: string;
  slot_id: string;
  from_exercise_id: string;
  to_exercise_id: string;
  created_at: string;
}

// --- Mesocycle ---------------------------------------------------------------

export async function getActiveMesocycle(): Promise<MesocycleRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mesocycles")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createMesocycle(
  programName: string,
  weekCount = 4,
  programJson: Program | null = null,
  goal: string | null = null
): Promise<MesocycleRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("mesocycles")
    .insert({
      program_name: programName,
      week_count: weekCount,
      current_week: 1,
      status: "active",
      program_json: programJson,
      goal,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getOrCreateActiveMesocycle(programName: string): Promise<MesocycleRow> {
  return (await getActiveMesocycle()) ?? (await createMesocycle(programName));
}

/** The Program driving the active mesocycle — its stored program_json, or the default. */
export async function getActiveProgram(): Promise<Program> {
  const meso = await getActiveMesocycle();
  return meso?.program_json ?? LEAN5_PROGRAM;
}

/**
 * Start a new block from a validated program: mark the current mesocycle complete
 * and create a fresh active one carrying the new program_json + goal.
 */
export async function startNextMesocycle(program: Program, goal: string | null, weekCount = 4): Promise<MesocycleRow> {
  const current = await getActiveMesocycle();
  if (current) await completeMesocycle(current.id);
  return createMesocycle(program.name, weekCount, program, goal);
}

export async function setMesocycleWeek(id: string, week: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("mesocycles").update({ current_week: week }).eq("id", id);
  if (error) throw error;
}

export async function completeMesocycle(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("mesocycles").update({ status: "completed" }).eq("id", id);
  if (error) throw error;
}

// --- Sessions ----------------------------------------------------------------

export async function getSessions(mesocycleId: string): Promise<SessionRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .eq("mesocycle_id", mesocycleId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCompletedCount(mesocycleId: string): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("mesocycle_id", mesocycleId)
    .eq("status", "completed");
  if (error) throw error;
  return count ?? 0;
}

/** Find the current in-progress/pending session for a day, or create one. */
export async function getOrCreateSession(
  mesocycleId: string,
  dayOrder: number,
  week: number
): Promise<SessionRow> {
  const sb = getSupabase();
  const { data: existing } = await sb
    .from("sessions")
    .select("*")
    .eq("mesocycle_id", mesocycleId)
    .eq("program_day_order", dayOrder)
    .eq("week", week)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await sb
    .from("sessions")
    .insert({
      mesocycle_id: mesocycleId,
      program_day_order: dayOrder,
      week,
      status: "pending",
      date: new Date().toISOString().slice(0, 10),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Mark a pending session as started — stamps the timer origin (started_at). */
export async function startSession(id: string): Promise<SessionRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("sessions")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeSession(id: string, durationSeconds: number, notes?: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("sessions")
    .update({ status: "completed", duration_seconds: durationSeconds, notes: notes ?? null })
    .eq("id", id);
  if (error) throw error;
}

// --- Set logs ----------------------------------------------------------------

export async function getSetLogsForSession(sessionId: string): Promise<SetLogRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("set_logs").select("*").eq("session_id", sessionId);
  if (error) throw error;
  const rows = data ?? [];

  // Defensive de-dupe: legacy rows (pre unique-index) may hold several copies of
  // the same set, some captured mid-entry with actual_reps null. Keep the best
  // row per (slot_id, set_number): a reps-bearing row wins, then the most recently
  // completed, then the newest. Prevents .find() picking a blank-reps duplicate.
  const best = new Map<string, SetLogRow>();
  for (const r of rows) {
    const key = `${r.slot_id}:${r.set_number}`;
    const cur = best.get(key);
    if (!cur || isBetterSetLog(r, cur)) best.set(key, r);
  }
  return [...best.values()];
}

function isBetterSetLog(a: SetLogRow, b: SetLogRow): boolean {
  const aReps = a.actual_reps != null, bReps = b.actual_reps != null;
  if (aReps !== bReps) return aReps; // reps-bearing beats blank
  const ac = a.completed_at ?? "", bc = b.completed_at ?? "";
  if (ac !== bc) return ac > bc; // more recently completed
  return (a.created_at ?? "") > (b.created_at ?? ""); // newest
}

/**
 * Most recent COMPLETED working sets for a slot, before `beforeSessionId` if given.
 * Returns the sets from the single latest session that logged this slot.
 */
export async function getLastWorkingSets(
  mesocycleId: string,
  slotId: string
): Promise<{ weight: number; reps: number; set_number: number }[]> {
  const sb = getSupabase();
  // sessions for this meso, newest first
  const { data: sessions } = await sb
    .from("sessions")
    .select("id")
    .eq("mesocycle_id", mesocycleId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  if (!sessions?.length) return [];

  for (const s of sessions) {
    const { data: logs } = await sb
      .from("set_logs")
      .select("actual_weight, actual_reps, set_number")
      .eq("session_id", s.id)
      .eq("slot_id", slotId)
      .eq("is_warmup", false)
      .not("actual_reps", "is", null)
      .order("set_number", { ascending: true });
    if (logs && logs.length) {
      return logs
        .filter((l) => l.actual_weight != null && l.actual_reps != null)
        .map((l) => ({ weight: Number(l.actual_weight), reps: Number(l.actual_reps), set_number: l.set_number }));
    }
  }
  return [];
}

/** Upsert a single set log (by session + slot + set_number). */
export async function saveSetLog(row: {
  session_id: string;
  slot_id: string;
  exercise_id: string;
  set_number: number;
  target_reps_low: number | null;
  target_reps_high: number | null;
  target_weight: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  is_warmup: boolean;
  completed: boolean;
}): Promise<void> {
  const sb = getSupabase();
  const payload = {
    session_id: row.session_id,
    slot_id: row.slot_id,
    exercise_id: row.exercise_id,
    set_number: row.set_number,
    target_reps_low: row.target_reps_low,
    target_reps_high: row.target_reps_high,
    target_weight: row.target_weight,
    actual_weight: row.actual_weight,
    actual_reps: row.actual_reps,
    is_warmup: row.is_warmup,
    completed_at: row.completed ? new Date().toISOString() : null,
  };

  // Atomic upsert keyed on the natural set identity. The prior select-then-
  // insert/update raced under rapid debounced+flushed saves: parallel calls all
  // ran their existence check before any insert committed, so each inserted a
  // duplicate row (some captured mid-entry with actual_reps still null). The
  // unique index on (session_id, slot_id, set_number) — see schema.sql — makes
  // this a single write that can only ever touch one row.
  const { error } = await sb
    .from("set_logs")
    .upsert(payload, { onConflict: "session_id,slot_id,set_number" });
  if (!error) return;

  // Fallback for installs that haven't applied the unique-index migration yet
  // (Postgres 42P10: "no unique constraint matching ON CONFLICT"). Preserves the
  // legacy select-then-write so saving never breaks in the deploy→migrate window.
  if (error.code !== "42P10") throw error;
  const { data: existing } = await sb
    .from("set_logs")
    .select("id")
    .eq("session_id", row.session_id)
    .eq("slot_id", row.slot_id)
    .eq("set_number", row.set_number)
    .order("actual_reps", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const { error: e } = await sb.from("set_logs").update(payload).eq("id", existing.id);
    if (e) throw e;
  } else {
    const { error: e } = await sb.from("set_logs").insert(payload);
    if (e) throw e;
  }
}

export interface HistoryLog {
  exercise_id: string;
  slot_id: string;
  actual_weight: number | null;
  actual_reps: number | null;
  date: string | null;
  created_at: string;
}

/** All completed working-set logs for a mesocycle, with their session date. */
export async function getMesocycleHistory(mesocycleId: string): Promise<HistoryLog[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("set_logs")
    .select("exercise_id, slot_id, actual_weight, actual_reps, created_at, sessions!inner(mesocycle_id, date, status)")
    .eq("sessions.mesocycle_id", mesocycleId)
    .eq("sessions.status", "completed")
    .eq("is_warmup", false)
    .not("actual_reps", "is", null);
  if (error) throw error;
  type Row = {
    exercise_id: string;
    slot_id: string;
    actual_weight: number | null;
    actual_reps: number | null;
    created_at: string;
    sessions: { date: string | null } | { date: string | null }[];
  };
  return ((data ?? []) as Row[]).map((r) => ({
    exercise_id: r.exercise_id,
    slot_id: r.slot_id,
    actual_weight: r.actual_weight,
    actual_reps: r.actual_reps,
    created_at: r.created_at,
    date: Array.isArray(r.sessions) ? r.sessions[0]?.date ?? null : r.sessions?.date ?? null,
  }));
}

// --- Swaps -------------------------------------------------------------------

export async function getSwaps(mesocycleId: string): Promise<SwapRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("swaps").select("*").eq("mesocycle_id", mesocycleId);
  if (error) throw error;
  return data ?? [];
}

export async function recordSwap(row: {
  mesocycle_id: string;
  slot_id: string;
  from_exercise_id: string;
  to_exercise_id: string;
}): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("swaps").insert(row);
  if (error) throw error;
}

export interface ExportRow {
  date: string | null;
  program_day_order: number;
  week: number;
  slot_id: string;
  exercise_id: string;
  set_number: number;
  target_reps_low: number | null;
  target_reps_high: number | null;
  target_weight: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
}

/** All logged sets across all mesocycles, for CSV export. */
export async function getExportRows(): Promise<ExportRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("set_logs")
    .select(
      "slot_id, exercise_id, set_number, target_reps_low, target_reps_high, target_weight, actual_weight, actual_reps, sessions!inner(program_day_order, week, date, created_at)"
    )
    .not("actual_reps", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  type Row = ExportRow & { sessions: { program_day_order: number; week: number; date: string | null } | { program_day_order: number; week: number; date: string | null }[] };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const sess = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions;
    return {
      date: sess?.date ?? null,
      program_day_order: sess?.program_day_order ?? 0,
      week: sess?.week ?? 0,
      slot_id: r.slot_id,
      exercise_id: r.exercise_id,
      set_number: r.set_number,
      target_reps_low: r.target_reps_low,
      target_reps_high: r.target_reps_high,
      target_weight: r.target_weight,
      actual_weight: r.actual_weight,
      actual_reps: r.actual_reps,
    };
  });
}

// --- Settings ----------------------------------------------------------------

export async function getSettings(): Promise<{ cut_mode: boolean }> {
  const sb = getSupabase();
  const { data } = await sb.from("settings").select("cut_mode").eq("id", 1).maybeSingle();
  return { cut_mode: data?.cut_mode ?? true };
}

export async function setCutMode(on: boolean): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("settings").update({ cut_mode: on }).eq("id", 1);
  if (error) throw error;
}
