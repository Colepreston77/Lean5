// Plain-English explanation of an RIR (Reps In Reserve) target, shown on each
// exercise card so the effort cue is unambiguous mid-set.

const GUIDE: Record<string, string> = {
  "0": "Go to true failure — the last rep barely moves and you can't get another.",
  "0-1": "Take it to failure or one rep shy — grind that last rep hard.",
  "1": "Stop with one solid rep left in the tank.",
  "1-2": "Leave 1–2 reps in reserve — the last rep should be a real struggle, but you still get it clean.",
  "2-3": "Leave 2–3 reps in reserve — hard, but comfortably short of failure.",
  "3-4": "Easy — stop well short with 3–4 reps left. Keep the groove, don't chase fatigue.",
};

/** Returns a sentence explaining the RIR target, or "" for cardio/unknown. */
export function rirGuide(rir: string): string {
  const key = rir.trim().toLowerCase();
  if (!key || key === "n/a") return "";
  return GUIDE[key] ?? `Leave about ${rir} reps in reserve on each set.`;
}
