# Hazards

Hazard crossings (M2): four choices, a readout, outcomes. Also the Titan Refinery route branch. Hazard parameters: `trail.md`. Severity table: `trail.md` (reused unchanged). Beacons: `beacons.md`.

## Flow
1. **Arrival** (tick step 10): instead of the M1 auto-roll, set `state.crossing = { waypoint, density, pilotDaysLeft: null }` and pause. `density` = today's density, rolled once on arrival (below). Log kind `arrival` as before.
2. **HazardScene** shows the blurb, the readout and the four options. While a crossing is pending, `setThrust`, `setRations`, `rest` (+3/day, not a station), `repair` and `scan` are allowed; `continue` is refused: `"Choose how to cross first."`
3. **Choose**: intent `{ type: 'cross', method: 'thread' | 'shields' | 'tug' | 'pilot' }`. Resolution costs no day (except pilot wait days and a Scraped delay day). Then `crossing = null`, `justCrossedHazard = true`, the ship stays parked (`arrivedAt`), outcome modal, `Continue` departs.

## Today's density
On arrival, d100: 01–25 → nominal − 1; 26–75 → nominal; 76–100 → nominal + 1; clamp 1–5. The Flare Belt is always 5 (no roll). `densityFactor = 1 + 0.2 × (density − nominal)` → 0.8 / 1.0 / 1.2.

## Incident chance (percent)
`base = baseline + window + route + flare`:

| Term | Value |
|------|-------|
| baseline | `trail.md` (15 / 15 / 35 / 25 / 35 / 45) |
| window | Window 1 +10, Window 2 +5 at Lunar Debris Ring and Lagrange Shoals (unchanged from M1) |
| route | +10 at Proxima Heliopause Shock if `route = 'direct'` |
| flare | +15 at The Flare Belt in flare season (unchanged) |

`ship` = +10 if hull broken, +10 if nav gyro broken, +10 if working drives ≤ 1.

| Option | Incident chance | Severity roll (d100, then clamp 1–100) | Other cost |
|--------|-----------------|----------------------------------------|------------|
| Thread it | `T = min(95, round(base × densityFactor) + ship)` | +5 if today's density ≥ 4 | none |
| Shields up and push | `round(T × 0.5)` | +5 if density ≥ 4, **−10** (max 95: never Lost) | after the crossing, **15%** coolant pump breaks (coolant stress) unless already broken |
| Hire a tug | 0 | — | credits: tug price, ×1.5 in flare season (round half up) |
| Wait for a Belter pilot | 3 (flat, no modifiers) | **−20**, no density bonus (max 80: never Injury or Lost) | wait days (`trail.md`) + 10 cr |

Rounding is half up. Severity bands and their effects are the `trail.md` table (Scraped / Cargo loss / Damage / Injury / Lost), with the same random picks as M1.

## Availability
| Option | Offered at | Requires (else dimmed with message) |
|--------|-----------|-------------------------------------|
| Thread it | all 5 hazards + Flare Belt | ≥ 1 working drive and pump not broken: `"Your ship cannot move."` |
| Shields up and push | all 5 hazards (not Flare Belt in M2) | same as Thread |
| Hire a tug | all 5 hazards + Flare Belt (M3: the Flare Belt lists it as "Pay the tug", `minigames.md`) | credits ≥ price: `"You cannot afford a tug."` |
| Wait for a Belter pilot | **The Belt Crossing (4 days), Saturn Ring Plane (3 days)** only | credits ≥ 10: `"You cannot afford a pilot."`; elsewhere `"No Belters work this stretch."` |

The tug and the pilot tow or fly any ship, broken or not. If every offered option is blocked, the player can still Rest or Repair (passing help, `travel.md`), so a pending crossing never soft-locks.

**Pilot flow**: first `cross pilot` pays 10 cr, sets `pilotDaysLeft = wait`, then runs wait days as ordinary ticks with distance 0 (normal 15% event chance, no rest bonus, rations eaten), decrementing `pilotDaysLeft`. It stops early on a death or game over (like rest); calling `cross pilot` again resumes without paying. When it reaches 0, the 3% roll resolves in the same call. While `pilotDaysLeft > 0`, other `cross` methods are refused: `"You already sent for a pilot."`

**The Flare Belt in M2** (fallback until the M3 finale): options are Thread it, which is exactly the M1 roll (base 45, +15 flare season; severity +5, +10 flare season; no density roll, no ship modifier), and Hire a tug (120 cr; 180 in flare season). Shields and pilot are shown dimmed: `"Not in this weather."`

## Tug prices (cr)
| Hazard | Normal | Flare season (≥ 15 Sep 2184) |
|--------|--------|------------------------------|
| Lunar Debris Ring | 25 | 38 |
| Lagrange Shoals | 35 | 53 |
| The Belt Crossing | 80 | 120 |
| Saturn Ring Plane | 60 | 90 |
| Proxima Heliopause Shock | 90 | 135 |
| The Flare Belt | 120 | 180 |

In practice only the last two meet flare season.

## Readout (shown before choosing)
```
THE BELT CROSSING
Density 5 of 5 (thicker than usual)  [#####]
Ship: hull OK  pump OK  gyro BROKEN  drives 3 working
Credits: 212 cr
1 Thread it                                Risk: Severe
2 Shields up and push (strains the pump)   Risk: High
3 Hire a tug (80 cr)                       Risk: None
4 Wait for a Belter pilot (4 days, 10 cr)  Risk: Low
```
Density trend word vs nominal: thinner than usual / usual / thicker than usual. **Risk word** from the option's incident chance: 0 → None; 1–9 → Low; 10–24 → Moderate; 25–44 → High; ≥ 45 → Severe. Percentages are never shown (imperfect information). Blocked options are dimmed with their message instead of a risk word.

## Text keys (ui.json, writer)
Outcomes reuse `crossing.clear | scraped | cargo | damage | injury | lost` (placeholders unchanged). New block `hazard`:

| Key | Count | Placeholders |
|-----|-------|--------------|
| `hazard.option.thread / shields / tug / pilot` | 1 each | — |
| `hazard.thread[]`, `hazard.shields[]` (narration before the outcome) | ≥ 2 | — |
| `hazard.tug[]` | ≥ 2 | `{n}` = price |
| `hazard.pilotHire[]` | ≥ 2 | `{n}` = wait days |
| `hazard.pilotArrives[]` | ≥ 2 | — |
| `hazard.pumpStrain[]` | ≥ 2 | — |
| `hazard.density.thinner / usual / thicker` | 1 each | — |
| `hazard.risk.none / low / moderate / high / severe` | 1 each | — |
| `hazard.blocked.cantMove / noTug / noPilot / noBelters / notHere / chooseFirst / pilotSent` | 1 each | — |
| `route.prompt`, `route.oort`, `route.direct` | 1 each | `{n}` = Mk |
| `route.chosen.oort[]`, `route.chosen.direct[]` | ≥ 2 | — |

## Log entries
One crossing appends, in order: kind `crossing`, id = method (`thread shields tug pilot`; text from `hazard.<method>`, pilot wait days log `pilot-wait` per day as kind `crossing`); kind `hazard`, id = outcome (`clear scraped cargo damage injury lost`); then, for shields only if it happens, kind `hazard`, id `pump-strain`. Tug and pilot outcomes are still logged (`clear`, or the rolled band for the pilot).

## RNG draw order (for reproducible seeds)
Arrival: 1 draw (density; none at the Flare Belt). Thread/shields: incident draw; if incident, severity draw then the outcome's M1 picks; shields then 1 pump-strain draw. Tug: none. Pilot: the wait ticks' own draws, then incident draw (+ severity and picks if hit).

## Route branch (Titan Refinery)
- State `route: 'oort' | 'direct'`, initial `'oort'`.
- Intent `{ type: 'route', via: 'oort' | 'direct' }`, 0 days, allowed only while parked at Titan Refinery (waypoint 10); may be changed until departing. Elsewhere: `"The branch is behind you."` (or not yet reached). Log kind `route`, id = via.
- Continue at Titan (Waypoint or Station scene) first shows the prompt: **Via Oort Beacon** (one more station; 274 Mk from the Gate to the Heliopause) / **Direct** (160 Mk from the Gate, no resupply, the Heliopause is worse). Default highlight: via Oort.
- `direct`: after the Kuiper Gate (11) the next waypoint is 13; segment 13 is still 160 Mk (measured from the Gate). Trail total **1,926 Mk** instead of 2,040. Heliopause base incident +10 (35 → 45, Severe before density).
- Map: both rows are listed. Oort Beacon's status column: `branch` before the choice, `via Oort` once chosen, `skipped` if direct. Header total shows 1,926 when direct. A line under the list: `Direct: Kuiper Gate -> Heliopause 160 Mk`.
- Weather phases, scoring and beacons use waypoint indices, so they are unaffected.

## State and intents summary (all M2)
| Field | Type | Set / cleared |
|-------|------|---------------|
| `crossing` | `{ waypoint: number; density: number; pilotDaysLeft: number \| null } \| null` | set on hazard arrival; null after resolution |
| `route` | `'oort' \| 'direct'` | `'oort'` at start; `route` intent at Titan |
| `station` | `{ waypoint: number; offers: TradeOffer[] } \| null` | set on road-station arrival (`economy.md`); null on departure |

Bump `STATE_VERSION`. New intents (all via `applyAction`): `cross` (0 days; pilot n), `route` (0), `buy`, `sell`, `trade` (0, `economy.md`). New log kinds: `crossing`, `route`, `trade` (`store` already exists).

## Worked examples
- **Belt Crossing, intact ship, usual density 4**: Thread 35% (Lost on 10% of incidents → 3.5% to lose a crew member); Shields 18%, no deaths, plus 15% pump; Tug 80 cr; Pilot 4 days (~40 rations at Half for five), 10 cr, 3%.
- **Same, density 5 and gyro broken** (readout above): Thread round(35 × 1.2) + 10 = 52 → Severe; Shields 26 → High.
- **Lunar Debris Ring, Window 1, density 1**: base 25 × 0.8 = 20 → Moderate; Shields 10 → Moderate; Tug 25 cr; no pilot.
- **Heliopause, direct route, flare season, density 4**: Thread 45 → Severe; Shields 23 → High; Tug 135 cr.

## Reference policy (auto-play, balance)
Pilot if offered and credits ≥ 10; else tug if credits ≥ 2 × price; else shields if a spare pump is held; else thread. Route: always via Oort. Tests: per-option incident rates within ±2 points over 10,000 seeded crossings; shields and pilot never produce `lost`.
