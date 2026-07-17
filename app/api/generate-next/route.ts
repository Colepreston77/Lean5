import { NextResponse } from "next/server";
import { buildGenerationPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { validateGeneratedProgram } from "@/lib/ai/contract";
import type { Program } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Door 1: in-app AI mesocycle review. Takes the block summary + current program,
// asks OpenAI (with web search) for the next block, validates it, and re-prompts
// once if validation fails. Never returns an unvalidated program to the client.

const OPENAI_URL = "https://api.openai.com/v1/responses";

interface Body {
  summaryText: string;
  goal?: string;
  currentProgram: Program;
  weekCount?: number;
}

function extractText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as Record<string, unknown>;
  if (typeof d.output_text === "string" && d.output_text.trim()) return d.output_text;
  // Fallback: walk the output array for output_text content.
  const out = Array.isArray(d.output) ? d.output : [];
  const chunks: string[] = [];
  for (const item of out) {
    const content = (item as Record<string, unknown>)?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        const cc = c as Record<string, unknown>;
        if (cc?.type === "output_text" && typeof cc.text === "string") chunks.push(cc.text);
      }
    }
  }
  return chunks.join("\n");
}

function parseProgramJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  // Grab the outermost JSON object if the model added stray prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

async function callOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set on the server.");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const webSearch = (process.env.OPENAI_WEB_SEARCH || "on").toLowerCase() !== "off";

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT, // system-level grounding for the review engine
      input: prompt,
      ...(webSearch ? { tools: [{ type: "web_search" }] } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = extractText(data);
  if (!text) throw new Error("OpenAI returned no text output.");
  return text;
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
    let raw = await callOpenAI(basePrompt);
    let validation = validateGeneratedProgram(safeParse(raw), weekCount);

    // One corrective re-prompt if it failed validation.
    if (!validation.ok) {
      const problems = [...validation.schemaErrors, ...validation.auditErrors.map((e) => e.detail), ...validation.auditWarnings.map((e) => e.detail)];
      const retryPrompt =
        basePrompt +
        `\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION:\n- ${problems.join("\n- ")}\nReturn corrected JSON only, fixing every issue above.`;
      raw = await callOpenAI(retryPrompt);
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
    return parseProgramJson(text);
  } catch {
    return { __parse_error: true, raw: text.slice(0, 300) };
  }
}

function extractRationale(text: string): string {
  try {
    const obj = parseProgramJson(text) as Record<string, unknown>;
    return typeof obj.rationale === "string" ? obj.rationale : "";
  } catch {
    return "";
  }
}
