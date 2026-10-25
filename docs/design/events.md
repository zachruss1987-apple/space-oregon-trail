# Random events

One roll per travel day: 25% chance an event fires (12.5% while resting). Candidates are filtered by `condition`, then picked by `weight`. Effects are pure state changes. Text has `{name}`, `{n}`, `{item}` placeholders. Content lives in `src/content/events.json`; this table is the spec.

| id | Homage | Weight | Condition | Effect |
|----|--------|--------|-----------|--------|
| illness.* | Illness | 20 total | per `health.md` | Random living crew gets the condition |
| pirates | Thief | 6 | after segment 2 | Lose 1 random supply type: 10–30% of it |
| lost_lane | Lost trail | 6 | Ion fog or gyro broken ×2 | Lose 1–3 days |
| drive_failure | Ox died | 5 | drives ≥ 1; ×2 on Overburn | One drive destroyed; if 0 remain, stranded |
| drive_stall | Ox injured | 6 | | One drive offline 1–3 days (speed drop) |
| hull_puncture | Wheel breaks | 6 | Unsettled+ ×1.5 | Hull plate broken; needs spare |
| pump_failure | Axle breaks | 5 | | Coolant pump broken; travel halts until repaired |
| gyro_failure | Tongue breaks | 4 | | Nav gyro broken; lost_lane ×2 until repaired |
| hull_fire | Wagon fire | 3 | | Lose 5–15% rations and 1 suit; small health hit |
| crew_eva_drift | Member wanders off | 3 | crew ≥ 2 | Crew member missing 1–4 days (no rations consumed by them); 5% never returns |
| bad_recycler | Bad water | 6 | | All crew −5 health; dysentery chance ×3 next 3 days |
| derelict | Abandoned wagon | 4 | after segment 1 | Gain random supplies (parts or rations) or nothing (50%) |
| algae_bloom | Wild fruit/berries | 5 | | Gain 20–60 rations (Farmer ×1.5) |
| belter_help | Indians help find food | 3 | segments 5–9 | Gain 40–80 rations |
| solar_storm_sting | Hail/blizzard | — | weather only | Handled by weather, not events |
| cargo_shift | Lost supplies in river | 3 | day after any hazard | Lose 5–10% of one supply |
| quiet_day | (none) | — | | Flavor line only, no effect: used to keep the log lively when nothing happens (10% of event-free days) |

## Cadence guard
No more than one "loss" event in any 3-day window unless the player is on Overburn or Paste. Implemented as a cooldown in state (`eventCooldownUntilDay`). This is the main anti-frustration lever; tune in M5.

## Text
Each event has ≥ 2 text variants; losses name the thing lost in numbers ("Pirates boarded while you slept and took 212 rations."). Flavor lines are where the humor lives; see `writing.md`.
