"use client";

import { useState } from "react";
import type { Program } from "@/lib/engine/types";
import { getExercise } from "@/lib/seed/exercises";
import { buildBlockSummary, summaryToText } from "@/lib/ai/summary";
import { validateGeneratedProgram, type ValidationResult } from "@/lib/ai/contract";
import * as repo from "@/lib/db/repo";

type Proposal = {
  program: Program;
  rationale: string;
  ok: boolean;
  schemaErrors: string[];
  auditErrors: { detail: string }[];
  auditWarnings: { detail: string }[];
};

export default function NextBlock({
  currentProgram,
  mesocycleId,
  weekCount,
  onApplied,
}: {
  currentProgram: Program;
  mesocycleId: string;
  weekCount: number;
  onApplied: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState<null | "ai" | "import" | "apply">(null);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  function fromValidation(v: ValidationResult, rationale: string): Proposal {
    return {
      program: v.program!,
      rationale,
      ok: v.ok,
      schemaErrors: v.schemaErrors,
      auditErrors: v.auditErrors,
      auditWarnings: v.auditWarnings,
    };
  }

  async function generateAI() {
    setError("");
    setProposal(null);
    setBusy("ai");
    try {
      const logs = await repo.getMesocycleHistory(mesocycleId);
      if (logs.length === 0) {
        setError("No logged sets in this block yet — finish some sessions first so the review has data.");
        return;
      }
      const summary = summaryToText(buildBlockSummary(currentProgram, logs));
      const res = await fetch("/api/generate-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentProgram, summaryText: summary, goal: goal.trim() || undefined, weekCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      if (!data.program) {
        setError("The model didn't return a usable program. Try again.");
        return;
      }
      setProposal({
        program: data.program,
        rationale: data.rationale || "",
        ok: data.ok,
        schemaErrors: data.schemaErrors || [],
        auditErrors: data.auditErrors || [],
        auditWarnings: data.auditWarnings || [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  function importJson() {
    setError("");
    setProposal(null);
    setBusy("import");
    try {
      const parsed = JSON.parse(importText);
      const v = validateGeneratedProgram(parsed, weekCount);
      if (!v.program) {
        setError("Couldn't read that program: " + v.schemaErrors.join("; "));
        return;
      }
      setProposal(fromValidation(v, typeof parsed?.rationale === "string" ? parsed.rationale : ""));
    } catch {
      setError("That isn't valid JSON.");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!proposal?.ok) return;
    setBusy("apply");
    try {
      await repo.startNextMesocycle(proposal.program, goal.trim() || null, weekCount);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply the block.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="font-bold">Review block &amp; generate next</div>
      <div className="mt-0.5 text-xs text-ink-faint">
        AI reviews your logged progress + current research and proposes the next block. Nothing applies until you approve it, and it must pass the audit gate.
      </div>

      <label className="mt-3 block text-xs font-semibold text-ink-soft">Goal for next block (optional)</label>
      <input
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="e.g. keep leaning out, bring up side delts"
        className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-ink"
      />

      <div className="mt-3 flex gap-2">
        <button
          onClick={generateAI}
          disabled={busy !== null}
          className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "ai" ? "Reviewing…" : "Generate with AI"}
        </button>
        <button
          onClick={() => setShowImport((s) => !s)}
          disabled={busy !== null}
          className="rounded-xl bg-[var(--neutral-bg)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Import JSON
        </button>
      </div>

      {showImport && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-ink-faint">
            Paste a block JSON (e.g. one Claude generated for you). It runs through the same validation.
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            placeholder='{ "name": "...", "days_per_week": 5, "days": [ ... ] }'
            className="w-full rounded-xl border border-line bg-card p-2 font-mono text-xs outline-none focus:border-ink"
          />
          <button onClick={importJson} disabled={busy !== null || !importText.trim()} className="mt-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Validate import
          </button>
        </div>
      )}

      {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {proposal && (
        <ProposalView proposal={proposal} currentProgram={currentProgram} onApply={apply} applying={busy === "apply"} />
      )}
    </div>
  );
}

function ProposalView({
  proposal,
  currentProgram,
  onApply,
  applying,
}: {
  proposal: Proposal;
  currentProgram: Program;
  onApply: () => void;
  applying: boolean;
}) {
  // Per-position diff vs the current program (by day index + slot index).
  function changed(dayIdx: number, slotIdx: number, exId: string, sets: number): string | null {
    const cur = currentProgram.days[dayIdx]?.slots[slotIdx];
    if (!cur) return "new";
    if (cur.exercise_id !== exId) return `was ${getExercise(cur.exercise_id)?.name ?? cur.exercise_id}`;
    if (cur.sets !== sets) return `was ${cur.sets} sets`;
    return null;
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div
        className={`mb-2 rounded-xl px-3 py-2 text-sm font-bold ${
          proposal.ok ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--yellow-bg)] text-[var(--yellow)]"
        }`}
      >
        {proposal.ok ? "✓ Passes the audit gate — safe to apply" : "Blocked — fix issues below (or regenerate)"}
      </div>

      {proposal.rationale && <p className="mb-3 text-sm text-ink-soft">{proposal.rationale}</p>}

      {(proposal.schemaErrors.length > 0 || proposal.auditErrors.length > 0 || proposal.auditWarnings.length > 0) && (
        <ul className="mb-3 flex flex-col gap-1">
          {[...proposal.schemaErrors, ...proposal.auditErrors.map((e) => e.detail), ...proposal.auditWarnings.map((e) => e.detail)].map((d, i) => (
            <li key={i} className="text-xs text-ink-soft">• {d}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {proposal.program.days.map((day, di) => (
          <div key={di}>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-faint">{day.name}</div>
            <ul className="flex flex-col gap-1">
              {day.slots.map((s, si) => {
                const diff = changed(di, si, s.exercise_id, s.sets);
                return (
                  <li key={si} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {getExercise(s.exercise_id)?.name ?? s.exercise_id}
                      {diff && (
                        <span className="rounded bg-[var(--blue-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--blue)]">
                          {diff}
                        </span>
                      )}
                    </span>
                    <span className="text-ink-soft">
                      {s.sets} × {s.reps_label ?? `${s.reps_low}-${s.reps_high}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={onApply}
        disabled={!proposal.ok || applying}
        className="mt-4 w-full rounded-xl bg-ink py-3 font-bold text-white disabled:opacity-40"
      >
        {applying ? "Applying…" : "Approve & start this block"}
      </button>
    </div>
  );
}
