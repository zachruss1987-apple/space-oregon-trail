# Balance report: tuned (T-039)

Before: `docs/reports/balance-baseline.md` content (re-measured at 300 seeds). After: this card's content. All numbers come from `npm run balance -- --seeds 300` (seeds 1..300 per profession × window, so 1,500 runs per profession), balanced (reference) policy, Spacer unless noted. Decisions: `docs/design/decisions.md`, 2026-10-25 (T-039).

M5 targets used here: Executive 55–65%, Engineer 45–60%, Farmer 25–35%, mean 140–175 days, no death cause above 35%, Greenhorn at least 15 points above Spacer, Pathfinder at least 15 points below.

## Diagnosis

- **Runs end late.** About 80% of lost runs end on segments 15–16 (Flare Belt to New Willamette), most deaths fall on Flare days, and the suits are gone by then (0.3–1.3 left). Crew die when health reaches zero, not from condition rolls, so condition death chances barely move win rates. Suit wear and late Flares are the main dials.
- **The Farmer starved.** 400 cr minus the kit (210 cr) buys 633 rations. Half rations cost 8 a day, so food lasts about 80 days of a 170-day trip. Starvation began around day 102 and 68% of Farmer runs starved at some point. Salvage was worth ~27 rations for a day that eats 8, and five suits for five crew meant the first ruined suit left someone exposed (17.6 unsuited radiation days a run).
- **The Executive was slow, not weak.** It averaged 203 days: 140 moving days (3,000 rations is a −10% mass penalty for most of the trip, and its drives fail twice as often as the Engineer's) plus 46 rest days. It arrived with ~720 rations unused. Its 440 spare credits barely matter, because the 3,000-ration buy limit binds (dropping it to 1,200 cr changed nothing).
- **The Engineer beat the Executive** (65% to 60%) because it was 27 days faster (fewer drive failures, no extra mass), so it spent less time in late Flares, and 1,800 rations covered the trip.
- **Radiation dominated** (27%) because unsuited Flare days are the run-killer. Starvation (23%) was almost all Farmer.
- **Runs were long** because the M1 day-count sketch (140–155) left out ~40 rest days a run.

## Changes (content numbers plus one reference-policy purchase)

| Lever | Before | After | File |
| --- | --- | --- | --- |
| Thrust base Mk/day (Cruise / Hard / Overburn) | 20 / 25 / 30 | 22 / 27 / 33 | `src/content/rules.ts` `THRUST` |
| Suit wear per Solar storm / Flare day | 20% | 25% | `rules.ts` `SUIT_WEAR_CHANCE` |
| Salvage auto-resolve yields (26–70 / 71–95) | 15–40 / 40–80 (EV ≈ 27) | 25–60 / 60–120 (EV ≈ 42) | `rules.ts` `SALVAGE` |
| Engineer starting credits | 800 | 650 | `src/content/professions.ts` |
| Farmer ration factor | ×0.85 (Half, 5 crew: 8/day) | ×0.65 (6/day); perk "Rations go half again as far" | `professions.ts` |
| Reference policy: Farmer EVA suits | 5 | 8 | `src/sim/policy.ts` `policyKit` |

Tested and not kept: event chance 15% → 20% (+13 days), condition death chances ×1.5 (no effect on wins), radiation death 2% → 3% (no effect on wins, raises the radiation share), mass slope 0.05 → 0.025 or 0.075 (±5 points for the Executive at ±6–9 days), Executive credits 1,200 (no effect), rest +5/+8 (wins soar, days barely move).

## Per profession (balanced, Spacer)

| Profession | Win before | Win after | Mean days before | Mean days after | Median days after |
| --- | --- | --- | --- | --- | --- |
| Executive | 59.7% | **63.3%** | 203.5 | **183.7** | 175 |
| Engineer | 65.4% | **51.1%** | 176.3 | **157.2** | 153 |
| Farmer | 4.3% | **31.7%** | 169.3 | **170.6** | 167 |
| All | 43.1% | **48.7%** | 183.0 | **170.5** | |

### By launch window (after; win / mean days)

| Window | Executive | Engineer | Farmer |
| --- | --- | --- | --- |
| 1 | 77.7% / 184 | 54.7% / 167 | 42.0% / 181 |
| 2 | 76.0% / 176 | 64.0% / 157 | 43.0% / 170 |
| 3 | 62.7% / 178 | 58.0% / 151 | 38.0% / 166 |
| 4 | 48.0% / 190 | 41.7% / 156 | 20.0% / 168 |
| 5 | 52.3% / 189 | 37.0% / 156 | 15.3% / 169 |

## Death causes (balanced, Spacer, share of all crew deaths)

| Cause | Before | After |
| --- | --- | --- |
| radiation-sickness | 26.8% | 29.8% |
| starvation | 22.7% | 18.7% |
| cryo-fever | 13.4% | 12.6% |
| hull-mold-fever | 12.3% | 12.0% |
| exhaustion (health 0, no condition) | 7.4% | 9.6% |
| space-dysentery | 9.4% | 9.5% |
| scurvy | 3.0% | 2.8% |
| hazard | 2.3% | 2.6% |
| micrometeorite-puncture | 1.3% | 1.0% |
| drift | 1.1% | 1.0% |
| hull_fire | 0.4% | 0.3% |
| decompression-injury | 0.0% | 0.0% |

## Difficulty (balanced policy)

| Level | Win before | Win after | vs Spacer after | Mean days after | Executive / Engineer / Farmer after |
| --- | --- | --- | --- | --- | --- |
| Greenhorn | 63.1% | 78.3% | +29.6 | 156.2 | 79.4% / 85.7% / 69.9% |
| Spacer | 43.1% | 48.7% | — | 170.5 | 63.3% / 51.1% / 31.7% |
| Pathfinder | 18.6% | 21.2% | −27.5 | 178.7 | 41.7% / 9.2% / 12.7% |

The ordering holds with margin. Greenhorn's top cause is radiation at 43.7% (42.7% before): that level halves illness deaths, so radiation's share grows. The 35% cap is checked on Spacer only.

## Other policies (after, 300 seeds)

| Policy | All | Executive | Engineer | Farmer | Mean days |
| --- | --- | --- | --- | --- | --- |
| cautious | 36.5% | 75.3% | 19.3% | 14.9% | 173.7 |
| balanced | 48.7% | 63.3% | 51.1% | 31.7% | 170.5 |
| greedy | 21.0% | 30.0% | 23.1% | 10.1% | 183.1 |

Caveat: the Engineer's rations are now tight. The cautious kit (+1 drive, +1 of each spare, 70 cr) costs it 233 rations, and its win rate falls to 19%. The reference policy never buys food at stations, but a player can (Mars Relay sells rations at ×1). Follow-up: let the policy top up rations at road stations, then re-check the cautious Engineer.

## Tests re-pinned on this card

- `tests/unit/balance/bands.test.ts`: balanced policy, seeds 1..100, all windows. It asserts the M5 bands, not ± a baseline. This matrix measures Executive 62.6%, Engineer 50.4%, Farmer 30.6%, 170.4 days, top cause 30.6%, Greenhorn 78.5% and Pathfinder 20.9% against Spacer 47.9%.
- `tests/unit/sim/fixtures/policy-50.json` regenerated (re-baselined on T-039).
- `playthrough.test.ts`: Farmer band is now 15–45% (it was < 20%).
- Spec tests updated with the new numbers: travel (thrust, Farmer need, suit wear), repairs (salvage yields and EV), store (Engineer kit), world (credits), plus the content tables, game, difficulty, policy, weather-travel and hazard-salvage unit tests.
