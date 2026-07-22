import { NextResponse } from "next/server";
import { callClaudeChat, type ChatTurn } from "@/lib/ai/anthropic";
import { CHAT_SYSTEM } from "@/lib/ai/coach";

export const runtime = "nodejs";
export const maxDuration = 120;

// Quick chat (#7): goals-aware one-off training questions, with web search.

interface Body {
  messages: ChatTurn[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const messages = Array.isArray(body?.messages)
    ? body.messages.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    : [];
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send at least one user message." }, { status: 400 });
  }

  try {
    const reply = await callClaudeChat({ system: CHAT_SYSTEM, messages, webSearch: true, maxTokens: 2048 });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Chat failed." }, { status: 500 });
  }
}
