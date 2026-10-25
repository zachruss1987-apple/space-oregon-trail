# Mini-games (M3)

Three real-time Phaser scenes: **Salvage Run** (hunting), **Debris Threading** (a hazard's "Thread it"), **Flare Belt Finale** (the Columbia raft). Each reads `GameState`, plays, and hands the sim one plain **result object**. The sim never imports a scene and never needs a result: every mini-game has an **auto-resolve** (the M1/M2 statistical rule), used by `runPolicy`, the Options flag, and skip.

## Shared rules
| Topic | Rule |
|-------|------|
| Canvas | 640×400. HUD strip y 0–23 (charges / HP / haul / hits, timer `0:27`, pause icon top-right 24×24 for touch). Play field 640×376 below it. |
| Start / end | 3-2-1 countdown (1.5 s, not counted). Timer runs out, or the run ends early (drone wrecked, crash). Result panel lists the outcome in numbers; Enter / tap returns to Travel or Hazard. |
| Timestep | Fixed 60 Hz simulation inside the scene (render may vary). Positions, spawns and collisions update per step, so the same seed + same inputs = the same run at any frame rate. |
| Keyboard | Arrows / WASD move, Space fires (Salvage only), Esc pauses, Enter confirms panels. |
| Touch | Drag anywhere: the craft accelerates toward the finger (offset 40 px above it so it stays visible). Tap (press < 200 ms, moved < 10 px) fires toward the tap point (Salvage). Pause icon. |
| Gamepad (optional) | Left stick / d-pad move, A fires, Start pauses. |
| Pause (Esc) | Freezes the timer and steps. Menu: **Resume** / **Skip (auto-resolve, with penalty)** / **Controls**. `body[data-paused="1"]` while open. |
| Skip with penalty | Abandons the run (any haul or progress is discarded) and resolves exactly as auto-resolve with the penalty in each section ("+10 incident" or −10 on the salvage d100). Log adds kind `info`, id `skipped`. |
| Options flag | `autoResolveMiniGames` (default `false`) in `localStorage['proxima.options']`; Options label "Mini-games: Play / Auto-resolve". URL `?minigames=auto` forces it on for one session (e2e). When on, no mini-game scene opens and auto-resolve runs **without** the penalty. |
| Mini-game RNG | `createRng(seedFromString(seed + ':' + kind + ':' + day))`; `seed` = the run's seed label (`__PROXIMA__.seed`, stored as `state.seed`), `kind` = `salvage` / `threading` / `flare`, `day` = `state.day` at launch. Used only inside the scene (spawns, drift, sizes). The main `Rng` is not touched until the result is applied. |
| Sim application | The result goes in an intent (below); the sim validates and clamps it, then draws from the main `Rng` for victims and rolls. Results are counts, never crew picks. |
| Scenes | `body[data-scene]`: `Salvage`, `Threading`, `Flare`. |

### State additions (bump `STATE_VERSION` to 3)
| Field | Type | Notes |
|-------|------|-------|
| `seed` | `string` | Set by `createGame` (UI passes the label); v2 saves migrate with `''` (mini RNG then hashes `':salvage:41'`, still deterministic). Not used by the main Rng. |
| `rodeTheWind` | `boolean` | `false` at start; true after a clean Flare Belt mini-game. Scoring bonus. |

## 1. Salvage Run
Trigger: Travel menu "Scan for salvage" (1 day). Needs ≥ 1 charge (auto-resolve still needs 5) and not at New Willamette. Confirm: "Launch the drone? It takes the day."

### Arena and drone
| Item | Value |
|------|-------|
| Duration | 40 s |
| Ship | Docked at the left edge (x 0–40, art only). Drone starts at (64, 200), facing right. Field edges are walls. |
| Drone movement | Max speed 160 px/s; acceleration 420 px/s² toward input; drag 300 px/s² with no input (inertia: ~0.5 s to stop). Hitbox circle r 6. |
| Drone HP | 3. A tumbler hit costs 1 HP, knocks back 120 px/s, then 1.0 s invulnerable (blinks). HP 0 = **wrecked**: run ends, every haul count halved (floor). |
| Grapple | Fires toward facing (last 8-way input direction) or the tap point. Cable flies 500 px/s to range **140 px**, hooks the first debris it crosses, reels in over 0.5 s (drone at half speed meanwhile). **Cooldown 0.8 s** from firing. **1 charge per shot**, hit or miss. |
| Charges available | `min(state.supplies.charges, 20)`; at 0 left the grapple clicks ("Out of charges.") and the run continues until time or Esc. |
| Haul | An item counts when reeled in. Carry limit checked at the end (like the original's walk back). |

### Debris spawn table
Debris drifts in from the right edge (y uniform 40–376, heading 180° ± 20°) and despawns off-screen. A new piece spawns whenever the field holds fewer than the **target population** (difficulty table), at most one per 0.25 s.

| Type | Look | Yield when reeled in | Weight | Radius px | Drift px/s |
|------|------|----------------------|--------|-----------|-----------|
| Ration crate | small box | 5 rations | 30 | 6 | 30–50 |
| Ration pallet | stacked boxes | 15 rations | 15 | 10 | 15–30 |
| Galley pod | round module | 30 rations | 5 | 14 | 10–20 |
| Hull plate | flat slab | 1 plate | 4 | 10 | 20–35 |
| Coolant pump | cylinder | 1 pump | 3 | 7 | 25–40 |
| Nav gyro | ringed sphere | 1 gyro | 3 | 6 | 30–50 |
| Scrap | jagged grey bits | nothing ("Scrap. Lovely.") | 25 | 5–12 | 20–45 |
| Tumbler (hazard) | spinning chunk | contact: drone −1 HP; grapple: cable snaps, nothing | 10 | 12 | 40–70 |
| Hot chunk (hazard) | green glow | contact or reel-in: `crewHurt += 1`, chunk vanishes, nothing | 5 | 8 | 20–40 |

Weights sum to 100. A part whose hold is at its cap of 3 (counting the haul so far) shows "Hold full", stays put, and the shot is spent.

### Carry limit (100 units)
| Item | Units each |
|------|-----------|
| Ration | 1 |
| Plate / pump / gyro | 10 |

At the end, if the haul weighs more than 100, keep gyros, then pumps, then plates (each while it fits), then rations to fill the rest. The panel shows the excess: "You could only tow 100 units back. {n} rations drift off toward Neptune."

### Difficulty
| Factor | Target population | Other |
|--------|-------------------|-------|
| Segments 1–5 (near Earth) | 10 | |
| Segments 6–13 (belt and moons) | 12 | part weights ×1.5 (more wrecks) |
| Segments 14–16 (deep Lane) | 8 | drift ×1.2 |
| Calm / Fair | — | none |
| Unsettled | — | tumbler weight ×1.5 |
| Ion fog | — | items beyond 150 px of the drone draw as grey blips (type unknown) |
| Solar storm / Flare | — | hot chunk weight ×3, drift ×1.2 |

Weights are rescaled to 100 after multipliers.

### Result and application
`SalvageResult = { kind: 'salvage', rations, plates, pumps, gyros, chargesUsed, crewHurt, droneWrecked? }` (counts after halving and the carry clamp).

Intent `{ type: 'salvage', result }` → `applySalvageResult(state, result, rng): StepResult`. One tick with distance 0 (day kind `salvage`, like `scan`; every other tick rule applies). In tick step 4:
1. Clamp: `chargesUsed` to `0..min(charges, 20)`; parts to cap 3 minus held; `crewHurt` to `0..3`; re-apply the carry clamp. Invalid shapes are refused (`error`, no day).
2. `charges −= chargesUsed`; `scansThisSegment += 1` (shared with `scan`); if it is now ≥ 3, `rations = floor(rations / 2)` (parts are not halved, as in `travel.md`).
3. Add rations and spares. For each `crewHurt`: random present crew −5 health (main Rng, 1 draw each), before the health step.
4. Log kind `salvage`, id `haul` ("The drone towed in {n} rations and {parts}."), `nothing`, or `wrecked` (prefix line when `droneWrecked`); one `salvage` / `hot` line per hurt crew ("{name} handled something warm.").

Auto-resolve = the `travel.md` scan (5 charges, d100). Skip: same with d100 − 10 (clamp 1); with fewer than 5 charges it spends them all and finds nothing.

### Expected yield (calibration targets, for playtest)
| Player | Shots | Hooked | Typical haul | vs auto (27 rations, 5 charges) |
|--------|-------|--------|--------------|---------------------------------|
| Novice | 8–12 | 3–5 | 15–30 rations | worse or equal |
| Average | 10–14 | 6–8 | 35–50 rations, ~25% a part | ~1.5× per day, ~1× per charge |
| Skilled | 15–20 | 12+ | 100 (cap), or a part + 60–90 | carry cap binds; ~3.5× |

Aimed shots favour big targets: mean ration yield over ration items is (30×5 + 15×15 + 5×30) / 50 = 10.5, so 4 ration hooks ≈ 42. Charges cost 0.1 cr each; the day and the cap are the real limits.

## 2. Debris Threading
Trigger: Hazard scene "Thread it" at any of the five hazards (not the Flare Belt). Shields, tug and pilot stay statistical. `T` = the option's incident chance from `hazards.md` (base × densityFactor + ship modifiers, max 95).

### Play
| Item | Value |
|------|-------|
| Duration | 25 s side-scroll |
| Ship | Fixed x 96; free vertical movement y 32–368. Speed 200 px/s, accel 1,200 px/s², drag 1,500 px/s² (snappy). Hitbox 20×10. |
| Rocks | `R = clamp(round(T / 3), 4, 32)` per run, spread evenly over 1–24 s (±0.3 s jitter), y uniform. Radius `10 + 2 × density ± 4` px. Scroll `150 + 15 × density` px/s. Any 120 px of x holds at most 2 rocks and always leaves a gap ≥ 60 px. |
| Dust | Harmless parallax specks, count `20 × density` (feel only). |
| Hit | Rock shatters; 1.0 s invulnerable; HUD `HITS n`. Hits keep counting after 4 (no extra effect). |
| Ship state | Enters only through `T` (rock count). No handling penalty, so nothing is counted twice. |

### Hits → severity
| Hits | Effect (sim, main Rng) |
|------|-------------------------|
| 0 | Clean: outcome `clear`, plus the player's pick on the result panel: **+2 health all present crew** or **+10 rations** |
| 1–2 | One severity roll per hit: d100, +5 if density ≥ 4, **capped at 95** (never Lost) |
| 3+ | Hits 1–2 as above; the 3rd and 4th rolls are **uncapped** (Lost possible). At most 4 rolls. |

Bands and picks are `trail.md`'s (Scraped / Cargo loss / Damage / Injury / Lost). Several Scraped results still cost one delay day.

### Result and application
`ThreadingResult = { kind: 'threading', hits, bonus }`, `bonus: 'health' | 'rations' | null` (non-null only when `hits = 0`).

Intent `{ type: 'cross', method: 'thread', result }` → `applyThreadingResult`. The result **replaces the incident draw**; everything else is the M2 crossing (no day, `crossing = null`, `justCrossedHazard`, parked). RNG order: per hit in order, severity draw then that outcome's picks. Logs: `crossing` / `thread`; `threading` / `clean` or `hit` ("{n} hits."); then `hazard` / outcome per roll (`clear` once when clean). Without `result` the M2 statistical thread runs unchanged. Skip: statistical thread with `min(95, T + 10)`.

### Arithmetic: average player ≈ statistical
Calibration assumption: an average player is hit by **3%** of rocks (`P_HIT_AVG = 0.03`, playtest-tuned); a poor one 10%.

| Case | Statistical (M2) | Mini-game, average (p 0.03) | Mini-game, poor (p 0.10) |
|------|------------------|-----------------------------|--------------------------|
| Belt Crossing, density 4, intact: T 35, R 12 | 35% incident, 1 roll; Lost 3.5% | E[hits] = 12 × 0.03 = 0.36; P(≥1 hit) = 1 − 0.97¹² = 31%; Lost ≈ 0.05% | E 1.2; P(≥1) 72%; P(≥3) 11%; Lost ≈ 1.2% |
| Lunar Ring, density 1: T 20, R 7 | 20% incident | E 0.21; P(≥1) 19% | E 0.7; P(≥1) 52% |
| Density 5, gyro broken: T 52, R 17 | 52% incident | E 0.51; P(≥1) 40% | E 1.7; P(≥1) 83% |

Expected severity rolls (≈ `T/100`) match by construction (`R × 0.03 ≈ T/100`). Deaths shift toward players who take several hits: intended (choices and skill beat dice). The clean bonus adds about 0.69 × 10 ≈ +7 rations-equivalent per average crossing.

## 3. Flare Belt Finale
At waypoint 15 the Hazard scene shows two options (replacing M2's Thread/Tug labels; shields and pilot are not listed):

| # | Option | Rule |
|---|--------|------|
| 1 | Ride the solar wind | Mini-game (or auto-resolve). Intent method stays `thread`. Needs ≥ 1 working drive and pump not broken. Risk word from the M2 roll (Severe). |
| 2 | Pay the tug | `tug` exactly as M2: 120 cr, 180 in flare season. |

### Play
| Item | Value |
|------|-------|
| Duration | 45 s |
| Ship | Free 2D movement over the field. Speed 170 px/s, accel 900 px/s², drag 1,100 px/s². Hitbox circle r 7. |
| Flare arcs | Curved bands 24 px thick, edge to edge (quadratic Bezier, random ends on opposite or adjacent edges). Telegraph (dim outline) 1.0 s, then active 0.5 s, then fade. Interval from 2.0 s at start to 1.0 s at 45 s (linear): ~30 arcs. Overlapping arcs always leave a safe gap ≥ 64 px. |
| Flare season | Interval ×0.8 (~37 arcs), telegraph 0.8 s. |
| Flare weather today | Active time 0.7 s. |
| Hit | Ship flashes, 1.0 s invulnerable; HUD `HITS n/5`. **5 hits = crash**: the run ends at once. |

### Hit effects (sim, main Rng)
Hits 1–4: one d100 per hit, +10 in flare season (cap 100):

| d100 | Effect | Log id |
|------|--------|--------|
| 1–35 | Scorched cargo: one random type with qty > 0 among rations, suits, charges loses 10–25% (min 1) | `scorch` |
| 36–65 | Flash burn: random present crew −10 health (−5 if suited) | `burn` |
| 66–85 | Damage: as `trail.md` Damage (hull 50% / pump 25% / gyro 25%) | `damage` |
| 86–100 | Radiation: random unsuited present crew gains radiation sickness; none eligible or no room → random present crew −10 | `radiation` |

**Crash (5 hits)** replaces the per-hit effects: a random present crew member dies (cause `hazard`), rations, suits and charges each lose 50% (floor), one of each spare held is lost, and the hull plate breaks. The run is not over unless no crew remain.

**Clean run (0 hits)**: `rodeTheWind = true` → +200 "Rode the wind" in `scoring.md`. Only the mini-game earns it.

### Result and application
`FlareResult = { kind: 'flare', hits }` (`0..5`; `5` = crash).

Intent `{ type: 'cross', method: 'thread', result }` at the Flare Belt → `applyFlareResult`: replaces the M2 roll; no day; RNG order per hit (d100, then the effect's picks), or for a crash: victim draw, then spare checks. Logs: `crossing` / `thread`; `flare` / `clean`, per-hit ids above, or `crash`. Auto-resolve: the M2 Flare Belt roll (45%, +15 in flare season; severity +5, +10 in season). Skip: the same with incident +10.

### Arithmetic (hits ~ Poisson)
| | Statistical death (Lost) | Average player hit rate per arc | E[hits] | P(clean) | P(crash) |
|--|--------------------------|----------------------------------|---------|----------|----------|
| Normal | 45% × 10% = 4.5% | 5% of 30 arcs | 1.5 | 22% | 1.9% |
| Flare season | 60% × 20% = 12% | 7% of 37 arcs | 2.6 | 7% | 12% |

## Result schemas (JSON Schema, draft 2020-12; all integers ≥ 0, no extra properties)
```json
{ "$id": "SalvageResult", "type": "object", "additionalProperties": false,
  "required": ["kind","rations","plates","pumps","gyros","chargesUsed","crewHurt"],
  "properties": { "kind": {"const":"salvage"}, "rations": {"type":"integer","minimum":0,"maximum":100},
    "plates": {"type":"integer","minimum":0,"maximum":3}, "pumps": {"type":"integer","minimum":0,"maximum":3},
    "gyros": {"type":"integer","minimum":0,"maximum":3}, "chargesUsed": {"type":"integer","minimum":0,"maximum":20},
    "crewHurt": {"type":"integer","minimum":0,"maximum":3}, "droneWrecked": {"type":"boolean"} } }
{ "$id": "ThreadingResult", "type": "object", "additionalProperties": false, "required": ["kind","hits","bonus"],
  "properties": { "kind": {"const":"threading"}, "hits": {"type":"integer","minimum":0,"maximum":99},
    "bonus": {"enum":["health","rations",null]} } }
{ "$id": "FlareResult", "type": "object", "additionalProperties": false, "required": ["kind","hits"],
  "properties": { "kind": {"const":"flare"}, "hits": {"type":"integer","minimum":0,"maximum":5} } }
```
TypeScript: `type MiniGameResult = SalvageResult | ThreadingResult | FlareResult`. The sim also checks `rations + 10 × parts ≤ 100` and `bonus === null` unless `hits === 0`.

## Log kinds (new)
| Kind | Ids |
|------|-----|
| `salvage` | `haul nothing wrecked hot` |
| `threading` | `clean hit` |
| `flare` | `clean scorch burn damage radiation crash` |

Text keys (writer, `events.json`): `salvage.haul / nothing / wrecked / hot / overweight`, `threading.clean / hit`, `flare.clean / scorch / burn / damage / radiation / crash`, ≥ 2 variants each; scene copy (`ui.json`): `minigame.countdown / paused / skip / controls / resultTitle / bonusPick / holdFull / outOfCharges`.

## Reference policy (auto-play, balance)
`runPolicy` never sends a `result`: `scan` stays the 5-charge roll, `cross thread` stays the statistical roll (at the Flare Belt: the M2 roll; `policyCross` still prefers the tug when credits ≥ 2× price). So the policy, its seeds and `playthrough.test.ts` are unchanged. Auto-resolve mapping:

| Mini-game | Auto-resolve | Skip |
|-----------|--------------|------|
| Salvage Run | `scan` (travel.md, 5 charges) | d100 − 10 |
| Debris Threading | M2 thread, incident `T` | `min(95, T + 10)` |
| Flare Belt | M2 Flare Belt roll | incident +10 |

The M5 harness may model players by sampling hits at `p` per rock/arc (above).

## Debug hooks (tester)
`window.__PROXIMA__.minigame` is `null` outside the scenes, else `{ kind, elapsed, result? }`: `elapsed` = seconds of play (fixed-step, excludes countdown and pause), `result` set once the run ends (before the panel closes). Methods while a run is live: `finishNow()` ends it as if the timer ran out, with the haul/hits so far; `finishWith(result)` (test builds and `?debug=1` only) ends it with that result. Both go through the same validation and intent as normal play.
