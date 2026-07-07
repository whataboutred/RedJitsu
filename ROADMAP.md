# Red Jitsu — Engineering Backlog

Deferred work captured as executable specs. Each item states the problem, the
fix, and acceptance criteria — implement mechanically, decisions are already
made. Ordered roughly by value.

---

*Items 1–6 of the original backlog (unit conversion, cursor pagination,
all-time progression toggle, overload coach v2, offline-queue hygiene,
PR pipeline polish) shipped 2026-07-07.*

## 1. Push cron DST edge

`ctDay()` in `app/api/push/cron/route.ts` samples the UTC offset at cron time
and applies it to midnight — off by 1h on the two US DST-change days (clips the
Monday "trained yesterday" window). Recompute the offset at the candidate
midnight with a second `formatToParts` pass. Also `vercel.json` fixed UTC hour
means the send time shifts 5pm/6pm CT across DST — acceptable, or split
schedules seasonally.

## 2. Heavy-logger query hardening

- Progression's `workout_exercises .in('workout_id', ids)` fetch can hit
  PostgREST's 1000-row default cap (>1000 exercises in 90 days) — chunk the id
  list and page.
- `loadStreakData` uses `.limit(500)` rows for a 120-week window — replace with
  a `gte(performed_at, 120 weeks ago)` bound.

## 3. Misc UI

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
