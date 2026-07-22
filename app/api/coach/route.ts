import { NextResponse } from "next/server";
import { callClaude } from "@/lib/ai/anthropic";
import { COACH_SYSTEM, buildCoachPrompt, type CoachSet } from "@/lib/ai/coach";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-workout coach (#4): given one exercise's target + the sets logged so far,
// returns a short autoregulation call — add a set, push reps/load, or stop.

interface Body {
  exerciseName: string;
  repsLow: number;
  repsHigh: number;
  rirTarget: string;
  targetSets: number;
  sets: CoachSet[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.exerciseName || !Array.isArray(body?.sets)) {
    return NextResponse.json({ error: "Missing exercise or sets." }, { status: 400 });
  }

  try {
    const advice = await callClaude({
      system: COACH_SYSTEM,
      prompt: buildCoachPrompt(body),
      thinking: false, // fast, latency-sensitive mid-set
      maxTokens: 400,
    });
    return NextResponse.json({ advice });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Coach failed." }, { status: 500 });
  }
}
