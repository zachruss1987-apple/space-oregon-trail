# Travel (the daily tick)

One tick = one day. Terms: **segment n** is the leg from waypoint n−1 to waypoint n (`trail.md`); `state.segment` is the index of the next waypoint (1–16). A **moving day** is a tick on which the ship covers distance > 0.

## Order of operations in `tick(state, rng)`
1. `day += 1`, date += 1 day.
2. Weather roll (see Weather Markov chain below).
3. Passing help: if a part is broken with no matching spare, 10% chance a passing crew fixes one broken part (pump first, then hull plate, then gyro). If the ship has 0 drives (stranded), 10% chance a passing hauler gives 1 drive; otherwise `strandedDays += 1`.
4. Distance (see Distance). If the day is a delay, rest, scan, or repair day, distance is 0. Clamp to the remaining segment distance; overflow is lost.
5. Consume rations (see Rations). Shortfall → starving day.
6. Suit wear: on a Solar storm or Flare day, 25% chance to lose 1 EVA suit (if any).
7. Health update for every present crew member (`health.md`), then condition death rolls and progression.
8. Missing crew: decrement `awayDays`; at 0 they rejoin.
9. Random event roll (`events.md`): 15% (7.5% on rest days); at most one per day.
10. Arrival check: if the segment is complete, set `state.arrivedAt = waypoint`, if it is a hazard set the pending crossing (`hazards.md`; M1: resolve the `trail.md` roll), if a road station generate trade offers (`economy.md`), and pause for the waypoint scene.
11. Game-over check (`health.md`).

Day-consuming actions (Rest, Scan for salvage, Attempt repair, delay days from events/hazards) are ordinary ticks with distance 0, so every rule above still applies to them.

## Thrust (pace)
| Setting | Homage | Base Mk/day | Health effect/day (moving days only) | Other |
|---------|--------|-------------|--------------------------------------|-------|
| Cruise | Steady | 22 | 0 | |
| Hard burn | Strenuous | 27 | −2 | |
| Overburn | Grueling | 33 | −5 | drive_failure weight ×2; 5 consecutive moving days → Exhaustion |

## Distance
`distance = base × driveFactor × weatherFactor × massFactor × damageFactor`, not rounded internally; display `floor`.

| Factor | Values |
|--------|--------|
| driveFactor (working drives = owned − offline) | 0 → 0, 1 → 0.6, 2 → 0.85, 3 → 1.0, 4+ → 1.1 |
| weatherFactor | Weather table below |
| massFactor | `1 − min(0.15, 0.05 × max(0, rations − 1000) / 1000)` (continuous) |
| damageFactor | coolant pump broken → 0; else hull plate broken → 0.5; else 1 |

## Rations
| Setting | Homage | Per present crew/day | Health effect/day |
|---------|--------|----------------------|-------------------|
| Full | Filling | 3 | +2 |
| Half | Meager | 2 | 0 |
| Paste | Bare bones | 1 | −2 |

Daily need = present crew × per-crew amount; Farmer: `floor(need × 0.65)`, minimum 1 (five crew: Full 9, Half 6, Paste 3). Rations are integers. If `rations < need`, eat what is left (rations → 0); it is a **starving day**: every present crew member takes −10 instead of the ration effect. Missing crew eat nothing.

## Weather
| Weather | Speed factor | Health/day unsuited (suited) | Side effects |
|---------|--------------|------------------------------|--------------|
| Calm | 1.0 | 0 | none (flavor) |
| Fair | 1.0 | 0 | none |
| Unsettled | 0.9 | −1 (−1) | hull_puncture weight ×1.5; micrometeorite puncture eligible |
| Solar storm | 0.6 | −3 (−1) | 25% suit loss (step 6); each unsuited crew 15% radiation sickness |
| Ion fog | 0.7 | 0 | lost_lane and gyro_failure weights ×2 |
| Flare | 0.5 | −5 (−2) | as Solar storm; only in segments 14–16 |

**Suited:** if EVA suits ≥ present crew, everyone is suited; otherwise the first `suits` present crew in roster order (captain first) are suited.

### Weather Markov chain
Each day: with probability **0.6** tomorrow keeps today's weather (persistence), unless today's weather is not allowed in tomorrow's phase (Flare outside segments 14–16), in which case redraw. Otherwise draw from the phase row below (the draw may repeat today's state). Weights are percentages.

| Phase | Row | Calm | Fair | Unsettled | Solar storm | Ion fog | Flare | Mean speed |
|-------|-----|------|------|-----------|-------------|---------|-------|-----------|
| Early (segments 1–5) | Window 1 (Mar) | 5 | 25 | 30 | 30 | 10 | 0 | 0.82 |
| | Window 2 (Apr) | 10 | 35 | 30 | 15 | 10 | 0 | 0.88 |
| | Window 3 (May) | 15 | 50 | 20 | 8 | 7 | 0 | 0.93 |
| | Window 4 (Jun) | 20 | 50 | 18 | 6 | 6 | 0 | 0.94 |
| | Window 5 (Jul) | 35 | 45 | 12 | 4 | 4 | 0 | 0.96 |
| Mid (segments 6–13) | all windows | 15 | 45 | 20 | 10 | 10 | 0 | 0.91 |
| Late (segments 14–16) | before flare season | 10 | 40 | 20 | 10 | 10 | 10 | 0.86 |
| | in flare season | 5 | 20 | 20 | 10 | 5 | 40 | 0.73 |

**Flare season** begins **15 September 2184** (on or after that date; it does not end within any run). Day 0 weather is Fair.

## Resting
"Rest" asks for 1–9 days and runs them as consecutive ticks: distance 0, no thrust effect, health +3/day (+6 if at a station: arrived and not yet departed), condition durations tick down 2 per day, event chance 7.5%. Rest stops early only on a death or game over.

## Repairs ("Attempt repair")
Menu lists broken parts (hull plate, coolant pump, nav gyro); disabled with a message if none is broken. Takes 1 day. Requires the matching spare; without one the option shows "No spare" and does nothing.

| | Default | Ship Engineer |
|--|---------|---------------|
| Success chance | 80% | 95% |
| Spare consumed on success | yes | yes |
| Spare consumed on failure | 30% | 10% |
| Modifier | −10 points if any present crew has Decompression injury | same |

Ion drives are never repaired: drive_failure destroys one, drive_stall heals by itself.

## Scan for salvage (M1 auto-resolve)
Available when drone charges ≥ 5 and the ship is not at New Willamette. Takes 1 day; consumes 5 charges; then roll d100:

| d100 | Yield |
|------|-------|
| 01–25 | Nothing |
| 26–70 | 25–60 rations |
| 71–95 | 60–120 rations |
| 96–00 | 1 random spare part (plate/pump/gyro); if that type is at its cap of 3, 60–120 rations instead |

Diminishing returns: the 3rd and later scans in the same segment halve ration yields (floor). Expected yield ≈ 42 rations per scan (first two per segment). M3: the Salvage Run mini-game (`minigames.md`) replaces this in play; this roll stays as its auto-resolve and the reference policy's scan.

## Worked example (typical budgets and day counts)
The M1 design-side sketch, kept for its budget arithmetic; the measured numbers live in `docs/reports/balance-tuned.md` (T-039), which is the authority. Since T-039 the Engineer starts with 650 cr (1,300 rations after the reference kit) and the Farmer eats `× 0.65`.

| | Executive (1,600) | Engineer (650) | Farmer (400) |
|--|-------------------|----------------|--------------|
| Ion drives | 4 = 160 | 3 = 120 | 3 = 120 |
| EVA suits | 10 = 100 | 10 = 100 | 5 = 50 |
| Spare parts | 2 each = 60 | 1 each = 30 | 1 each = 30 |
| Drone charges | 5 boxes = 10 | 5 boxes = 10 | 10 boxes = 20 |
| Rations at 0.30 | 3,000 = 900 | 1,300 = 390 | 600 = 180 |
| Credits left | 370 | 0 | 0 |
| Plan | Full, Cruise | Full while surplus, else Half | Half + ~20 scans |
| Full for whole trip? | yes (15/day × 150 = 2,250) | no (needs 2,250, has 1,300) | no (Half needs 6/day) |
| Typical days (reference policy, T-039) | ~184 | ~157 | ~171 |
| Win rate (reference policy, T-039) | ~63% | ~51% | ~32% |

Day count, Cruise, 3 drives, mid-trail weather: 22 × 1.0 × 0.91 × ~0.95 mass ≈ 19 Mk/day → 2,040 / 19 ≈ 107 moving days, plus ~8 days lost to arrival overflow, ~4 repair days, ~6 delay days, and 30–45 rest/scan days → **150–185 days** (measured, reference policy: Engineer ~157, Farmer ~171, Executive ~184, slowed by 3,000 rations of mass). Hard burn saves ~20 days at −2 health/day; Overburn is a sprint, not a policy.

Windows vs flare season at ~170 days: Window 1 arrives ~mid-August (safe), Window 2 ~mid-September (a race: Hard burn makes it), Window 3 meets the first flares on the last segments, Windows 4–5 always meet flare season.

**M1 playthrough reference policy** (for `playthrough.test.ts`): uniform random profession and window; buy 3 drives, 10 suits (8 if Farmer; 5 before T-039), 1 of each part, 5 boxes of charges, rations with the remainder (cap 3,000); Cruise; Half rations (Paste when < 10 days left); rest 1 day whenever general health is below 50; scan whenever rations < 10 days and charges ≥ 5. Measured after T-039 (300 seeds × 5 windows per profession): 48.7% win (Executive 63.3%, Engineer 51.1%, Farmer 31.7%), mean 170.5 days.
