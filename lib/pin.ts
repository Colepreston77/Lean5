// Tiny PIN gate helper. This is a lock screen, NOT real security — the single
// user's data is protected at the app level. Uses SubtleCrypto SHA-256 so the
// raw PIN is never stored; the hash lives in localStorage for V1.

const KEY = "lean5_pin_hash";
const UNLOCK_KEY = "lean5_unlocked";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`lean5:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getStoredPinHash(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(KEY, await hashPin(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getStoredPinHash();
  if (!stored) return false;
  return stored === (await hashPin(pin));
}

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function markUnlocked(): void {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}
