# Travel (the daily tick)

One tick = one day. Order of operations in `tick(state, rng)`:
1. Weather roll for the day (depends on launch window, segment, season).
2. Distance = base × thrust × drive factor × weather factor × mass factor × damage factor. Clamp to remaining segment distance.
3. Consume rations (see `resources.md`). If rations hit 0, crew starve: health −10/day each.
4. Health update for every living crew member (`health.md`).
5. Illness progression and recovery.
6. Random event roll (`events.md`): at most one event per day, chance 25% base.
7. Arrival check: if the segment is complete, set `state.arrivedAt = waypoint` and pause for the waypoint scene.
8. Death/game-over check.

## Thrust (pace)
| Setting | Homage | Base Mk/day | Health effect/day |
|---------|--------|-------------|-------------------|
| Cruise | Steady | 12 | 0 |
| Hard burn | Strenuous | 16 | −2 |
| Overburn | Grueling | 20 | −5, drive failure chance ×2 |

Drive factor: 1 drive 0.6, 2 drives 0.85, 3 drives 1.0, 4+ drives 1.1.

## Rations
| Setting | Homage | Per crew/day | Health effect/day |
|---------|--------|--------------|-------------------|
| Full | Filling | 3 | +1 |
| Half | Meager | 2 | −1 |
| Paste | Bare bones | 1 | −3 |

## Weather
| Weather | Speed factor | Health/day | Notes |
|---------|--------------|------------|-------|
| Calm | 1.0 | 0 | |
| Fair | 1.0 | 0 | |
| Unsettled | 0.9 | −1 | Suit loss chance |
| Solar storm | 0.6 | −3 (−1 with suits) | Can trigger radiation sickness |
| Ion fog | 0.7 | 0 | Nav gyro failure chance ×2, "lost the Lane" |
| Flare | 0.5 | −5 (−2 with suits) | Only in last three segments, more in late windows |

Weather Markov chain per window in `src/content/windows.ts`: each window defines weights for each weather state and a persistence probability (chance that tomorrow equals today, ~0.6).

## Resting
"Rest" skips 1–9 days: no distance, rations consumed, health +3/day (×2 at stations), illnesses recover faster. Events still roll at half rate.

## Repairs
"Attempt repair" when a part is broken: needs the matching spare; success 80% (Engineer 95%); failure consumes the part anyway with 30% chance. Without a spare, each day there is a 10% chance a passing crew helps (homage: "a passerby helped fix your wagon").
