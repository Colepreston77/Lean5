# LEAN 5 — Personal Workout Tracker (Build Spec)

Build a personal workout tracking PWA for a single user. No social features, no videos, no photos. The product is: a day-by-day checklist of lifts with rep targets, per-set logging with last session's numbers visible, a science-based progression engine with automatic deloads, and an exercise swap system.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres) for data
- Deploy target: Vercel
- PWA: installable on iPhone, works offline for an in-progress session, syncs when back online
- Single user. Simple PIN gate is fine (same pattern as my other app). No OAuth.

## Core screens

### 1. Today view (the main screen — model after Fitness Culture's workout day layout)
- Header: date, workout name (e.g., "Upper A — Width & Upper Chest"), mesocycle week indicator (e.g., "Week 2 of 4" or "DELOAD WEEK")
- Scrollable list of exercises grouped by section (Warm-up, Group A, Group B...) — card per exercise
- Each exercise card shows:
  - Exercise name
  - Set/rep target (e.g., "3 x 8-12")
  - Effort cue line in smaller text (e.g., "Leave 1-2 in the tank" / "Take the last set to failure + lengthened partials")
  - A swap icon (see Swap System)
- Tapping a card expands it into set rows:
  - Each set row: weight input, reps input, checkmark to complete
  - Beside each set row, greyed text with last session's numbers for that same set (e.g., "last: 185 x 10")
- No rest timer. Rest times are stored per exercise for session-length estimation (audit gate) only — do not build timer UI.
- Session complete screen: total volume, sets done, any PRs (new best weight x reps by estimated 1RM), duration

### 2. Calendar / week view
- Scroll or swipe ahead to see upcoming days and what workout falls on each (like Fitness Culture's 7-day lookahead)
- Past days show completed/missed status
- Tapping a future day previews that workout read-only

### 3. Progress view
- Per-exercise chart: estimated 1RM (Epley) over time
- Weekly sets per muscle group vs. target range (12-18) — simple bar per muscle
- Bodyweight is handled in MacroFactor; do NOT build nutrition features

### 4. Program view
- Shows the current mesocycle structure, rep ranges, and which week you're in
- Button: "Generate next mesocycle" (see Progression Engine)

## Progression engine (server-side, pure functions, unit-tested)

1. **Double progression**: each exercise has a rep range (e.g., 8-12). When the user hits the top of the range on ALL sets at a given weight, next session's target weight increases (+5 lb upper body, +10 lb lower body, +2.5 lb for lateral raises/curls and other small isolations — store increment per exercise) and target reps reset to the bottom of the range.
2. **Effort targets**: every exercise has an RIR target (0-1 for isolations, 1-2 for compounds). Display as the cue line.
3. **Deload**: every 4th week is an automatic deload — same exercises, HALF the sets, same weight, RIR 3-4 cue ("easy week, keep the groove"). After deload, a new mesocycle begins.
4. **Mesocycle rotation**: on new mesocycle, each exercise slot MAY rotate to its designated variant (see `rotation_pool` in seed data). Rotate the variant, keep the movement pattern. Ask the user with a one-tap confirm per slot ("Keep incline DB press or rotate to low-incline Smith?").
5. **Stall detection**: if an exercise shows no increase in best set (weight x reps) for 3 consecutive sessions, flag it in the UI with two options: "swap variant" or "back off 10% and rebuild."
6. **Cut mode toggle** (settings): when ON, trims one set from the last exercise of each day (~15-20% volume cut) and adds a note to the day header. Default ON.
7. **Progression hint chip**: each exercise card shows a small chip computed by a pure `getProgressionHint()` function from last session's logs, per the double progression rules:
   - Hit top of rep range on all sets last session → "↑ Add 5 lb, aim for 8s" (green)
   - Mid-range last session → "→ Same weight, beat 185 x 10" (neutral)
   - Missed bottom of range → "↓ Drop 5-10%, rebuild" (yellow)
   - Deload week → "Easy day, half sets, same weight"
   Chip sits next to the greyed "last: 185 x 10" text. Deterministic, no AI involved.
8. **Weekly plan audit (QA gate — v1, pure function, unit-tested)**: runs every time a week is scheduled or modified (progression applied, swap made, travel mode active, deload generated, cut mode toggled, or any AI-generated content applied). Checks invariants before the week is published to the Today/Calendar views:
   - Every muscle's weekly sets within 10-20 (warn if delts/back fall below their bias targets)
   - No session over ~18 working sets or an estimated 60 minutes (computed from sets x rest times)
   - Every exercise slot has non-null target weight, rep range, RIR, rest, and increment
   - No target weight jump >10% session-over-session; no target below the most recent deload weight for that exercise
   - Deload weeks are actually deloaded: half sets, no progression hint chips firing
   - The two lower-body days are not scheduled back-to-back
   - Any substituted exercise (swap or travel mode) still matches the slot's primary muscle
   On failure: the week does not publish. Show a "plan review" screen listing each failed check with a one-tap fix (revert slot, adjust target, etc.). On pass: green check in the week header. ALL plan sources — the deterministic engine, swaps, travel mode, and any future AI-generated programs — must flow through this single audit gate.
9. **Missed-session logic**: workouts are a SEQUENCE, not calendar-locked. If a day is skipped, the next gym day serves the next workout in order (skip Tuesday's Lower A → Wednesday shows Lower A). One skipped day per week absorbs silently. If 3+ workouts in a week are missed, prompt: "Rough week — repeat this week of the mesocycle?" (deload clock pauses if accepted). Never silently skip a workout's content.
10. **Cold start (first week of first mesocycle)**: no progression hints, no "last:" values (show "first time — find your weight" instead). User logs whatever they lift at the target RIR. Engine begins computing hints and last-session displays from week 2 onward. Same behavior applies to any exercise with no history (new swaps, new program).
11. **Warm-ups**: each day begins with a non-logged warm-up card: "5 min easy cardio + ramp sets below." The FIRST exercise of each day auto-generates 2 ramp sets from its target weight (~50% x 8, ~75% x 3), displayed above the working sets, checkable but excluded from volume/progression/audit math.
12. **Data export**: settings button exporting all set logs as CSV (date, workout, exercise, set number, weight, reps, targets). Training history must never be trapped in the app; this is also the raw input for future AI mesocycle reviews.

## Swap system ("generate" button)
- Every exercise is tagged: `primary_muscle`, `movement_pattern`, `equipment`
- Tapping swap cycles to another exercise with the same `primary_muscle` and compatible `movement_pattern` from the exercise library
- User can keep tapping to cycle options
- After 3 swaps in one session, lock further swaps for that slot and show: "Pick one — the lift isn't the problem."
- A swap persists for the remainder of the mesocycle (so progression history stays clean). Log swaps.

## Data model (Supabase)
- `exercises` (id, name, primary_muscle, secondary_muscles[], movement_pattern, equipment, rir_target, cue_text, rest_seconds, weight_increment, rotation_pool[])
- `programs` (id, name, days_per_week)
- `program_days` (id, program_id, day_order, name, sections jsonb) — sections hold ordered exercise slots with set/rep schemes
- `mesocycles` (id, program_id, start_date, week_count, current_week, status)
- `sessions` (id, program_day_id, mesocycle_id, date, status, duration, notes)
- `set_logs` (id, session_id, exercise_id, set_number, target_reps_low, target_reps_high, target_weight, actual_weight, actual_reps, completed_at)
- `swaps` (id, mesocycle_id, slot_id, from_exercise_id, to_exercise_id, created_at)

## UI style
- Clean, minimal, light theme like Fitness Culture: white cards on light grey background, bold exercise names, generous tap targets (this gets used mid-workout with sweaty hands — inputs must be big, steppers preferred over typing)
- No stock photos, no videos. Text only + icons.
- Bottom nav: Today | Calendar | Progress | Program

## SEED DATA — load this program on first run

Program: "Lean 5" — 5 days/week. Rep scheme notation: sets x rep-range. Default rest: compounds 150s, isolations 75s.

```json
{
  "program": "Lean 5",
  "days": [
    {
      "name": "Upper A — Width & Upper Chest",
      "sections": [
        {"group": "A", "exercises": [
          {"name": "Incline DB Press", "sets": 3, "reps": "8-12", "muscle": "chest", "pattern": "horizontal_press", "rir": "1-2", "cue": "Deep stretch at the bottom, leave 1-2 in the tank", "rest": 150, "increment": 5, "rotation_pool": ["Low-Incline Smith Press", "Incline Machine Press"]},
          {"name": "Weighted Pull-Up", "sets": 3, "reps": "8-12", "muscle": "lats", "pattern": "vertical_pull", "rir": "1-2", "cue": "Full hang at the bottom every rep", "rest": 150, "increment": 5, "rotation_pool": ["Lat Pulldown", "Neutral-Grip Pulldown"]}
        ]},
        {"group": "B", "exercises": [
          {"name": "Seated Cable Row (Neutral)", "sets": 3, "reps": "10-12", "muscle": "mid_back", "pattern": "horizontal_pull", "rir": "1-2", "cue": "Let the weight pull you into a stretch, then drive elbows back", "rest": 120, "increment": 5, "rotation_pool": ["Chest-Supported Row", "Single-Arm Cable Row"]},
          {"name": "Cable Lateral Raise", "sets": 3, "reps": "12-15", "muscle": "side_delts", "pattern": "lateral_raise", "rir": "0-1", "cue": "Start behind the body. Last set to failure + lengthened partials", "rest": 75, "increment": 2.5, "rotation_pool": ["DB Lateral Raise", "Machine Lateral Raise"]}
        ]},
        {"group": "C", "exercises": [
          {"name": "Overhead Cable Triceps Extension", "sets": 3, "reps": "10-15", "muscle": "triceps", "pattern": "elbow_extension", "rir": "0-1", "cue": "Big stretch behind the head", "rest": 75, "increment": 2.5, "rotation_pool": ["Overhead EZ Extension", "Cross-Body Cable Extension"]},
          {"name": "Incline DB Curl", "sets": 3, "reps": "10-15", "muscle": "biceps", "pattern": "elbow_flexion", "rir": "0-1", "cue": "Arms hang back, stretch the biceps hard", "rest": 75, "increment": 2.5, "rotation_pool": ["Bayesian Cable Curl", "Preacher Curl"]}
        ]}
      ]
    },
    {
      "name": "Lower A — Quad",
      "sections": [
        {"group": "A", "exercises": [
          {"name": "Hack Squat", "sets": 3, "reps": "6-10", "muscle": "quads", "pattern": "squat", "rir": "1-2", "cue": "Deep as mobility allows, controlled descent", "rest": 180, "increment": 10, "rotation_pool": ["High-Bar Squat", "Pendulum Squat", "Leg Press (low feet)"]},
          {"name": "Leg Press", "sets": 3, "reps": "10-12", "muscle": "quads", "pattern": "squat", "rir": "1-2", "cue": "Full depth, no lockout rest", "rest": 150, "increment": 10, "rotation_pool": ["Hack Squat", "Smith Squat"]}
        ]},
        {"group": "B", "exercises": [
          {"name": "Seated Leg Curl", "sets": 3, "reps": "10-15", "muscle": "hamstrings", "pattern": "knee_flexion", "rir": "0-1", "cue": "Seated beats lying — hams are lengthened. Squeeze and control", "rest": 90, "increment": 5, "rotation_pool": ["Lying Leg Curl", "Nordic Curl (assisted)"]},
          {"name": "Leg Extension", "sets": 2, "reps": "12-15", "muscle": "quads", "pattern": "knee_extension", "rir": "0-1", "cue": "Lean back for rectus femoris stretch. Last set to failure", "rest": 75, "increment": 5, "rotation_pool": ["Sissy Squat", "Reverse Nordic"]}
        ]},
        {"group": "C", "exercises": [
          {"name": "Standing Calf Raise", "sets": 3, "reps": "10-15", "muscle": "calves", "pattern": "calf_raise", "rir": "0-1", "cue": "2-second pause in the bottom stretch every rep", "rest": 75, "increment": 5, "rotation_pool": ["Leg Press Calf Raise"]},
          {"name": "Cable Crunch", "sets": 3, "reps": "10-15", "muscle": "abs", "pattern": "spinal_flexion", "rir": "0-1", "cue": "Round the spine, don't just hinge hips", "rest": 60, "increment": 5, "rotation_pool": ["Ab Wheel", "Machine Crunch"]}
        ]}
      ]
    },
    {
      "name": "Upper B — Thickness & Delts",
      "sections": [
        {"group": "A", "exercises": [
          {"name": "Seated DB Shoulder Press", "sets": 3, "reps": "8-12", "muscle": "front_delts", "pattern": "vertical_press", "rir": "1-2", "cue": "DBs low in the bottom for stretch", "rest": 150, "increment": 5, "rotation_pool": ["Machine Shoulder Press", "Standing Barbell OHP"]},
          {"name": "Chest-Supported Row", "sets": 3, "reps": "8-12", "muscle": "mid_back", "pattern": "horizontal_pull", "rir": "1-2", "cue": "Chest stays pinned, no body english", "rest": 150, "increment": 5, "rotation_pool": ["T-Bar Row", "Seal Row"]}
        ]},
        {"group": "B", "exercises": [
          {"name": "Flat DB Press", "sets": 3, "reps": "8-12", "muscle": "chest", "pattern": "horizontal_press", "rir": "1-2", "cue": "Deeper stretch than a barbell allows — use it", "rest": 150, "increment": 5, "rotation_pool": ["Machine Chest Press", "Weighted Dip"]},
          {"name": "Lat Pulldown (Wide)", "sets": 3, "reps": "10-12", "muscle": "lats", "pattern": "vertical_pull", "rir": "1-2", "cue": "Full stretch at the top, different grip than Day 1", "rest": 120, "increment": 5, "rotation_pool": ["Close-Grip Pulldown", "Pull-Up"]}
        ]},
        {"group": "C", "exercises": [
          {"name": "DB Lateral Raise", "sets": 3, "reps": "12-20", "muscle": "side_delts", "pattern": "lateral_raise", "rir": "0-1", "cue": "Last set: failure, then lengthened partials", "rest": 75, "increment": 2.5, "rotation_pool": ["Cable Lateral Raise", "Machine Lateral Raise"]},
          {"name": "Reverse Pec-Deck", "sets": 3, "reps": "12-15", "muscle": "rear_delts", "pattern": "rear_delt_fly", "rir": "0-1", "cue": "Slow negatives, no swinging", "rest": 75, "increment": 5, "rotation_pool": ["Cable Rear Delt Fly", "Bent-Over DB Fly"]},
          {"name": "Triceps Pushdown", "sets": 2, "reps": "10-15", "muscle": "triceps", "pattern": "elbow_extension", "rir": "0-1", "cue": "Push close to failure both sets", "rest": 75, "increment": 2.5, "rotation_pool": ["Rope Pushdown", "Dip Machine"]}
        ]}
      ]
    },
    {
      "name": "Lower B — Hinge & Glute",
      "sections": [
        {"group": "A", "exercises": [
          {"name": "Romanian Deadlift", "sets": 3, "reps": "8-10", "muscle": "hamstrings", "pattern": "hinge", "rir": "1-2", "cue": "Push hips back, feel the ham stretch, don't chase depth with spine", "rest": 180, "increment": 10, "rotation_pool": ["DB RDL", "Trap Bar Deadlift", "45° Back Extension (loaded)"]},
          {"name": "Bulgarian Split Squat", "sets": 3, "reps": "8-12 each", "muscle": "glutes", "pattern": "lunge", "rir": "1-2", "cue": "Long stride = more glute. Brutal by design", "rest": 120, "increment": 5, "rotation_pool": ["Walking Lunge", "Smith Reverse Lunge"]}
        ]},
        {"group": "B", "exercises": [
          {"name": "Lying Leg Curl", "sets": 3, "reps": "10-15", "muscle": "hamstrings", "pattern": "knee_flexion", "rir": "0-1", "cue": "Control the negative", "rest": 90, "increment": 5, "rotation_pool": ["Seated Leg Curl"]},
          {"name": "Leg Extension", "sets": 2, "reps": "12-15", "muscle": "quads", "pattern": "knee_extension", "rir": "0-1", "cue": "Quick quad top-up, close to failure", "rest": 75, "increment": 5, "rotation_pool": ["Sissy Squat"]}
        ]},
        {"group": "C", "exercises": [
          {"name": "Seated Calf Raise", "sets": 3, "reps": "12-15", "muscle": "calves", "pattern": "calf_raise", "rir": "0-1", "cue": "Pause the stretch at the bottom", "rest": 75, "increment": 5, "rotation_pool": ["Standing Calf Raise"]},
          {"name": "Hanging Leg Raise", "sets": 3, "reps": "10-15", "muscle": "abs", "pattern": "hip_flexion", "rir": "0-1", "cue": "No swinging, curl the pelvis", "rest": 60, "increment": 0, "rotation_pool": ["Captain's Chair Raise", "Cable Crunch"]}
        ]}
      ]
    },
    {
      "name": "Day 5 — Aesthetic (Delts/Arms/Pump)",
      "sections": [
        {"group": "A", "exercises": [
          {"name": "Low-Incline Machine Press", "sets": 3, "reps": "10-12", "muscle": "chest", "pattern": "horizontal_press", "rir": "1", "cue": "Upper chest focus, smooth tempo", "rest": 120, "increment": 5, "rotation_pool": ["Incline DB Press", "Cable Fly (low-to-high)"]},
          {"name": "Cable Lateral Raise", "sets": 4, "reps": "12-20", "muscle": "side_delts", "pattern": "lateral_raise", "rir": "0-1", "cue": "Third delt hit this week — they can take it. Last set failure + partials", "rest": 60, "increment": 2.5, "rotation_pool": ["DB Lateral Raise"]}
        ]},
        {"group": "B", "exercises": [
          {"name": "Bayesian Cable Curl", "sets": 3, "reps": "10-15", "muscle": "biceps", "pattern": "elbow_flexion", "rir": "0-1", "cue": "Arm behind body = max stretch", "rest": 75, "increment": 2.5, "rotation_pool": ["Incline DB Curl", "EZ Bar Curl"]},
          {"name": "Overhead EZ Triceps Extension", "sets": 3, "reps": "10-15", "muscle": "triceps", "pattern": "elbow_extension", "rir": "0-1", "cue": "Stretch the long head hard", "rest": 75, "increment": 2.5, "rotation_pool": ["Overhead Cable Extension"]}
        ]},
        {"group": "C", "exercises": [
          {"name": "Face Pull", "sets": 3, "reps": "15-20", "muscle": "rear_delts", "pattern": "rear_delt_fly", "rir": "0-1", "cue": "Pull to eyebrows, external rotate", "rest": 60, "increment": 2.5, "rotation_pool": ["Reverse Pec-Deck"]},
          {"name": "Hammer Curl + Pushdown Superset", "sets": 2, "reps": "12-15", "muscle": "arms", "pattern": "superset", "rir": "0", "cue": "Back-to-back, no rest between the two. Finisher", "rest": 90, "increment": 2.5, "rotation_pool": []}
        ]},
        {"group": "Conditioning", "exercises": [
          {"name": "Incline Walk", "sets": 1, "reps": "12-15 min", "muscle": "cardio", "pattern": "cardio", "rir": "n/a", "cue": "Optional swap 1x/week: bike intervals 30s hard / 90s easy x 8-10", "rest": 0, "increment": 0, "rotation_pool": ["Bike Intervals"]}
        ]}
      ]
    }
  ]
}
```

## Build order
1. Schema + seed script (load the JSON above into Supabase)
2. Today view with set logging + last-session display + warm-up cards
3. Progression engine functions + unit tests (double progression, deload scheduling, stall detection, weekly plan audit)
4. Calendar view
5. Swap system
6. Progress charts
7. PWA/offline layer + polish

## Potential future features (NOT v1 — owner is willing to build these later; architect so they're easy to add)

These are AI-powered additions planned for after the core app is stable. Do not build them in v1, but structure the data layer so they slot in cleanly (all set logs queryable per mesocycle, session notes stored as free text, swap history retained).

1. **Mesocycle review (highest priority)**: at the end of each 4-week block, send the block's full set logs to the Claude API with a prompt like "What stalled, what's ahead of schedule, what should next block change?" Returns proposed adjustments (volume tweaks, exercise rotations, rep range changes); user approves/rejects each, app applies approved ones to the next mesocycle.
2. **Session notes → structured flags**: free-text note field per session (e.g., "shoulder felt tweaky on OHP"). AI parses it into structured tags on the exercise, can suggest a rotation-pool swap next session, and surfaces the pattern if it recurs.
3. **Smart swap ranking**: upgrade the generate button from static-pool cycling to AI-ranked alternatives using the user's own progression history (e.g., faster progress on machines vs. free weights for a muscle) and available equipment.
4. **Weekly recap card**: short Monday summary generated from real logged data — e.g., "Volume up 4%, laterals PR'd, hack squat stalled 2 sessions." Two sentences max, no fluff.
5. **AI program generator (natural-language program switching)**: user types a goal in plain English (e.g., "lean bulk," "calisthenics only for 8 weeks," "3-day full body while traveling") → Claude API receives the request + the program JSON schema + the user's training history + the programming principles in this spec (12-18 weekly sets/muscle, rep ranges, RIR targets, deload every 4th week, stretch-biased exercise selection) → returns a complete program JSON. Hard requirements:
   - **Validation layer**: app rejects any generated program failing schema validation, volume outside 10-20 weekly sets per muscle, sessions over ~18 working sets, or exercises missing RIR/rest/increment fields. Auto re-prompt on rejection. Never run an unvalidated program.
   - **Preview + approve**: user sees the full new split before it's applied. Nothing applies silently.
   - **Mesocycle boundaries only**: new program starts a new mesocycle. Never swaps mid-block. Progression history carries over for overlapping exercises.
   This does not conflict with the runtime rule below: this generates the next *plan*; the deterministic engine still executes every session.
   - **Research grounding**: the generation API call should enable the Anthropic web search tool so program changes are informed by current training research, not just model memory. The prompt instructs: consult recent hypertrophy/strength literature for the stated goal, then generate within the hard constraints above. The validation layer remains the safety net regardless of what research returns.
6. **Travel / equipment-constraint mode (temporary, does NOT change the program)**: user sets a temporary constraint (e.g., "this week: dumbbells + bodyweight only," "hotel gym," date range required). The app substitutes each affected exercise slot with the closest equivalent that satisfies the constraint:
   - **Deterministic first**: match on `primary_muscle` + `movement_pattern` + allowed `equipment` from the exercise library (e.g., Hack Squat → DB Bulgarian Split Squat; Cable Lateral Raise → DB Lateral Raise; Lat Pulldown → DB Pullover).
   - **AI fallback**: only for slots with no library match — Claude API proposes the best substitute with a one-line rationale, validated against the same tags before display.
   - Slot structure, sets, reps, and RIR targets stay identical. Substitutions log weight history under their own exercise but count toward the same slot, so the mesocycle and progression tracking continue uninterrupted.
   - When the constraint window ends, the program reverts automatically. This mode never starts a new mesocycle.

Rule of thumb for this app: **deterministic rules run the training loop; AI runs the review loop.** Never generate workouts at runtime with AI.

## Non-goals (do not build)
- Nutrition/macro tracking (MacroFactor owns this)
- Social features, community, feeds
- Exercise videos or photo demos
- AI-generated workouts at runtime
