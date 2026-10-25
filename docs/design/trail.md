# The trail

Total length 2,040 Mk in 16 segments. Types: **station** (store, trade, talk, rest), **hazard** (crossing decision), **landmark** (description + bulletin only), **gate** (the jump; a landmark with a cutscene). Distances are the segment lengths from the previous stop. **Segment n** is the leg that ends at waypoint n.

| # | Waypoint | Type | Mk from previous | Cumulative | Homage |
|---|----------|------|------------------|------------|--------|
| 0 | Independence Station (Earth–Luna L1) | start/station | 0 | 0 | Independence, MO |
| 1 | Lunar Debris Ring | hazard | 102 | 102 | Kansas River crossing |
| 2 | Lagrange Shoals | hazard | 83 | 185 | Big Blue River |
| 3 | Mars Relay | station | 119 | 304 | Fort Kearney |
| 4 | Ceres Approach Spire | landmark | 250 | 554 | Chimney Rock |
| 5 | Ceres Depot | station | 86 | 640 | Fort Laramie |
| 6 | Jupiter's Eye (Great Red Spot flyby) | landmark | 190 | 830 | Independence Rock |
| 7 | The Belt Crossing | hazard | 102 | 932 | South Pass + Green River |
| 8 | Europa Outpost | station | 57 | 989 | Fort Bridger |
| 9 | Saturn Ring Plane | hazard | 162 | 1,151 | Snake River crossing |
| 10 | Titan Refinery | station | 57 | 1,208 | Fort Hall (route choice: via Oort Beacon or direct) |
| 11 | Kuiper Gate | gate | 182 | 1,390 | Soda Springs / the pass (interstellar jump) |
| 12 | Oort Beacon (Proxima outer shell) | station (optional branch) | 114 | 1,504 | Fort Boise |
| 13 | Proxima Heliopause Shock | hazard | 160 | 1,664 | Blue Mountains |
| 14 | Lane Terminus Station | station | 55 | 1,719 | Fort Walla Walla |
| 15 | The Flare Belt | hazard/finale | 120 | 1,839 | The Dalles / Columbia River |
| 16 | New Willamette, Proxima b | end | 201 | 2,040 | Willamette Valley |

Branch at Titan Refinery (M2, `hazards.md`): the Gate direct route skips Oort Beacon (saves 114 Mk, total 1,926 Mk, no resupply; Heliopause baseline +10). **M1 always takes the default path via Oort Beacon.**

Weather phases by segment (`travel.md`): early 1–5, mid 6–13, late 14–16 ("the last three segments", the only place Flare weather occurs).

## M1 waypoint behavior
| Type | M1 behavior |
|------|-------------|
| station | Description; "Continue" or "Enter station" (M2: Outfitters / Trade / Talk / Rest / Continue, `economy.md`). Resting here gets the station bonus. |
| landmark / gate | Description (+ bulletin line from `bulletins.json`); "Continue". |
| hazard | Automatic crossing roll on arrival (below); outcome shown, then "Continue". |
| end | Arrival scene → score. |

## Hazard parameters
| Hazard | Nominal density (1–5) | Baseline incident chance | Tug price (cr, M2; ×1.5 in flare season) | Belter pilot wait (days, M2) |
|--------|---------------|--------------------------|--------------------|-----------------------|
| Lunar Debris Ring | 2 | 15% | 25 | n/a |
| Lagrange Shoals | 2 | 15% | 35 | n/a |
| The Belt Crossing | 4 | 35% | 80 | 4 |
| Saturn Ring Plane | 3 | 25% | 60 | 3 |
| Proxima Heliopause Shock | 4 | 35% (45% on the direct route) | 90 | n/a |
| The Flare Belt | 5 | 45% (ride) | 120 ("Pay the tug" in M3) | n/a |

## M1 crossing roll (single, no choices; in M2 only the Flare Belt's "Thread it")
Resolved on the arrival tick; costs no extra day except as below. Sets the "just crossed" flag for `cargo_shift`.

1. **Incident chance** = baseline + modifiers: Window 1 +10 and Window 2 +5 at Lunar Debris Ring and Lagrange Shoals ("spring tides"); +15 at The Flare Belt during flare season. Roll; no incident → "You made it across." 
2. **Severity** = d100, +5 if density ≥ 4, +10 at The Flare Belt during flare season, capped at 100:

| Severity | Outcome |
|----------|---------|
| 1–40 | Scraped through: next tick is a delay day |
| 41–70 | Cargo loss: one random type with qty > 0 among rations, suits, charges, plates, pumps, gyros; lose 10–25% (min 1) |
| 71–85 | Damage: hull plate broken (50%), coolant pump broken (25%), nav gyro broken (25%) |
| 86–95 | Injury: random present crew gains Decompression injury (no room → −15 health) |
| 96–100 | Lost: random present crew dies (cause `hazard`) |

M2 (`hazards.md`) replaces the auto-roll with four choices (Thread it, Shields up and push, Hire a tug, Wait for a Belter pilot), a density roll, and reuses the severity table above.

Stations' price markup and talk pools: `economy.md`, `writing.md`. Landmark bulletins: `writing.md`.
