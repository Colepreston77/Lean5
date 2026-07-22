"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/ai/anthropic";

// Quick coach chat (#7): goals-aware one-off training questions, Claude-backed.

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatTurn[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Coach unavailable.");
      else setMessages((m) => [...m, { role: "assistant", content: data.reply || "" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-4 pt-4 pb-28">
      <h1 className="text-2xl font-black">Coach</h1>
      <p className="text-sm text-ink-faint">Ask anything about your training, nutrition, or recovery.</p>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        {messages.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-sm text-ink-soft shadow-sm">
            e.g. &ldquo;Is 2 sets of leg extensions enough today?&rdquo; · &ldquo;Best rep range for side delts?&rdquo; ·
            &ldquo;How should I train around a sore lower back?&rdquo;
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
              m.role === "user" ? "self-end bg-ink text-white" : "self-start bg-card text-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <div className="self-start rounded-2xl bg-card px-3.5 py-2.5 text-sm text-ink-faint shadow-sm">Thinking…</div>}
        {error && <div className="self-start rounded-2xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-20 mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Ask your coach…"
          className="max-h-32 flex-1 resize-none rounded-2xl border border-line bg-card px-3.5 py-3 text-sm outline-none focus:border-ink"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
