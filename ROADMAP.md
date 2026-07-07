# Red Jitsu — Engineering Backlog

Deferred work captured as executable specs. Each item states the problem, the
fix, and acceptance criteria — implement mechanically, decisions are already
made. Ordered roughly by value.

---

## 1. Unit switch (lb↔kg) corrupts analytics

**Problem.** Weights are stored as raw numbers in whatever unit was active when
logged. Switching the profile unit relabels history without converting it: a
185 (lb) bench followed by an 85 (kg) bench reads as a −54% regression, breaks
PR detection, and cliffs every chart.

**Fix.** On unit change in `app/settings/account/page.tsx`, show a confirm
dialog: "Convert all existing weights to kg?" If confirmed, run a conversion
(×0.45359 lb→kg or ×2.20462 kg→lb, rounded to 0.5) across `sets.weight` and
`personal_records.weight/estimated_1rm` for that user — do it in a single
SECURITY DEFINER RPC (`convert_weight_unit(p_to text)`) so it's transactional.
If declined, keep the old behavior but warn that history stays in the old unit.

**Accept when:** switching unit and confirming shows converted historical
numbers everywhere (history, progression, PRs, detail sheets); percentChange
across the switch date is continuous.

## 2. Cursor pagination for BJJ/cardio in history

**Problem.** Strength pages by offset; BJJ/cardio are one-shot `.limit(200)`
(`app/history/page.tsx` `loadHistoryData`). Beyond 200 rows the interleaved
timeline and the heatmap silently lose older sessions.

**Fix.** Convert all three to date-cursor paging: track
`oldestLoaded[type]`, and on Load More fetch
`.lt('performed_at', oldestLoaded).order(desc).limit(50)` per type that still
`hasMore`. Drive the heatmap from a dedicated 12-week date-bounded query (like
`trendInputs`) instead of the paginated lists.

**Accept when:** a seeded account with 300+ of each type can scroll the full
timeline; heatmap shows correct cells regardless of scroll depth.

## 3. Progression detail: all-time toggle

**Problem.** `ExerciseProgressSheet` and the Exercise Progress card are fixed
to 90 days; long-term overload (the user's stated motivator) is invisible.

**Fix.** Add a `90d / 1y / All` inline-tab row (match the History pill-free tab
style) in `ExerciseProgressSheet`; parameterize the fetch by window. Keep the
90-day default. For All, bucket by week (max e1RM per week) to bound chart
points.

**Accept when:** the sheet shows a multi-year e1RM line for an old exercise and
loads under a second on ~500 sessions.

## 4. Overload coach v2

Current v1 (lib/overload.ts) is last-session double progression. Deferred:
- **Deload suggestion:** if the last 3 sessions' best e1RM is flat/declining
  (reuse plateau detection), suggest −10% × high reps for one session.
- **Repeat flow targets:** workouts started via "Repeat" don't fetch
  `lastWorkout`, so no Target chip; fetch it like `addExercise` does.
- **Per-exercise rep-range override:** optional `rep_range_min/max` on a new
  `exercise_prefs` table (user_id, exercise_id) editable from
  ExerciseProgressSheet; falls back to template/default.
- **Unit-aware dumbbell steps:** kg dumbbells commonly step 2.0, not 2.5.

## 5. Offline queue: poison items & sign-out hygiene

**Problem.** A permanently-failing queued workout (e.g. deleted custom
exercise → FK violation) retries forever; "1 workout to sync" never clears.
Queue also persists across sign-out (mitigated by user_id stamping, but the
data lingers on device).

**Fix.** In `trySyncPending`, classify errors: Postgres constraint/validation
codes and 4xx → move item to a `failed_workouts_v1` key and surface a toast
("1 workout couldn't sync — view in Settings"). Add a Settings → Privacy row to
inspect/export/discard failed items. Clear both keys in the sign-out path.

## 6. PR pipeline polish

- `isFirst` in `lib/api/personalRecords.ts` can never be true (baseline gate
  guarantees a prior). Either compute it before the `MIN_PRIOR_SETS` gate or
  remove the field.
- `historicalMax.reps` is set to the last-iterated row's reps — record the reps
  belonging to the max-e1RM set instead.
- `format1RM` defaults to `'lb'`; make `unit` required.

## 7. Push cron DST edge

`ctDay()` in `app/api/push/cron/route.ts` samples the UTC offset at cron time
and applies it to midnight — off by 1h on the two US DST-change days (clips the
Monday "trained yesterday" window). Recompute the offset at the candidate
midnight with a second `formatToParts` pass. Also `vercel.json` fixed UTC hour
means the send time shifts 5pm/6pm CT across DST — acceptable, or split
schedules seasonally.

## 8. Heavy-logger query hardening

- Progression's `workout_exercises .in('workout_id', ids)` fetch can hit
  PostgREST's 1000-row default cap (>1000 exercises in 90 days) — chunk the id
  list and page.
- `loadStreakData` uses `.limit(500)` rows for a 120-week window — replace with
  a `gte(performed_at, 120 weeks ago)` bound.

## 9. Misc UI

- History's heatmap flame shows the strength-only streak beside an
  all-activity heatmap — either label it "lift streak" or compute all-activity.
- Google Health connector: production OAuth verification (CASA) to lift the
  7-day refresh-token expiry; revisit if the weekly reconnect nudge gets old.

---

*Context: Next.js 14 App Router + Supabase (project vfoyihuggxdfkbepgccd).
Design system in ~/RedLabs/DESIGN_SYSTEM.md (Anton display font, red accent,
belt-driven BJJ theming via --belt CSS vars, no emoji, lucide icons only).
Demo account is wiped weekly by reseed_demo_full(); never write migrations
that touch real user rows without a WHERE user_id filter.*
