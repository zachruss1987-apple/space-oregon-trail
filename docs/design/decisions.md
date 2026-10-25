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
