# Health

Each crew member has `health` 0–100 (start 100) and a list of active conditions. A ship-wide **general health** label is shown to the player (homage: Good / Fair / Poor / Very poor), computed from the average of living crew: ≥ 75 Good, ≥ 50 Fair, ≥ 25 Poor, else Very poor.

## Daily health delta (per crew member)
Sum of: ration effect + thrust effect + weather effect + condition effects + resting bonus. Clamp 0–100. At 0 the crew member dies with a death message naming the dominant cause (worst active condition, else starvation, else exhaustion).

## Conditions
| Condition | Homage | Trigger | Duration | Daily health | Death chance/day | Cure |
|-----------|--------|---------|----------|--------------|------------------|------|
| Space dysentery | Dysentery | Random event; more likely on Paste rations | 5–10 days | −4 | 1% | Rest halves duration |
| Hull mold fever | Cholera | Random; more likely after Saturn/Heliopause | 4–8 | −6 | 3% | Rest |
| Cryo-fever | Typhoid | Random; more likely with low general health | 7–14 | −3 | 2% | Rest |
| Scurvy ("yes, still") | Measles | Random; only on Half/Paste rations for 10+ days | 6–12 | −2 | 0.5% | Full rations cure in 3 days |
| Radiation sickness | — | Solar storm/flare day without a suit | 5–9 | −5 | 2% | Rest; suits prevent |
| Exhaustion | Exhaustion | Overburn 5+ consecutive days | until 2 days of Cruise/Rest | −3 | 0 | Rest |
| Decompression injury | Broken arm/leg | Hazard outcomes, random event | 10–20 | −1 | 0 | None needed; slows repairs |
| Micrometeorite puncture | Snakebite | Random event during Unsettled+ weather | 3–6 | −6 | 4% first 2 days | Suit reduces to 1% |

Only one new condition per crew member per day; a crew member may have up to 2 conditions.

## Death messages
Template: `{name} has died of {condition}.` with the writer's variants per condition (≥ 3 each) in `src/content/deaths.json`. On death the player may write a memorial beacon epitaph (M2; M1 shows a simple notice).

## Game over
All five crew dead. Or: no working ion drive, no spare, and 15 consecutive days without help → "adrift" ending. Or rations 0 for 10 days with no salvage → starvation ending via health.
