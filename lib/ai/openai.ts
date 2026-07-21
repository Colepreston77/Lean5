// Thin wrapper around the OpenAI Responses API, shared by the AI doors
// (next-block review + single-day adaptation). Key stays server-side; callers
// pass a fully-built prompt and their own system instructions.

const OPENAI_URL = "https://api.openai.com/v1/responses";

export function extractText(data: unknown): string {
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

/** Pull the outermost JSON object out of a model reply (tolerates fences/prose). */
export function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

/** Call the model with grounding instructions. `webSearch` opt-in via env. */
export async function callOpenAI(prompt: string, instructions: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set on the server.");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const webSearch = (process.env.OPENAI_WEB_SEARCH || "on").toLowerCase() !== "off";

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      instructions,
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
