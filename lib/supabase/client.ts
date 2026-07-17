"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client (singleton). This is a client-first PWA: most reads
// and writes happen from client components so an in-progress session keeps
// working offline and syncs when back online.

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  _client = createClient(url, anon, {
    auth: { persistSession: false },
  });
  return _client;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
