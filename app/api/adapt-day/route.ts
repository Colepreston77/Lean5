import { NextResponse } from "next/server";
import { callOpenAI, parseModelJson } from "@/lib/ai/openai";
import {
  ADAPT_SYSTEM_PROMPT,
  buildDayAdaptPrompt,
  validateDayAdaptation,
  type AdaptSlotInput,
} from "@/lib/ai/adaptDay";

export const runtime = "nodejs";
export const maxDuration = 120;

// Single-day adaptation door: takes one day's current slots + a plain-English
// constraint, asks the model for exercise-only swaps, validates them (same
// primary muscle, real library ids), and re-prompts once on failure. Never
// returns an invalid swap set to the client.

interface Body {
  dayName: string;
  slots: AdaptSlotInput[];
  constraint: string;
}

function safeParse(text: string): unknown {
  try {
    return parseModelJson(text);
  } catch {
    return { __parse_error: true };
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(body?.slots) || body.slots.length === 0) {
    return NextResponse.json({ error: "Missing day slots." }, { status: 400 });
  }
  if (!body?.constraint?.trim()) {
    return NextResponse.json({ error: "Describe the constraint first (e.g. 'easy on my sprained ankle')." }, { status: 400 });
  }

  const basePrompt = buildDayAdaptPrompt({
    dayName: body.dayName || "Training day",
    slots: body.slots,
    constraint: body.constraint.trim(),
  });

  try {
    let raw = await callOpenAI(basePrompt, ADAPT_SYSTEM_PROMPT);
    let result = validateDayAdaptation(safeParse(raw), body.slots);

    // One corrective re-prompt if a swap broke the rules (wrong muscle, bad id).
    if (!result.ok) {
      const retry =
        basePrompt +
        `\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION:\n- ${result.errors.join("\n- ")}\nReturn corrected JSON only, fixing every issue. Keep each replacement on the same primary muscle as the slot.`;
      raw = await callOpenAI(retry, ADAPT_SYSTEM_PROMPT);
      result = validateDayAdaptation(safeParse(raw), body.slots);
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Adaptation failed." }, { status: 500 });
  }
}
