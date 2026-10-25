# Scoring

Computed on arrival at New Willamette (only with ≥ 1 living crew; death endings show no score). Mirrors the original's structure with renamed items. Each line is floored to an integer before summing.

| Line | Points |
|------|--------|
| Each surviving crew member (missing crew rejoin on arrival and count) | by final health: ≥ 75 → 500, ≥ 50 → 400, ≥ 25 → 300, else 200 |
| The ship | 50 |
| Each ion drive owned (offline drives count) | 4 |
| Each spare part in the hold (plate, pump, gyro; max 3 per type) | 2 |
| Each EVA suit | 2 |
| Drone charges | 1 per 50 charges |
| Rations | 1 per 25 ration-days |
| Credits | 1 per 5 cr |
| **(Subtotal + bonuses) × profession multiplier** | ×1 Executive, ×2 Engineer, ×3 Farmer |

Bonus (ours), added before the multiplier: arrival date before 15 September 2184 (flare season) +200; zero crew deaths all trip (drift losses count as deaths) +300.

## Worked example
Engineer, 4 survivors (Good, Good, Fair, Poor) = 1,700; ship 50; 3 drives 12; 2 spares 4; 7 suits 14; 80 charges 1; 120 rations 4; 0 cr 0 → subtotal 1,785. Arrived 2 Sept: +200. (1,785 + 200) × 2 = **3,970, Spacer**. A careful Executive lands ~2,300–3,000 (Groundling/Spacer); Pathfinder needs a multiplier and a healthy crew.

## Ratings
| Score | Title |
|-------|-------|
| ≥ 6,000 | Pathfinder |
| ≥ 3,000 | Spacer |
| < 3,000 | Groundling |

## High scores (M5)
Top ten in `localStorage` with name, profession, score, date, days taken. Seeded defaults are wry fictional crews so the list is never empty.
