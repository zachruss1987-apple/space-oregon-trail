# Random events

One roll per tick: 15% chance an event fires (7.5% on rest days). Candidates are filtered by `condition`, then picked by effective `weight` (base × listed modifiers). Effects are pure state changes. Text has `{name}`, `{n}`, `{item}` placeholders. Content lives in `src/content/events.json`; this table is the spec.

"Segment" means `state.segment`, the index of the next waypoint (`travel.md`). "Random crew" = uniformly random present crew. Percent losses are `floor(qty × pct)`, minimum 1 when qty > 0. Ranges are inclusive integers.

| id | Homage | Weight | Condition / modifiers | Effect |
|----|--------|--------|-----------------------|--------|
| illness | Illness | 20 (Good), 30 (Fair), 40 (Poor or Very poor) by general health | a present crew member has room for a condition | Pick condition from the illness pool below, then a random eligible present crew member; they gain it |
| pirates | Thief | 6 | segment ≥ 3 | Pick one type with qty > 0 among rations, suits, charges, plates, pumps, gyros; lose 10–30% of it |
| lost_lane | Lost trail | 6 | ×2 in Ion fog; ×2 if nav gyro broken | Next 1–3 ticks are delay days (distance 0) |
| drive_failure | Ox died | 4 | ≥ 1 drive; ×2 on Overburn; ×0.5 for Engineer | One drive destroyed (a working one if any). At 0 drives the ship is stranded |
| drive_stall | Ox injured | 6 | ≥ 1 working drive | One working drive offline for 1–3 days |
| hull_puncture | Wheel breaks | 6 | hull not broken; ×1.5 in Unsettled, Solar storm, Flare | Hull plate broken |
| pump_failure | Axle breaks | 5 | pump not broken | Coolant pump broken: no movement until repaired |
| gyro_failure | Tongue breaks | 4 | gyro not broken; ×2 in Ion fog | Nav gyro broken |
| hull_fire | Wagon fire | 3 | | Lose 5–15% rations and 1 suit (if any); a random crew member −10 health |
| crew_eva_drift | Member wanders off | 3 | ≥ 2 present crew | Random crew member away 1–4 days; 5% instead they never return (death, cause `drift`) |
| bad_recycler | Bad water | 6 | | All present crew −5 health; dysentery pool weight ×3 for the next 3 days |
| derelict | Abandoned wagon | 4 | segment ≥ 2 | 50% nothing; otherwise sub-roll: 50% 20–60 rations, 25% 1 random spare part (at cap 3 → 20–60 rations), 25% 1–2 suits |
| algae_bloom | Wild fruit | 5 | | Gain 20–60 rations (Farmer ×1.5, floor) |
| belter_help | Help finding food | 3 | segment 5–9 | Gain 40–80 rations |
| cargo_shift | Lost supplies in river | 3 | first tick after leaving a hazard waypoint | Pick one of rations, suits, charges with qty > 0; lose 5–10% |

Not table events: solar storms, flares and ion fog are weather (`travel.md`). **quiet_day**: on a tick with no event, 10% chance to log a flavor line with no effect.

## Illness pool
Used by the `illness` event. Pick a condition by weight, then a present crew member who has fewer than 2 conditions and not that one. If none qualifies, the day is a quiet day.

| Condition | Weight | Eligible / modifiers |
|-----------|--------|----------------------|
| Space dysentery | 6 | ×2 on Paste; ×3 for 3 days after bad_recycler |
| Hull mold fever | 3 | ×2 once segment ≥ 10 (past Saturn Ring Plane) |
| Cryo-fever | 4 | ×2 if general health is Poor or Very poor |
| Scurvy | 4 | only after 10+ consecutive days on Half or Paste |
| Micrometeorite puncture | 3 | only in Unsettled, Solar storm, or Flare weather |

Radiation sickness, exhaustion and decompression injury are never rolled here (`health.md` triggers).

## Cadence guard
**Loss events**: pirates, lost_lane, drive_failure, drive_stall, hull_puncture, pump_failure, gyro_failure, hull_fire, crew_eva_drift, bad_recycler, cargo_shift. When one fires on day d, set `eventCooldownUntilDay = d + 3`; while `day < eventCooldownUntilDay`, loss events are filtered out unless thrust is Overburn or rations are Paste. Illness and gains are never filtered. This is the main anti-frustration lever; tune in M5.

## Text
Each event has ≥ 2 text variants; losses name the thing lost in numbers ("Pirates boarded while you slept and took 212 rations."). Flavor lines are where the humor lives; see `writing.md`.
