// Builds the generation prompt for the end-of-block review. Encodes the
// programming principles from the spec + the JSON contract the model must emit.
// Shared by the in-app OpenAI route and available for the "ask Claude" door.

import { ALL_EXERCISES } from "@/lib/seed/exercises";
import type { Program } from "@/lib/engine/types";

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
    "You are an evidence-based hypertrophy coach reviewing a finished 4-week training block and designing the next one.",
    "First, use web search to check current (recent) hypertrophy/strength research relevant to the athlete's situation and goal. Then design the next block within the hard constraints. The app's validation layer will reject anything out of bounds, so stay inside them.",
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
