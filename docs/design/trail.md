# The trail

Total length 2,040 Mk in 16 segments. Types: **station** (store, trade, talk, rest), **hazard** (crossing decision), **landmark** (description + bulletin only), **gate** (the jump; a landmark with a cutscene). Distances are the segment lengths from the previous stop.

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

Branch at Titan Refinery (M2): the Gate direct route skips Oort Beacon (saves 114 Mk, no resupply; the Heliopause is harder). Default path includes Oort Beacon.

## Hazard parameters (M1 uses a single simplified "crossing" roll; M2 adds choices)
| Hazard | Density (1–5) | Baseline incident chance | Tug price (cr) | Pilot wait (days) |
|--------|---------------|--------------------------|----------------|-------------------|
| Lunar Debris Ring | 2 | 15% | 25 | 2 |
| Lagrange Shoals | 2 | 15% | 35 | 2 |
| The Belt Crossing | 4 | 35% | 80 | 4 |
| Saturn Ring Plane | 3 | 25% | 60 | 3 |
| Proxima Heliopause Shock | 4 | 35% | 90 | 4 |
| The Flare Belt | 5 | 45% (ride) | 120 | n/a |

Stations' price markup and talk pools: `economy.md`, `writing.md`. Landmark bulletins: `writing.md`.
