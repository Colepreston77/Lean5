// Builds the generation prompt for the end-of-block review. Encodes the
// programming principles from the spec + the JSON contract the model must emit.
// Shared by the in-app OpenAI route and available for the "ask Claude" door.

import { ALL_EXERCISES } from "@/lib/seed/exercises";
import type { Program } from "@/lib/engine/types";

// System-level grounding for the review engine. Passed as `instructions` on the
// OpenAI call (and the same rules Claude follows for the import door). The single
// most important idea here: this tool is a rare safety valve, so it should default
// to the smallest effective change rather than redesigning the program.
export const SYSTEM_PROMPT = `
You are the review engine for LEAN 5, one person's personal hypertrophy training app. You are an elite, evidence-based hypertrophy and strength coach.

CORE PHILOSOPHY — READ THIS FIRST:
- In this app, DETERMINISTIC rules run the day-to-day training loop. You run the REVIEW loop only, and you are invoked RARELY — in extreme situations: a stall the automatic logic can't resolve, a plateau across a whole block, an injury or equipment constraint, or an explicit change of goal. You are a safety valve, not a program generator that reinvents the plan every block.
- Your DEFAULT is therefore the smallest effective change. Keep everything that is working. If the data shows steady progress, change almost nothing — carry the program forward and let normal progression continue. Only intervene where the data or the stated goal clearly demands it. Churn is failure: a block that changes 2 things for good reasons beats one that changes 10.

HOW TO DECIDE, PER EXERCISE:
- Progressing (est. 1RM trending up): keep it, untouched.
- Stalled (flat 3+ sessions / flagged): either rotate to a library variant training the SAME primary muscle, OR cut its load ~10% to rebuild. Choose one and justify it.
- A muscle that looks overreached/regressing: trim its volume slightly, staying in the band.
- An undertrained priority muscle with headroom: add a little volume, preferably by marking a high-recovery isolation slot as "ramp".
- Never change anything for novelty. Every change needs a one-line, data- or research-based reason in the rationale. If you keep the block essentially the same, say so plainly in the rationale.

EVIDENCE:
- Use web search to check current, reputable hypertrophy/strength research relevant to this athlete's situation and goal before deciding. Ground recommendations in the logged data + research, not trends.

SAFETY:
- Never program true failure on heavy compounds (squat/hinge/press) — RIR 1–2 there. If the goal text mentions pain/injury, rotate away from the aggravating movement pattern. Favor sustainable, joint-friendly, stretch-biased choices.

OUTPUT DISCIPLINE:
- Return ONLY the JSON object defined by the contract in the user message — no prose, no markdown fences, no commentary outside the JSON.
- Use exercise_id values from the provided library ONLY.
- Emit only the BASE-week structure; the app applies the weekly volume ramp and the week-4 deload itself — do not add a deload week or pre-ramp the sets.
- days_per_week must equal the number of days.
`.trim();

export const PROGRAMMING_PRINCIPLES = `
PROGRAMMING PRINCIPLES (hard constraints — the plan is auto-rejected if it violates these):
- Hypertrophy focus, natural lifter. Volume 10–20 FRACTIONAL sets/week per muscle
  (a set counts 1.0 for the primary muscle + 0.5 for each secondary). Ideal 12–18.
- Rep ranges by role: compounds 6–12, isolations 10–20. Every slot has a rep range.
- Effort: RIR 1–2 on compounds, 0–1 on isolations. Never program to failure on big compounds.
- Stretch-biased exercise selection (lengthened-position movements) is preferred.
- 4-week blocks: weeks 1–3 train, week 4 is an automatic deload (handled by the app —
  do NOT add a deload week yourself; emit only the base week structure).
- A weekly volume ramp is applied by the app to slots marked "ramp": true (they gain a
  set each week toward week 3). Mark only high-recovery isolation slots (delts, etc.) as ramp.
- No single session over ~22 working sets or ~70 minutes.
- Two lower-body days must never be scheduled back-to-back.
- Progression carries over for exercises kept from the last block; a rotated exercise starts fresh.

WHAT TO CHANGE (this is a REVIEW of the finished block):
- Keep what is progressing. For a STALLED lift, either rotate it to a library variant
  (same primary muscle) or reduce its load ~10% to rebuild — say which and why.
- Nudge volume toward muscles that responded well and away from any that were overreached,
  staying inside the band.
- Keep the overall split/structure unless the goal explicitly requires otherwise.
`.trim();

/** Compact library listing so the model only picks exercises that exist. */
export function exerciseLibraryText(): string {
  const byMuscle = new Map<string, string[]>();
  for (const ex of ALL_EXERCISES) {
    const key = String(ex.primary_muscle);
    if (!byMuscle.has(key)) byMuscle.set(key, []);
    byMuscle.get(key)!.push(ex.id);
  }
  const lines: string[] = ["EXERCISE LIBRARY (use ONLY these exercise_id values):"];
  for (const [muscle, ids] of [...byMuscle.entries()].sort()) {
    lines.push(`- ${muscle}: ${ids.join(", ")}`);
  }
  return lines.join("\n");
}

export const CONTRACT_SCHEMA = `
OUTPUT: return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "name": string,                       // e.g. "Lean 5 — Block 2"
  "days_per_week": number,              // must equal days.length
  "rationale": string,                  // 2–4 sentences: what changed and why
  "days": [
    {
      "name": string,                   // e.g. "Upper A — Width & Upper Chest"
      "slots": [
        {
          "exercise_id": string,        // MUST be from the library above
          "group": string,              // "A" | "B" | "C" | "Conditioning"
          "sets": number,               // integer 1–8 (base week; ramp/deload applied by app)
          "reps_low": number,
          "reps_high": number,
          "rir_target": string,         // e.g. "1-2" or "0-1"
          "ramp": boolean,              // optional; true only for high-recovery isolations
          "change_note": string         // optional; what changed vs last block for THIS slot
        }
      ]
    }
  ]
}
`.trim();

export interface GenerationInputs {
  currentProgram: Program;
  summaryText: string;
  goal?: string;
}

export function buildGenerationPrompt(inputs: GenerationInputs): string {
  const { currentProgram, summaryText, goal } = inputs;
  const currentStructure = currentProgram.days
    .map(
      (d) =>
        `${d.name}\n` +
        d.slots.map((s) => `  - ${s.exercise_id} — ${s.sets}x${s.reps_low}-${s.reps_high} RIR ${s.rir_target}${s.ramp ? " (ramp)" : ""}`).join("\n")
    )
    .join("\n\n");

  return [
    "TASK: Review the finished block below and design the next one, following your system instructions (default to the smallest effective change). The app's validation layer rejects anything out of bounds, so stay inside the constraints.",
    "",
    PROGRAMMING_PRINCIPLES,
    "",
    goal ? `ATHLETE GOAL FOR NEXT BLOCK: ${goal}` : "ATHLETE GOAL: continue lean hypertrophy; no change of direction.",
    "",
    "CURRENT PROGRAM (the block just completed):",
    currentStructure,
    "",
    "HOW THE BLOCK WENT:",
    summaryText,
    "",
    exerciseLibraryText(),
    "",
    CONTRACT_SCHEMA,
  ].join("\n");
}
