-- LEAN 5 — Supabase schema (dynamic training data).
-- The program + exercise library live in code (lib/seed) as the source of truth;
-- Postgres stores the things that change: mesocycles, sessions, set logs, swaps,
-- and app settings. Slots/exercises are referenced by their string ids from code.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

-- Extensions ------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Settings (single-row singleton) ---------------------------------------------
create table if not exists settings (
  id            int primary key default 1,
  pin_hash      text,
  cut_mode      boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Mesocycles ------------------------------------------------------------------
create table if not exists mesocycles (
  id            uuid primary key default gen_random_uuid(),
  program_name  text not null,
  start_date    date not null default current_date,
  week_count    int  not null default 4,
  current_week  int  not null default 1,
  status        text not null default 'active',  -- active | completed
  -- Full program JSON for this block. NULL = use the built-in Lean 5 default.
  -- Populated when a block is generated (AI review) or imported.
  program_json  jsonb,
  goal          text,
  created_at    timestamptz not null default now()
);
-- Migration for existing installs (safe to re-run):
alter table mesocycles add column if not exists program_json jsonb;
alter table mesocycles add column if not exists goal text;

-- Sessions --------------------------------------------------------------------
create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  mesocycle_id     uuid not null references mesocycles(id) on delete cascade,
  program_day_order int not null,
  week             int not null,
  date             date,
  status           text not null default 'pending', -- pending | in_progress | completed | skipped
  duration_seconds int,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists sessions_meso_idx on sessions(mesocycle_id);

-- Set logs --------------------------------------------------------------------
create table if not exists set_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  slot_id          text not null,
  exercise_id      text not null,
  set_number       int not null,
  target_reps_low  int,
  target_reps_high int,
  target_weight    numeric,
  actual_weight    numeric,
  actual_reps      int,
  is_warmup        boolean not null default false,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists set_logs_session_idx on set_logs(session_id);
create index if not exists set_logs_slot_idx on set_logs(slot_id);

-- Swaps -----------------------------------------------------------------------
create table if not exists swaps (
  id               uuid primary key default gen_random_uuid(),
  mesocycle_id     uuid not null references mesocycles(id) on delete cascade,
  slot_id          text not null,
  from_exercise_id text not null,
  to_exercise_id   text not null,
  created_at       timestamptz not null default now()
);
create index if not exists swaps_meso_idx on swaps(mesocycle_id);

-- Row Level Security ----------------------------------------------------------
-- Single-user personal app. The app-layer PIN gate is the real lock; here we
-- enable RLS with permissive policies so the public anon key can read/write.
-- NOTE: with these policies, anyone holding the anon key + project URL can access
-- the data. Acceptable for a private single-user app; revisit if that changes.
alter table settings   enable row level security;
alter table mesocycles enable row level security;
alter table sessions   enable row level security;
alter table set_logs   enable row level security;
alter table swaps      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','mesocycles','sessions','set_logs','swaps'] loop
    execute format('drop policy if exists anon_all on %I;', t);
    execute format('create policy anon_all on %I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;
