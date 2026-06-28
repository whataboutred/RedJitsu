# Achievement badge images

Drop the rendered badge PNGs here. The Achievements tab loads them by exact
filename and overlays the count number in the Anton font, so the images must
have **no text/numbers** and a clean center.

Specs: **PNG, 1024×1024, square, transparent background** (or pure-black
`#000000` if your generator can't do transparency). Icon centered, ~15% padding.

Expected files:

- `milestone-bronze.png`  — kettlebell, antique bronze        (Workouts)
- `milestone-silver.png`  — dumbbell, brushed silver           (Workouts)
- `milestone-gold.png`    — barbell weight plate, polished gold (Workouts)
- `streak-bronze.png`     — medal on a ribbon, antique bronze   (Streaks)
- `streak-silver.png`     — medal on a ribbon, brushed silver   (Streaks)
- `streak-gold.png`       — medal on a ribbon, polished gold    (Streaks)
- `bjj-bronze.png`        — coiled belt emblem, antique bronze, purple accent  (BJJ)
- `bjj-silver.png`        — coiled belt emblem, brushed silver, purple accent  (BJJ)
- `bjj-gold.png`          — coiled belt emblem, polished gold, purple accent   (BJJ)
- `cardio-bronze.png`     — pulse/heartbeat emblem, antique bronze, green accent (Cardio)
- `cardio-silver.png`     — pulse/heartbeat emblem, brushed silver, green accent (Cardio)
- `cardio-gold.png`       — pulse/heartbeat emblem, polished gold, green accent  (Cardio)

Until these exist, the tab automatically falls back to the SVG patch badges.
Locked state (desaturated + dimmed) and the centered number are applied in code.
