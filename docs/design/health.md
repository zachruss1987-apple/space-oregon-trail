# Health

Each crew member has `health` 0–100 (start 100, integer), a list of active conditions (max 2), and `awayDays` (0 unless drifting). A ship-wide **general health** label is shown to the player (homage: Good / Fair / Poor / Very poor), computed from the average of living crew: ≥ 75 Good, ≥ 50 Fair, ≥ 25 Poor, else Very poor. The same bands label individual crew in Check supplies. Raw numbers are never shown.

**Present** crew = alive and `awayDays = 0`. Only present crew eat, take health changes, catch conditions, or are picked as event victims.

## Daily health delta (per present crew member)
Sum of:

| Term | Value |
|------|-------|
| Rations | Full +2, Half 0, Paste −2; starving day −10 instead |
| Thrust | Cruise 0, Hard burn −2, Overburn −5 (moving days only) |
| Weather | `travel.md` (suited/unsuited) |
| Conditions | each active condition's daily health |
| Rest | +3 per rest day (+6 at a station) |

Apply, then clamp 0–100.

## Health step order (per present crew member, travel step 7)
1. Apply the delta and clamp.
2. If health is 0: dies. Cause = active condition with the most negative daily health (ties: table order); else "starvation" if today was a starving day; else "exhaustion".
3. Else roll each active condition's death chance × health multiplier (below). First hit kills; cause = that condition.
4. Trigger checks: radiation sickness (storm/flare, unsuited, 15%), exhaustion (5th consecutive Overburn moving day).
5. Progress: each condition's remaining days −1 (−2 on a rest day). Remove at ≤ 0. Scurvy: while on Full rations, remaining is capped at 3.

**Health multiplier on death chance** (choices beat dice): health ≥ 75 ×0.5; 50–74 ×1; 25–49 ×1.5; < 25 ×2.

## Conditions
| Condition | Homage | Trigger | Duration (days) | Daily health | Death chance/day | Cure |
|-----------|--------|---------|-----------------|--------------|------------------|------|
| Space dysentery | Dysentery | illness event (`events.md`) | 5–10 | −4 | 1% | Rest (2 days per rest day) |
| Hull mold fever | Cholera | illness event | 4–8 | −6 | 3% | Rest |
| Cryo-fever | Typhoid | illness event | 7–14 | −3 | 2% | Rest |
| Scurvy ("yes, still") | Measles | illness event | 6–12 | −2 | 0.5% | Full rations cap remaining at 3 days |
| Micrometeorite puncture | Snakebite | illness event | 3–6 | −6 | 4% on its first 2 days (1% if suited), then 0 | Rest |
| Radiation sickness | — | Solar storm/Flare day, unsuited: 15% | 5–9 | −5 | 2% | Rest; suits prevent |
| Exhaustion | Exhaustion | 5th consecutive Overburn moving day (all present crew) | until 2 consecutive days off Overburn (any non-Overburn tick) | −3 | 0 | Slow down or rest |
| Decompression injury | Broken arm/leg | hazard outcome | 10–20 | −1 | 0 | Time; while any present crew has it, repair success −10 points |

Rules: at most one new condition per crew member per day; max 2 active; a crew member cannot hold two copies of one condition. If a trigger finds no room, it does nothing (hazard injury instead does −15 health).

All 8 conditions need death messages; illness-event conditions also need "has caught" lines.

## Death messages
Template: `{name} has died of {condition}.` with the writer's variants per cause (≥ 3 each) in `src/content/deaths.json`. Causes: the 8 conditions, plus `starvation`, `exhaustion` (no condition), `hazard` ("was lost in the {hazard}"), `drift` ("drifted off and did not come back"), `hull_fire` (if the burn hits 0). On death the player may write a memorial beacon epitaph (M2; M1 shows a simple notice).

## Game over
| Ending | Rule |
|--------|------|
| All dead | No living crew. If only missing crew remain alive, they rejoin at once (set `awayDays = 0`); it is not game over. |
| Adrift | 0 ion drives and `strandedDays` reaches 15 (reset to 0 whenever a drive is gained). |
| Starvation | Not a separate rule: starving days (−10/day) kill through health in about 10 days. |
| Arrival | Reaching New Willamette with ≥ 1 living crew: score screen (`scoring.md`). |
