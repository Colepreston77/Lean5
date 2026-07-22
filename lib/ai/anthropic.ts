// Shared Claude (Anthropic) client for LEAN 5's AI features — the block review,
// day adaptation, in-workout coach, and quick chat. Key stays server-side.
//
// Defaults: Opus 4.8, adaptive thinking on (Claude decides depth), and optional
// server-side web search for anything that benefits from current research. Web
// search runs an Anthropic-side loop that can return stop_reason "pause_turn";
// we continue the turn until it settles.

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  return (cached ??= new Anthropic({ apiKey }));
}

function textOf(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

interface RunOptions {
  system: string;
  messages: Anthropic.Messages.MessageParam[];
  maxTokens?: number;
  webSearch?: boolean;
  thinking?: boolean;
}

async function run(opts: RunOptions): Promise<string> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const useThinking = opts.thinking !== false;
  const tools = opts.webSearch ? [{ type: "web_search_20260209" as const, name: "web_search" as const }] : undefined;
  const messages = [...opts.messages];

  let text = "";
  // Continue through web-search pause_turns (server tool loop) up to a few rounds.
  for (let i = 0; i < 5; i++) {
    const res = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      ...(useThinking ? { thinking: { type: "adaptive" as const } } : {}),
      ...(tools ? { tools } : {}),
      messages,
    });
    const chunk = textOf(res.content);
    if (chunk) text = chunk;
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    break;
  }
  return text.trim();
}

export interface ClaudeCallOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Enable Anthropic-hosted web search (current research). Off by default. */
  webSearch?: boolean;
  /** Adaptive thinking. On by default — turn off for tiny, latency-sensitive calls. */
  thinking?: boolean;
}

/** Single-shot text completion from one user prompt. */
export async function callClaude(opts: ClaudeCallOptions): Promise<string> {
  return run({
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    maxTokens: opts.maxTokens,
    webSearch: opts.webSearch,
    thinking: opts.thinking,
  });
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Multi-turn chat completion. Returns the assistant's next reply. */
export async function callClaudeChat(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  webSearch?: boolean;
}): Promise<string> {
  return run({
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    maxTokens: opts.maxTokens ?? 2048,
    webSearch: opts.webSearch,
  });
}
