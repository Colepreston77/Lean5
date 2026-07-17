"use client";

import { useEffect, useState } from "react";
import { getStoredPinHash, setPin, verifyPin, isUnlocked, markUnlocked } from "@/lib/pin";

type Mode = "loading" | "setup" | "locked" | "unlocked";

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [entry, setEntry] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isUnlocked()) return setMode("unlocked");
    setMode(getStoredPinHash() ? "locked" : "setup");
  }, []);

  async function handleDigit(d: string) {
    setError("");
    if (mode === "locked") {
      const next = (entry + d).slice(0, 4);
      setEntry(next);
      if (next.length === 4) {
        if (await verifyPin(next)) {
          markUnlocked();
          setMode("unlocked");
        } else {
          setError("Wrong PIN");
          setEntry("");
        }
      }
    } else if (mode === "setup") {
      if (!confirm) {
        const next = (entry + d).slice(0, 4);
        setEntry(next);
        if (next.length === 4) setConfirm("_pending");
      } else {
        // confirm phase reuses `entry` as first, this branch tracks 2nd
      }
    }
  }

  // Second-entry handling for setup confirm phase.
  const [second, setSecond] = useState("");
  async function handleSetupConfirm(d: string) {
    setError("");
    const next = (second + d).slice(0, 4);
    setSecond(next);
    if (next.length === 4) {
      if (next === entry) {
        await setPin(entry);
        markUnlocked();
        setMode("unlocked");
      } else {
        setError("PINs didn't match");
        setEntry("");
        setSecond("");
        setConfirm("");
      }
    }
  }

  if (mode === "unlocked") return <>{children}</>;
  if (mode === "loading") return <div className="flex-1" />;

  const settingUp = mode === "setup";
  const inConfirm = settingUp && confirm === "_pending";
  const shown = inConfirm ? second : entry;
  const title = settingUp ? (inConfirm ? "Confirm your PIN" : "Set a 4-digit PIN") : "Enter PIN";

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      <div className="text-center">
        <div className="text-3xl font-black tracking-tight">LEAN 5</div>
        <div className="mt-6 text-ink-soft">{title}</div>
        <div className="mt-4 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 ${
                i < shown.length ? "bg-ink border-ink" : "border-line"
              }`}
            />
          ))}
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => {
                if (k === "⌫") {
                  inConfirm ? setSecond((s) => s.slice(0, -1)) : setEntry((s) => s.slice(0, -1));
                  return;
                }
                inConfirm ? handleSetupConfirm(k) : handleDigit(k);
              }}
              className="h-18 w-18 rounded-full bg-card text-2xl font-semibold shadow-sm active:scale-95 transition-transform"
              style={{ height: 72, width: 72 }}
            >
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}
