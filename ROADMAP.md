# Red Jitsu — Engineering Backlog

Deferred work captured as executable specs. Each item states the problem, the
fix, and acceptance criteria — implement mechanically, decisions are already
made. Ordered roughly by value.

---

*Items 1–6 of the original backlog (unit conversion, cursor pagination,
all-time progression toggle, overload coach v2, offline-queue hygiene,
PR pipeline polish) shipped 2026-07-07.*

*Items 1–6 shipped 2026-07-07; the DST cron fix, heavy-logger query
hardening, and heatmap streak label shipped 2026-07-07 as well.*

## 1. Google Health production OAuth (external)

The only remaining item, and it's a Google-side process, not code:
complete OAuth verification (CASA security assessment) to move the app
out of "Testing" mode and lift the 7-day refresh-token expiry. Revisit
if the weekly reconnect nudge gets old.

---

*Context: Next.js 14 App Router + Supabase (project vfoyihuggxdfkbepgccd).
Design system in ~/RedLabs/DESIGN_SYSTEM.md (Anton display font, red accent,
belt-driven BJJ theming via --belt CSS vars, no emoji, lucide icons only).
Demo account is wiped weekly by reseed_demo_full(); never write migrations
that touch real user rows without a WHERE user_id filter.*
