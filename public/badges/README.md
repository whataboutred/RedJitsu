# Achievement badge images

Drop the rendered badge PNGs here. The Achievements tab loads them by exact
filename and overlays the count number in the Anton font, so the images must
have **no text/numbers** and a clean center.

Specs: **PNG, 1024×1024, square, transparent background** (or pure-black
`#000000` if your generator can't do transparency). Icon centered, ~15% padding.

Expected files:

- `milestone-bronze.png`  — kettlebell, antique bronze
- `milestone-silver.png`  — dumbbell, brushed silver
- `milestone-gold.png`    — barbell weight plate, polished gold
- `streak-bronze.png`     — medal on a ribbon, antique bronze
- `streak-silver.png`     — medal on a ribbon, brushed silver
- `streak-gold.png`       — medal on a ribbon, polished gold

Until these exist, the tab automatically falls back to the SVG patch badges.
Locked state (desaturated + dimmed) and the centered number are applied in code.
