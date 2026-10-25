# Design decisions

Append-only. One line per decision: what was decided, then why. Newest at the bottom. Change a rule in its topic file first, then log it here.

## 2026-10-24 (T-008, M1 readiness review)
- Thrust base raised to 20/25/30 Mk/day (was 12/16/20): the old values gave 180–220-day runs; these give ~135–190 with the original's +25%/+50% steps.
- Ration health shifted to Full +2 / Half 0 / Paste −2 (was +1/−1/−3): with no baseline recovery, Half was fatal over 150 days; Half now means "holding steady," as Meager did.
- Thrust health penalties kept at −2/−5 and applied on moving days only: Hard burn stays a real trade; a halted ship should not tire the crew.
- Ration price 0.30 cr (was 0.20) and start buy limit 3,000 (was 2,000): M1 has no resupply, so the limit must cover a Full trip, and only the Executive should afford one (a lean Engineer kit leaves ~2,100 rations vs 2,250 needed).
- Farmer ration perk is `floor(need × 0.85)`, min 1: rations stay integers; flooring slightly favors the profession that needs it most.
- Event chance 15% per tick, 7.5% resting (was 25%/12.5%): 25% produced ~37 events a run, mostly breakdowns, which buried choices under dice.
- drive_failure weight 5 → 4: adrift endings for well-supplied Executives were ~5%, which reads as unfair.
- Condition death chance scales with the victim's health (×0.5 Good to ×2 below 25): makes deaths traceable to rations, pace and rest rather than pure dice.
- Illness weight scales with general health (20/30/40): the same lesson, applied to catching things rather than dying of them.
- Illness pool defined (dysentery 6, mold 3, cryo 4, scurvy 4, puncture 3); radiation, exhaustion, decompression are trigger-only: resolves events.md vs health.md overlap.
- Radiation sickness: 15% per unsuited crew per storm/flare day: suits need a concrete payoff.
- Suit wear: 20% chance to lose one suit per Solar storm or Flare day (replaces "per crew lacking a spare on unsettled days"): the old rule was ambiguous and contradicted the weather table.
- Suits are assigned in roster order, captain first: deterministic and explainable.
- Weather is a sticky Markov chain (persistence 0.6) over phase rows (early by window, mid shared, late by flare season): one concrete table, window identity lives where the player feels it.
- Flare season starts 15 Sept 2184: with ~140-day runs it makes Windows 1–2 safe, 3 a race, 4–5 certain, matching world.md's risk column.
- Distance overflow on arrival day is lost: keeps arrival handling simple; costs ~8 days a run and is already in the numbers.
- Day-consuming actions (rest, scan, repair, lost/delay days) are ordinary ticks with distance 0: one code path, every rule still applies.
- Attempt repair takes 1 day and fixes one part; ion drives are never repaired: drives already have their own failure/stall pair.
- Passing help (10%/day) fixes a broken part without a spare or gives a stranded ship 1 drive; adrift ending after 15 stranded days: homage to the helpful passerby with a real deadline.
- Drive buy limit 1–9, at least 1 to depart (was "2–9"): the drive factor table already defines 1 drive; Mattie's advice carries the warning.
- Spare parts capped at 3 per type in inventory, including finds: matches store limit and scoring.
- Scan for salvage (M1): 1 day, 5 charges, d100 table with EV ≈ 27 rations, halved after 2 scans per segment: the Farmer's lifeline, but not a substitute for buying food.
- M1 hazard = one incident roll then a d100 severity table (delay / cargo / damage / injury / death): reuses the existing hazard parameters; tug and pilot columns wait for M2.
- Window 1/2 hazard bonus (+10/+5) applies only at the first two hazards: world.md's "slower transit through the Lunar Debris Ring" made concrete.
- Missing (drifting) crew are not present: no food, no health change, not victims; they rejoin at once if everyone aboard dies: avoids an empty ship with a living crew.
- Health is shown as labels only, per crew in Check supplies: imperfect information, but every crew member's state is visible.
- Default crew names Ezra, Temperance, Amos, Lucinda, Hollis plus a 20-name pool: period-flavored, all ≤ 12 characters.
- Score bonuses are added before the multiplier; drift losses count as deaths for the +300: as written, now unambiguous.
- M1 always routes via Oort Beacon: the Titan branch is an M2 choice.

## 2026-10-24 (sim implementation, developer, logged by PM)
- Station price markups: superseded by the per-item markup table in `economy.md` (T-022/T-046, 2026-10-24); the flat 1.25 + 0.25/station placeholder is retired.
- Auto-play policy also repairs whenever a broken part has a spare; "days left" is counted at Half rations.
- Exhaustion counter builds only on Overburn days with movement and decays 1 per tick off Overburn (rest days included).
- Scans and repairs resolve at tick step 4 (distance step) as zero-distance days.
- A stalled drive stays offline for the rolled days, counted after that day's distance.
- Zero-health deaths without an active condition take the dominant cause per health.md (bad_recycler / hazard hits included).
- Hazard injury falls back to −15 health if the victim already gained a condition that day; cargo loss with an empty hold counts as clear; damage to an already-broken part has no extra effect.
- Credits keep cents (rations cost 0.30 cr).
- Playthrough (200 seeds): 49.5% win overall, Executive 66%, Engineer 72%, Farmer 5%, mean 177 days. Accepted for M1; M5 balances Farmer and Executive mass penalty.

## 2026-10-24 (tester)
- A condition caught today (radiation sickness, illness, injury) does not tick down on the day it is caught, so its first full duration is the rolled 5–9 / table range: health.md steps 4–5 were ambiguous; the code's reading is reasonable and now asserted by `tests/unit/spec/health.spec.test.ts`.
- Scurvy becomes eligible on the 10th consecutive Half/Paste day (the counter is compared after that day's increment): events.md "after 10+ consecutive days" was ambiguous; asserted in `events.spec.test.ts`.
- Policy-run finding (not a rule change): in 1,000 seeds (SEED-0..999) no reference-policy run dies before day 40 (earliest Executive death is day 111), so e2e "early death" seeds are the earliest deaths, not under-40 ones; see `tests/e2e/seeds.ts`.

## 2026-10-24 (T-022 / T-046, M2 economy and hazards spec)
- Markups are per station per item (not one number per station), all in 1.0–2.5: scarcity becomes thematic (Mars food 1.0, Ceres charges 1.0, Titan pumps 1.25, Oort gyros 1.5 and no drives, Lane Terminus food 2.0) while the overall +0.25/station trend matches the original.
- Ration markups limited to 1.0/1.5/2.0/2.5 so ration prices are whole cents (avoids float rounding of 0.375/0.675).
- Buy-back = min(50% local, 90% base), stations buy only what they sell: plain 50% let players buy at Independence/Mars and sell farther out at a profit (e.g. rations 0.30 → 0.375 at Titan); with the cap, buy-then-sell always loses ≥ 10%.
- No per-visit stock limits on the road; the start buy limits and caps apply to holdings: fewer state fields, and caps already bound the useful amounts.
- Cannot sell the last drive, trades cannot take it, and Continue needs ≥ 1 drive; arriving with 0 drives is resolved by buying, trading, or resting (passing help / adrift), so no soft-lock.
- NPC offers: 2–3 per road-station visit, generated in the arrival tick with the main Rng (reproducible regardless of UI path), valued at base prices with a hidden fairness roll (1.6 / 1.25 / 1.0 / 0.75); credit asks floored at 1.0 so a trader is never a cheaper source than the cheapest store.
- Trades value at base prices, not local: trading is how a broke traveler beats the markup; the Farmer's lever (30 rations for one spare at fair, vs 20 from selling it) beats the store 1.5–2×.
- Rations trade lot 30–150 so a single spare can buy food at fair terms.
- `trades.json` uses `{give}`/`{get}` as full phrases with counts; `{n}` is optional (the get quantity): two quantities made a lone `{n}` ambiguous.
- Talk pool ≥ 10 per road station (brief said ≥ 8): 6 × 10 meets M2's ≥ 60 lines; Talk is UI-only with the text Rng and no state.
- stations.json drops `name`, `blurb`, `markup` from the old writing.md schema: names live in waypoints.ts, blurbs in bulletins.json, markups are rules (content TS), not text.
- Hazards: crossing becomes a pending decision on arrival; resolution costs no day (as in M1), and rest/repair/scan stay available while pending so blocked options cannot soft-lock.
- Today's density rolled on arrival (±1 around nominal, 25/50/25) and scales Thread risk ×0.8/1.0/1.2: gives the readout real information and makes "baseline × density factor" concrete.
- Ship state adds +10 each for broken hull, broken gyro, ≤ 1 working drive: ties hazard risk to earlier repair and drive choices.
- Shields halve risk and apply −10 severity (no Lost possible) at a 15% pump-break cost: a clear "spend a part to protect people" trade.
- Belter pilot only at the Belt Crossing and Saturn Ring Plane (trail.md had waits for all hazards): matches the Belters' lore; pilot is 3% flat with −20 severity (no injury/death); wait days are ordinary ticks (food, events), not rest.
- Tug ×1.5 in flare season applies by date at any hazard (only the last two meet it in practice).
- The Flare Belt in M2 offers only Thread (exactly the M1 roll) and a tug; shields/pilot dimmed. M3 replaces both with the finale.
- Risk words: None 0, Low 1–9, Moderate 10–24, High 25–44, Severe ≥ 45; percentages hidden (imperfect information).
- Route: direct skips waypoint 12; segment 13 stays 160 Mk from the Gate (total 1,926); Heliopause +10. Route can be changed until leaving Titan; default via Oort.
- Beacons: one optional epitaph per crew death (not only the last), segment = `arrivedAt ?? segment`, last 200 kept; up to 3 shown per waypoint, player beacons first, canned fill at most 2 slots (1 once the player has ≥ 10 beacons) so canned ones fade as real ones accumulate.
- Reference auto-play crossing policy: pilot > tug if credits ≥ 2× price > shields if a spare pump > thread; route always via Oort.
