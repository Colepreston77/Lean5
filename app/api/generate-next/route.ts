import { NextResponse } from "next/server";
import { buildGenerationPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { validateGeneratedProgram } from "@/lib/ai/contract";
import { callOpenAI, parseModelJson } from "@/lib/ai/openai";
import type { Program } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Door 1: in-app AI mesocycle review. Takes the block summary + current program,
// asks OpenAI (with web search) for the next block, validates it, and re-prompts
// once if validation fails. Never returns an unvalidated program to the client.

interface Body {
  summaryText: string;
  goal?: string;
  currentProgram: Program;
  weekCount?: number;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.currentProgram || !body?.summaryText) {
    return NextResponse.json({ error: "Missing currentProgram or summaryText." }, { status: 400 });
  }

  const weekCount = body.weekCount ?? 4;
  const basePrompt = buildGenerationPrompt({
    currentProgram: body.currentProgram,
    summaryText: body.summaryText,
    goal: body.goal,
  });

  try {
    // First attempt.
    let raw = await callOpenAI(basePrompt, SYSTEM_PROMPT);
    let validation = validateGeneratedProgram(safeParse(raw), weekCount);

    // One corrective re-prompt if it failed validation.
    if (!validation.ok) {
      const problems = [...validation.schemaErrors, ...validation.auditErrors.map((e) => e.detail), ...validation.auditWarnings.map((e) => e.detail)];
      const retryPrompt =
        basePrompt +
        `\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION:\n- ${problems.join("\n- ")}\nReturn corrected JSON only, fixing every issue above.`;
      raw = await callOpenAI(retryPrompt, SYSTEM_PROMPT);
      validation = validateGeneratedProgram(safeParse(raw), weekCount);
    }

    return NextResponse.json({
      ok: validation.ok,
      program: validation.program,
      rationale: extractRationale(raw),
      schemaErrors: validation.schemaErrors,
      auditErrors: validation.auditErrors,
      auditWarnings: validation.auditWarnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed." }, { status: 500 });
  }
}

function safeParse(text: string): unknown {
  try {
    return parseModelJson(text);
  } catch {
    return { __parse_error: true, raw: text.slice(0, 300) };
  }
}

function extractRationale(text: string): string {
  try {
    const obj = parseModelJson(text) as Record<string, unknown>;
    return typeof obj.rationale === "string" ? obj.rationale : "";
  } catch {
    return "";
  }
}
